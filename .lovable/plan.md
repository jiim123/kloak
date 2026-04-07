

## Fix DM real-time: replace shared channel with dedicated postgres_changes subscription

### Problem
The shared channel `user:${userId}` causes DM broadcast events to be missed when another hook subscribes first and handlers registered later are dropped.

### Solution
Replace the broadcast listener with a dedicated `postgres_changes` subscription on its own channel. This avoids the shared channel system entirely.

### Changes

**File: `src/hooks/useRealtimeDMs.ts`**

1. **Remove shared channel import** (line 8): Delete `import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';`

2. **Replace broadcast effect** (lines 212-245): Replace the entire `useEffect` block with a dedicated `postgres_changes` subscription:

```typescript
// DM message changes via dedicated postgres_changes channel
useEffect(() => {
  if (!userId) return;

  const channel = supabase
    .channel(`dm-realtime:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      },
      (payload) => {
        const convId = payload.new?.conversation_id as string | undefined;
        if (!convId) return;
        if (conversationIdsRef.current.size > 0 && !conversationIdsRef.current.has(convId)) return;
        void handleNewMessage(payload);
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'direct_messages',
      },
      handleMessageUpdate,
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'direct_messages',
      },
      handleMessageDelete,
    )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log('[DM Realtime] Connected via postgres_changes');
      } else {
        console.warn('[DM Realtime] Status:', status, err);
      }
    });

  return () => {
    supabase.removeChannel(channel);
  };
}, [userId, handleNewMessage, handleMessageUpdate, handleMessageDelete]);
```

The `BroadcastMutationPayload` and `BroadcastMutationOp` types can stay (harmless dead code) or be removed — no functional impact.

### What stays unchanged
- `dm_reactions` subscription
- `dm_participants` subscription
- All handler functions (`handleNewMessage`, `handleMessageUpdate`, `handleMessageDelete`)
- The SQL trigger `broadcast_user_dm_message_change`
- The `dmStore`

### Note on the conversation filter
The INSERT handler checks `conversationIdsRef.current` to scope events to conversations the user participates in. RLS on `direct_messages` already filters by participant, so `postgres_changes` will only deliver rows the user can SELECT — this filter is a secondary guard.

