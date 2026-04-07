

## Fix DM reaction broadcasts by reusing active channels

### Problem
`broadcastOnChannel` creates a temporary channel, subscribes, sends, then immediately tears it down. The WebSocket may not flush before teardown, causing reactions (and potentially messages) to be silently dropped.

### Solution
Replace `broadcastOnChannel` with a channel registry pattern. The receiver-side hook (`useRealtimeDMs.ts`) already maintains a subscribed channel for the active conversation — register that channel in a module-level map so `dmStore.ts` can reuse it for sending.

### Changes

**File 1: `src/stores/dmStore.ts`**

1. Delete the `broadcastOnChannel` function (lines 8-35).

2. Add a channel registry and `trySendBroadcast` helper in its place:
```typescript
const activeDMChannels = new Map<string, ReturnType<typeof supabase.channel>>();

export function registerDMChannel(conversationId: string, channel: ReturnType<typeof supabase.channel>) {
  activeDMChannels.set(conversationId, channel);
}

export function unregisterDMChannel(conversationId: string) {
  activeDMChannels.delete(conversationId);
}

function trySendBroadcast(conversationId: string, event: string, payload: Record<string, unknown>): void {
  try {
    const channel = activeDMChannels.get(conversationId);
    if (channel) {
      channel.send({ type: 'broadcast', event, payload }).catch(() => {});
    }
  } catch {}
}
```

3. Replace all 5 `await broadcastOnChannel(...)` calls with synchronous `trySendBroadcast(...)`:
   - `sendMessage` (~line 503): `trySendBroadcast(conversationId, 'new_message', { message: { ... } })`
   - `editMessage` (~line 563): `trySendBroadcast(foundConversationId, 'message_updated', { message: { ... } })`
   - `deleteMessage` (~line 610): `trySendBroadcast(foundConversationId, 'message_deleted', { message: { ... } })`
   - `addReaction` (~line 674): `trySendBroadcast(foundConvId, 'reaction_added', { ... })`
   - `removeReaction` (~line 735): `trySendBroadcast(foundConvId, 'reaction_removed', { ... })`

**File 2: `src/hooks/useRealtimeDMs.ts`**

4. Import `registerDMChannel` and `unregisterDMChannel` from `@/stores/dmStore`.

5. In the active conversation broadcast effect (line 184), add registration after channel creation and unregistration in the cleanup:
```typescript
const channel = supabase.channel(`dm:${currentConversationId}`, { ... });
registerDMChannel(currentConversationId, channel);
// ... existing .on() handlers ...
return () => {
  unregisterDMChannel(currentConversationId);
  supabase.removeChannel(channel);
};
```

### What stays unchanged
- All broadcast receiver handlers in `useRealtimeDMs.ts`
- Channel subscription config (`{ broadcast: { self: false } }`)
- Reaction/message RPC functions
- dmStore state management
- `dm_participants` subscription

