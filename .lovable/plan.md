

## Fix DM real-time: per-conversation broadcast channels

### Problem
The `postgres_changes` subscription on `direct_messages` is unreliable (timeouts, missed events). Need to switch to client-side broadcast on per-conversation channels.

### Changes

**File 1: `src/stores/dmStore.ts`**

1. **`sendMessage`** (after line 470 `get().addMessage(...)`): Add broadcast to `dm:${conversationId}` with event `new_message` containing the message data. Wrap in try/catch (non-critical).

2. **`editMessage`** (after line 501 `return { messagesByConversation }`): Find the conversation ID from the message, then broadcast event `message_updated` with `{ id, conversation_id, content, edited_at }`. Need to find conversationId by scanning `messagesByConversation` keys before the `set()` call.

3. **`deleteMessage`** (after line 526 `return { messagesByConversation }`): Same pattern — find conversationId first, then broadcast event `message_deleted` with `{ id, conversation_id }`.

**File 2: `src/hooks/useRealtimeDMs.ts`**

1. **Delete the `postgres_changes` effect** (lines 212-261): Remove the entire `useEffect` that creates `dm-realtime:${userId}` channel.

2. **Add active conversation broadcast subscription**: New `useEffect` keyed on `[userId, currentConversationId, ...]` that subscribes to `supabase.channel(\`dm:\${currentConversationId}\`, { config: { broadcast: { self: false } } })` with three event listeners:
   - `new_message` → calls `handleNewMessage({ new: payload.message })`, skips own sender
   - `message_updated` → calls `handleMessageUpdate({ new: payload.message })`
   - `message_deleted` → calls `handleMessageDelete({ old: payload.message })`

3. **Add background conversation subscriptions for unreads**: New `useEffect` that subscribes to up to 10 most recent non-active conversations via `dm-notify:${convId}` channels. Listens only for `new_message` to update `last_message` on conversations and trigger `onNewMessage` callback for notification sounds/badges.

4. **Clean up unused types**: Remove `BroadcastMutationOp` and `BroadcastMutationPayload` if no longer referenced.

### What stays unchanged
- `handleNewMessage`, `handleMessageUpdate`, `handleMessageDelete` internal logic
- `dm_reactions` postgres_changes subscription
- `dm_participants` postgres_changes subscription
- SQL trigger `broadcast_user_dm_message_change`
- Message fetching on conversation open
- `conversationIdsRef` tracking

### Technical notes
- `{ broadcast: { self: false } }` prevents sender from receiving their own broadcast (optimistic update already applied)
- Background subscriptions limited to 10 most recent conversations to avoid channel exhaustion
- Broadcasts are fire-and-forget (wrapped in try/catch) — message is already persisted via RPC

