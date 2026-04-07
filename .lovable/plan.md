

## Fix: Broadcast requires subscription before send

### Root Cause
All 5 broadcast `.send()` calls in `dmStore.ts` create a new channel via `supabase.channel(...)` and immediately call `.send()` without subscribing first. Supabase silently drops broadcasts from unsubscribed channels — `.send()` requires the channel to be in `SUBSCRIBED` state.

### Solution
Create a helper function that subscribes to the channel, waits for `SUBSCRIBED` status, sends the payload, then removes the channel. This ensures the broadcast actually goes through.

### Changes

**File: `src/stores/dmStore.ts`**

1. **Add a broadcast helper** near the top of the file (after imports):

```typescript
async function broadcastOnChannel(topic: string, event: string, payload: Record<string, unknown>): Promise<void> {
  const channel = supabase.channel(topic);
  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('subscribe timeout')), 3000);
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(timeout);
          reject(new Error(status));
        }
      });
    });
    await channel.send({ type: 'broadcast', event, payload });
  } finally {
    supabase.removeChannel(channel);
  }
}
```

2. **Replace all 5 raw `.send()` call sites** with `broadcastOnChannel(...)`:

- `sendMessage` (~line 474): Replace `const channel = supabase.channel(...); await channel.send(...)` with `await broadcastOnChannel(\`dm:\${conversationId}\`, 'new_message', { ... })`
- `editMessage` (~line 539): Same pattern → `broadcastOnChannel(\`dm:\${foundConversationId}\`, 'message_updated', { ... })`
- `deleteMessage` (~line 591): Same → `broadcastOnChannel(\`dm:\${foundConversationId}\`, 'message_deleted', { ... })`
- `addReaction` (~line 660): Same → `broadcastOnChannel(\`dm:\${foundConvId}\`, 'reaction_added', { ... })`
- `removeReaction` (~line 724): Same → `broadcastOnChannel(\`dm:\${foundConvId}\`, 'reaction_removed', { ... })`

All calls remain wrapped in `try/catch {}` — broadcast is non-critical since data is persisted via RPC.

### What stays unchanged
- All handler functions in `useRealtimeDMs.ts`
- The receiver-side broadcast subscriptions
- The `dm_participants` subscription
- The SQL trigger

