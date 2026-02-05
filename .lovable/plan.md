
# Fix Group Chat Message Delivery Bug

## Problem Summary
Messages sent in newly created group chats are not displayed because of a race condition in the realtime subscription system. The `conversationIdsRef` filter rejects messages for conversations not yet tracked in the local cache.

## Root Cause (Verified)

```text
Bug Chain:
1. User creates group → createGroupConversation() adds to store
2. dm_participants INSERT triggers → fetchConversations() called (async)
3. User sends message → RPC succeeds, message in DB
4. Realtime receives INSERT event for message
5. Filter check: conversationIdsRef.current.has(convId) → FALSE (stale ref)
6. Message rejected, never added to local state
7. User sees empty chat despite message being saved
```

**Key Code Issues:**

| File | Line | Issue |
|------|------|-------|
| `useRealtimeDMs.ts` | 184 | Filter rejects messages for unknown conversation IDs |
| `useRealtimeDMs.ts` | 261-264 | Full ref replacement causes race conditions |
| `dmStore.ts` | 274-306 | `sendMessage` doesn't add message locally |

## Solution

### Fix 1: Add Optimistic Update to `sendMessage`
**File:** `src/stores/dmStore.ts`

After the RPC call succeeds, immediately add the message to local state instead of relying on Realtime delivery.

```typescript
// Current (broken):
sendMessage() → RPC → return message → wait for Realtime → (filtered) → lost

// Fixed:
sendMessage() → RPC → addMessage() locally → return message
                    → Realtime → duplicate check → ignored (already exists)
```

**Changes:**
- After successful RPC and message construction, call `get().addMessage(conversationId, message)`
- The existing duplicate check in `addMessage` (line 454) handles any Realtime race

### Fix 2: Incremental Ref Updates in `useRealtimeDMs`
**File:** `src/hooks/useRealtimeDMs.ts`

Instead of replacing the entire `conversationIdsRef` Set, update it incrementally:

**For INSERT events (lines 259-265):**
```typescript
// Current (causes race condition):
fetchConversations(userId).then(() => {
  const ids = useDMStore.getState().conversations.map((c) => c.id);
  conversationIdsRef.current = new Set(ids);  // Full replacement
});

// Fixed (incremental add):
const newConvId = payload.new.conversation_id;
conversationIdsRef.current.add(newConvId);  // Immediate add
fetchConversations(userId);  // Background refresh
```

**For DELETE events (lines 275-280):**
```typescript
// Fixed (incremental remove):
const removedConvId = payload.old.conversation_id;
conversationIdsRef.current.delete(removedConvId);  // Immediate remove
fetchConversations(userId);  // Background refresh
```

### Fix 3: Sync Ref After Group Creation
**File:** `src/stores/dmStore.ts`

The `createGroupConversation` function already adds the conversation to store state, but the realtime hook's ref isn't updated until the INSERT event fires. We need to expose a method to manually add conversation IDs.

**Alternative approach:** Since Fix 2 handles INSERT events immediately by extracting the conversation ID from `payload.new`, this is automatically covered when the dm_participants record is created.

## Files to Modify

### 1. `src/stores/dmStore.ts`
- Modify `sendMessage` method (around line 274-306)
- Add call to `get().addMessage(conversationId, message)` after constructing the message object

### 2. `src/hooks/useRealtimeDMs.ts`
- Modify dm_participants INSERT handler (lines 259-265)
- Modify dm_participants DELETE handler (lines 275-280)
- Use `.add()` and `.delete()` on the existing Set instead of full replacement

## Implementation Details

### dmStore.ts Changes

```typescript
sendMessage: async (conversationId, senderId, content, replyToId) => {
  try {
    const { data, error } = await supabase.rpc('send_dm', { ... });
    if (error) throw error;

    const msgData = data as { ... };
    const localUser = useAuthStore.getState().user;
    const { data: userData } = localUser?.id === senderId
      ? { data: localUser }
      : await supabase.rpc('get_user_by_id', { _user_id: senderId });

    const message: DirectMessage = {
      ...msgData,
      sender: userData as unknown as User,
      attachments: [],
      reactions: [],
    };

    // NEW: Add message to local state immediately (optimistic update)
    get().addMessage(conversationId, message);

    return message;
  } catch (error) { ... }
},
```

### useRealtimeDMs.ts Changes

```typescript
// dm_participants INSERT handler
.on(
  'postgres_changes',
  {
    event: 'INSERT',
    schema: 'public',
    table: 'dm_participants',
    filter: `user_id=eq.${userId}`,
  },
  (payload) => {
    // Immediately add the new conversation ID to prevent race conditions
    const newConvId = payload.new?.conversation_id;
    if (newConvId) {
      conversationIdsRef.current.add(newConvId);
    }
    // Background refresh for full conversation data
    fetchConversations(userId);
  }
)

// dm_participants DELETE handler  
.on(
  'postgres_changes',
  {
    event: 'DELETE',
    schema: 'public',
    table: 'dm_participants',
    filter: `user_id=eq.${userId}`,
  },
  (payload) => {
    // Immediately remove the conversation ID
    const removedConvId = payload.old?.conversation_id;
    if (removedConvId) {
      conversationIdsRef.current.delete(removedConvId);
    }
    // Background refresh
    fetchConversations(userId);
  }
)
```

## Expected Outcome

After these changes:

1. **Sender sees their message immediately** - Optimistic update adds it to local state
2. **No duplicate messages** - Existing duplicate check in `addMessage` prevents doubles
3. **No race conditions** - Incremental ref updates happen synchronously before async operations
4. **Other participants see messages** - Realtime still works for receiving messages from others
5. **Works for all DM types** - Both 1:1 and group conversations benefit from these fixes

## Testing Checklist

- [ ] Create a new group chat and send a message - should appear immediately
- [ ] Receive a message from another user in the group - should appear via Realtime
- [ ] Send multiple messages rapidly - no duplicates should appear
- [ ] Leave and rejoin a group - messages should still sync correctly
- [ ] 1:1 DMs still work as expected
