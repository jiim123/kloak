## Plan — Fix presence desynchronization

### Root causes

After tracing `usePresence`, `useRealtimeUsers`, `lib/presence.ts`, and the consumers in `MembersSidebar`, `DMSidebar`, and `FriendsList`, three independent bugs cause the symptoms ("looks online but isn't" / "looks offline but is" / clears on navigation):

**Bug 1 — Signature cache poisons future updates when stores are empty at apply-time.**
`applyPresenceSnapshot` records a per-user `presenceSigByUser` signature after dispatching `patchUserAcrossStores`. But the batched store patches in `useRealtimeUsers.ts` (`flushMemberPatches`, `flushFriendPatches`, `flushDMPatches`) early-return when the relevant store has no `currentServer`, no `conversations`, or no friends. The signature still gets cached. When the user later navigates back to the server / opens a DM, members/conversations get fetched from the DB with stale `status='offline'` and the presence channel never re-patches them because the cached signature still matches the live presence state. Result: the member sits as "offline" until something forces a fresh signature (e.g. that user actually changes status, or you change page and a new fetch triggers a snapshot pass that crosses the absent-grace path).

**Bug 2 — Presence channel never reconnects after a drop.**
The `subscribe()` callback in `useRealtimeUsers` only flips `presenceConnectedRef` to `false` on `CLOSED` / `CHANNEL_ERROR` / `TIMED_OUT` and never re-subscribes. While the underlying Realtime socket has its own reconnect, the presence-state on this channel resets after a disconnect, and our cached `presenceSigByUser` keeps blocking re-application even after the socket reconnects. So once the channel hiccups (which is common after long active sessions / lots of chat / network blips), other users freeze at their last-known status until the page reloads.

**Bug 3 — Consumer guards distrust the realtime channel when the cached row says `offline`.**
`getMemberPresence` in `MembersSidebar.tsx` (line 132–134) guards `hasRecentRealtimePresence` with `status !== 'offline'`. If the cached row's `status` field is stale `'offline'` (typical right after a server-member fetch), the realtime presence is ignored and the heuristic in `getEffectivePresence` takes over. `getEffectivePresence` itself does the right thing only when `userId` is passed AND the cache hit is fresh, but the wrapper short-circuits before that path.

A related concern: `serverStore` is refetched on server switch and overwrites realtime-patched member statuses; combined with bug 1, that's how a member can permanently appear offline until that user reconnects.

### Fix plan

**1. `src/hooks/useRealtimeUsers.ts`**
   - Make `patchUserAcrossStores` always apply patches to all stores (drop the `state.members.length === 0` / `conversations.length === 0` early returns in `flushMemberPatches` / `flushDMPatches` / `flushFriendPatches` — keep the no-change short-circuit but stop skipping the whole flush). This way the userCacheStore stays the source of truth and the per-store stale data gets healed as soon as it arrives.
   - Only record `presenceSigByUser[targetId] = signature` after a patch is actually dispatched, AND clear it for any user we *fail* to patch (so a future snapshot retries). Move the signature write below the `patchUserAcrossStores` call (already the order) but additionally reset it to `''` when the user enters/re-enters the target set so the next snapshot always re-asserts. Use a `freshTargetsRef` Set populated by `throttledApply` when `lastTargetIdsKey` changes — clear those users' signatures before calling `applyPresenceSnapshot`.
   - Add presence-channel reconnect: on `CLOSED` / `CHANNEL_ERROR` / `TIMED_OUT`, schedule a `setTimeout` (exponential backoff capped at ~10s) that calls `supabase.removeChannel(channel)` and re-runs the subscription setup. On every reconnect, clear `presenceSigByUser` so all targets get a fresh patch from the new presence state, then re-`track` our own payload.
   - Add a `window.addEventListener('online', ...)` and `visibilitychange → visible` handler that, when the presence channel is not in `joined` state, triggers the reconnect path (in addition to existing poll-on-visible).
   - When the server members list refreshes (`useServerStore.subscribe` already runs `throttledApply`), force-clear `presenceSigByUser` for users that just appeared in the target set so their realtime presence is re-applied over the fresh DB rows.

**2. `src/components/layout/MembersSidebar.tsx`**
   - Drop the `status !== 'offline'` guard in `getMemberPresence`. If `hasRecentRealtimePresence(member.user_id)` is true, trust the realtime row (status may have just flipped to `'online'`/`'idle'` but the cached row is the older offline). Read the latest status directly from `useUserCacheStore` for that id when realtime is fresh, falling back to `member.user?.status` only when there is no recent presence.

**3. `src/components/dm/FriendsList.tsx` and `src/components/dm/DMSidebar.tsx`**
   - Apply the same trust-the-channel rule: route presence display through `getEffectivePresence(status, lastSeen, userId)` only when `!hasRecentRealtimePresence(userId)`. When realtime is fresh, pull the status from `useUserCacheStore` (the single source of truth) so all three consumers stay consistent.

**4. `src/lib/presence.ts`**
   - No behavior change required, but document the contract: when `userId` is provided AND `hasRecentRealtimePresence(userId)` is true, the function returns the status verbatim. Consumers must use this path.

**5. `src/stores/authStore.ts`**
   - In `updateStatus`, when the local user's status changes the new value is written to `set({ user: { ...user, status } })`. Also call `useUserCacheStore.getState().upsertUser(updatedUser)` so the global cache stays in sync (currently only `updateLastSeen` and `updateUser` do this — `updateStatus` does not, so a status change on your own account isn't reflected in any consumer that reads from `useUserCacheStore`). This is what makes "you" look stale to your own member row right after toggling.

### Verification

1. Open two browser sessions with two accounts that are friends and share a server.
2. From A, send 20+ messages rapidly to B (the "talk too much" repro). Verify B's presence dot in A's DM sidebar, friends list, and member sidebar stays in sync, no flicker offline→online on navigation.
3. From A, switch servers and come back. B's status should remain accurate without a page reload.
4. Kill A's network for 30s (DevTools Offline) and restore. Verify presence channel re-subscribes (`Successfully subscribed` log returns), and B's presence stays correct.
5. Close B's tab. Within ~35s (30s absent grace + snapshot tick) A should see B go offline; reopen B's tab and A should see B back online within a few seconds.
6. Toggle DND / Invisible on B and verify A reflects it everywhere instantly.

### Out of scope

- Replacing the global `presence:users-global` channel with per-friend topics (would reduce egress but is a larger refactor).
- Changing `update_user_last_seen` heartbeat cadence.
- Touching voice presence (`useVoicePresenceWatchers`) — separate channel with its own loop.
