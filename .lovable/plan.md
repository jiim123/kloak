

## Step 1: Trace Findings (Audit Report)

### Root Cause #1: `...msg` spread copies ALL RPC data onto message objects (CRITICAL)

**File:** `src/stores/messageStore.ts`, line 383-384

```js
const messages: Message[] = messageRows.reverse().map((msg: any) => ({
  ...msg,  // <-- THIS IS THE PROBLEM
  user: undefined,
  reply_to: msg.reply_to_id ? toMessageReply(msg.reply_to) || replyMap[msg.reply_to_id] : undefined,
  ...
}));
```

The RPC `get_channel_messages_secure` returns per message row:
- `"user"`: full `row_to_json(u)` with all 14+ user fields (username, display_name, avatar_url, banner_url, avatar_decoration, profile_effect, etc.)
- `"reply_to"`: contains another full user object
- `"reactions"`: array of objects (already stripped to user_id in RPC, this is fine)
- `"attachments"`: array of attachment objects

`...msg` copies the ENTIRE server response including the `user` object. Setting `user: undefined` after the spread creates the property but the garbage collector may or may not collect the original object since the spread already allocated memory for the full shape. More critically, this creates objects with `{id, username, display_name, ...}` property shapes that V8 tracks — explaining the 1.9M instances.

Additionally, `toMessageReply` (line 98-106) explicitly stores `user: raw.user as User` on every reply, so reply_to objects also carry full user data.

### Root Cause #2: No true virtualization — fixed-height spacer hack

**File:** `src/components/chat/MessageList.tsx`

The "virtualization" is a manual spacer-based approach using `ESTIMATED_MESSAGE_HEIGHT = 72px`. It only activates above 80 messages and uses `.map()` over a sliced array. This is NOT react-virtuoso despite the package being installed. Problems:
- Fixed 72px height estimation causes scroll jumping
- `deduplicatedMessages` array is recomputed on every render via `useMemo`
- Below 80 messages, ALL messages are rendered (threshold too high for memory, though not the main issue)

### Root Cause #3: Message type still allows `user?: User`

**File:** `src/types/index.ts`, line 267: `user?: User;` on the `Message` interface
**File:** `src/types/index.ts`, line 252: `user?: User;` on `MessageReply` interface  
**File:** `src/types/index.ts`, line 340: `sender?: User;` on `DirectMessage` interface

These types allow user data to be carried on messages, and nothing enforces stripping it.

### Root Cause #4: DM store also spreads full response

**File:** `src/stores/dmStore.ts`, line 348-349: `...msg` spread on DM messages. The `get_dm_messages` RPC likely also returns sender data (the `sender` field on `DirectMessage` type exists).

---

## Plan

### Fix 1: Stop spreading raw RPC data — explicitly pick message fields (BIGGEST WIN)

**File:** `src/stores/messageStore.ts`

Replace line 383-395's `...msg` with explicit field picking:

```ts
const messages: Message[] = messageRows.reverse().map((msg: any) => {
  return {
    id: msg.id,
    channel_id: msg.channel_id,
    user_id: msg.user_id,
    is_own: msg.is_own ?? (msg.user_id === currentUserId),
    reply_to_id: msg.reply_to_id ?? null,
    content: msg.content,
    is_pinned: msg.is_pinned ?? false,
    is_system_message: msg.is_system_message ?? false,
    embed_hidden: msg.embed_hidden ?? false,
    edited_at: msg.edited_at ?? null,
    created_at: msg.created_at,
    user: undefined,
    reply_to: msg.reply_to_id
      ? replyMap[msg.reply_to_id] ?? stripReplyUser(msg.reply_to)
      : undefined,
    attachments: msg.attachments || [],
    reactions: groupReactions(
      blockedUserIds.length > 0
        ? (msg.reactions || []).filter((r: any) => !blockedUserIds.includes(r.user_id))
        : msg.reactions || [],
      currentUserId,
    ),
  };
});
```

This ensures the raw `msg.user` object (from `row_to_json(u)`) is never copied onto the stored message.

### Fix 2: Strip user from `toMessageReply` 

**File:** `src/stores/messageStore.ts`

Change `toMessageReply` to not store user data. Reply display only needs `id`, `content`, and `user_id` for cache lookup:

```ts
const toMessageReply = (raw: any): MessageReply | null => {
  if (!raw || typeof raw !== "object") return null;
  if (!("id" in raw) || !("content" in raw)) return null;
  // Extract user into cache if present, but don't store on reply
  if (raw.user?.id) {
    useUserCacheStore.getState().upsertUser(raw.user as User);
  }
  return {
    id: raw.id as string,
    content: raw.content as string,
    user_id: raw.user_id || raw.user?.id,
  };
};
```

Update the `MessageReply` type in `src/types/index.ts` to use `user_id` instead of `user`:
```ts
export interface MessageReply {
  id: string;
  content: string;
  user_id?: string;
  user?: User; // Keep optional for backward compat, but never populated
}
```

### Fix 3: Apply same fix to DM store

**File:** `src/stores/dmStore.ts`

Replace `...msg` spread at line 348-349 with explicit field picking, same pattern as Fix 1.

### Fix 4: Update reply rendering in MessageItem

**File:** `src/components/chat/MessageItem.tsx`

Where reply sender info is displayed, look up user from cache using `message.reply_to?.user_id` instead of `message.reply_to?.user`.

### Fix 5: Remove `user?: User` from Message type (cleanup)

**File:** `src/types/index.ts`

Remove `user?: User` from `Message` interface (line 267). This prevents future regressions. Any component still referencing `message.user` will get a compile error, which is the desired enforcement.

### Fix 6: Keep current spacer virtualization (no react-virtuoso swap)

The spacer-based virtualization is functional and already reduces DOM nodes above 80 messages. Swapping to react-virtuoso is a large refactor that risks breaking scroll-to-message, reply jumping, unread dividers, date dividers, and the prepend-anchor pattern. The critical memory win is in Fixes 1-5 (eliminating 1.9M duplicate user objects). Virtualization can be addressed separately.

### Files to modify:
1. `src/stores/messageStore.ts` — explicit field picking, fix toMessageReply
2. `src/stores/dmStore.ts` — explicit field picking for DM messages  
3. `src/types/index.ts` — update MessageReply type, remove user from Message
4. `src/components/chat/MessageItem.tsx` — update reply user lookup
5. `src/components/modals/PinnedMessagesPanel.tsx` — update reply user lookup if needed
6. `src/hooks/useRealtimeDMs.ts` — ensure DM realtime handler doesn't spread user data

