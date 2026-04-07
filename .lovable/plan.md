

## Fix DM real-time delivery

Two surgical changes in `src/hooks/useRealtimeDMs.ts`:

### Change 1: Remove scope filter from broadcast listener (lines 212-245)
Line 217: change `{ event: 'direct_messages', scope: \`dms-\${userId}\` }` to `{ event: 'direct_messages' }`.
Also remove the `as { event: string }` cast on line 221 since it's no longer needed.

### Change 2: Delete the postgres_changes fallback (lines 247-297)
Delete the entire `useEffect` block (lines 247-297) that creates `supabase.channel(\`all-dms:\${userId}\`)` with postgres_changes subscriptions on `direct_messages`. The broadcast trigger handles all three operations; this fallback only times out and wastes a connection slot.

### What stays unchanged
- `dm_reactions` postgres_changes subscription
- `dm_participants` postgres_changes subscription
- All handler functions (`handleNewMessage`, `handleMessageUpdate`, `handleMessageDelete`)
- The `dmStore`
- The SQL trigger `broadcast_user_dm_message_change`

