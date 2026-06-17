# Hooks Folder Audit — Cleanup Plan

A read-only audit of `src/hooks/` found 10 issues across conflicting writes, dead exports, subscription bugs, and double-delivery. Below is the proposed remediation, grouped by severity. Nothing outside `src/hooks/` and `src/hooks/index.ts` is touched except for one consumer check.

---

## HIGH severity (breaks logic / visible flashes)

### H1. Delete `useRealtimeReactions` (dead + would conflict if mounted)
- `src/hooks/useRealtimeReactions.ts` has **zero call sites**.
- `useRealtimeMessages.ts:530-671` already owns all reaction INSERT/UPDATE/DELETE handling — and unlike the dead hook, it correctly accounts for ghost-mode/pseudonymous users.
- If `useRealtimeReactions` were ever mounted alongside it, every reaction would be applied twice (inflated counts, duplicate user IDs).
- **Action:** delete the file; remove the export from `src/hooks/index.ts`.

### H2. Delete `useOfflineSync` (duplicates `useBackgroundSync`)
- Both hooks drain `offlineQueueStore` on `isOnline && wasOffline`, both iterate `queuedMessages`, both call `sendMessage`, both toast "Reconnected" / "Syncing messages…".
- `useOfflineSync` has **zero call sites**; `useBackgroundSync` is the one wired into `AppLayout`.
- **Action:** delete `useOfflineSync.ts`; remove the export from `src/hooks/index.ts`.

### H3. Strip connection-status writes from `useBackgroundSync`
- `useConnectionStatus` already owns `syncStore.connection.status` (driven by Supabase realtime channel state + the `ping_health` heartbeat).
- `useBackgroundSync.ts:90,102,135,139` independently calls `setConnectionStatus('reconnecting'|'connected'|'disconnected')` and `incrementReconnectAttempts`/`resetReconnectAttempts` on `navigator.onLine` events.
- On reconnect both fire near-simultaneously → status flickers and `reconnectAttempts` can be double-incremented/reset.
- **Action:** in `useBackgroundSync.ts`, remove all `setConnectionStatus`, `incrementReconnectAttempts`, `resetReconnectAttempts` calls and any helper ping that exists only to drive them. Keep the queue-drain logic. `useConnectionStatus` becomes the sole writer.

### H4. Migrate `useUnreadDMs` to `sharedChannel`
- `useUnreadDMs.ts:187-240` calls `supabase.channel('user:${userId}')` directly, never calls `.subscribe()`, and tears down via the private `_off` API.
- The same topic is owned by `useUnread` / `useRealtimeOwnMembership` / `useServerUnreadSummary` / `useRealtimeFriendships` via `sharedChannel`. The direct call creates a second channel instance for the same topic, so the broadcast listener registered in `useUnreadDMs` **never receives events** delivered to the shared instance.
- **Action:** replace the direct `supabase.channel(topic)` + `_off` teardown with `acquireChannel(topic)` + `subscribeChannel(topic)` + `releaseChannel(topic)` from `src/lib/sharedChannel.ts`, matching the pattern used by the four sibling hooks.

---

## MEDIUM severity (wasted work, audible duplication)

### M1. Stop double-delivery in `useRealtimeNotifications`
- `useRealtimeNotifications.ts:88-149` registers a Broadcast listener for `"notifications"` AND three `postgres_changes` listeners (INSERT/UPDATE/DELETE) on the same `notifications` table on the same channel.
- The dedup guard catches the duplicate store write, but `playNotificationSound` (line 83) is called before the store write, so the bell **plays twice** per notification.
- **Action:** keep the Broadcast path as primary. Gate the `postgres_changes` listeners behind a fallback flag (e.g., only invoke `processIncomingNotification` from the pg path if the broadcast hasn't delivered the same id within ~1s), or remove the pg INSERT path entirely and keep only DELETE/UPDATE (which Broadcast may not emit).

### M2. Consolidate `server_surface` handling between `useRealtimeServer` and `useRealtimeMembers`
- Both subscribe to the same shared `server:${serverId}` broadcast event `server_surface` and both react to `server_members`/`server_roles`/`server_member_roles` table names by calling `fetchMembers` + `fetchRoles` with `{ force: true }`.
- Every membership/role change → 2× fetchMembers + 2× fetchRoles in the same tick.
- **Action:** keep the handler in `useRealtimeServer` (it additionally purges messages from removed members). Remove the duplicate `server_members`/`server_roles`/`server_member_roles` branch from `useRealtimeMembers.ts:75-82`, leaving its other responsibilities intact.

---

## LOW severity (cleanup)

### L1. Stabilize `useSignedUrls` effect dependency
- `useSignedUrls.ts:44` uses `JSON.stringify(fileUrls)` as a `useEffect` dep. Replace with `const urlsKey = fileUrls.join('\n')` computed once per render and use `urlsKey` as the dep (matches the existing internal `keyRef` comparison).

### L2. Delete unused hooks (confirm with user before deleting)
- `useAttachmentQueue.ts` — zero call sites, not exported from `index.ts`.
- `useMaintenanceMode.ts` — zero call sites, not exported from `index.ts`.
- These may be WIP. **Will ask before deleting.** Everything else above proceeds.

### L3. Latent guard to preserve (no code change)
- `useRealtimeUsers.ts:402` skips own-user presence writes so it never fights `usePresence`'s idle/online transitions. Add a short comment so the guard isn't accidentally removed.

---

## Files touched

- `src/hooks/useRealtimeReactions.ts` — **delete**
- `src/hooks/useOfflineSync.ts` — **delete**
- `src/hooks/index.ts` — remove `useRealtimeReactions` + `useOfflineSync` exports
- `src/hooks/useBackgroundSync.ts` — strip connection-status writes
- `src/hooks/useUnreadDMs.ts` — migrate to `sharedChannel`
- `src/hooks/useRealtimeNotifications.ts` — dedupe broadcast vs postgres_changes
- `src/hooks/useRealtimeMembers.ts` — remove duplicate `server_surface` table branch
- `src/hooks/useSignedUrls.ts` — stable dep key
- `src/hooks/useRealtimeUsers.ts` — add comment on own-user guard

## Out of scope
- No changes to stores, components, or RPCs.
- `useAttachmentQueue` / `useMaintenanceMode` deletion deferred pending your confirmation that they aren't WIP.

## Verification after build mode
- Grep that `useRealtimeReactions` and `useOfflineSync` have no remaining imports.
- Send a DM and confirm `useUnreadDMs` increments via the shared channel (no `_off` warnings in console).
- Trigger a reconnect (DevTools offline → online) and confirm `connection.status` transitions exactly once and `reconnectAttempts` is incremented/reset exactly once.
- Receive a notification and confirm the bell sound plays once.
- Change a server member's role and confirm `fetchMembers`/`fetchRoles` are each called once.
