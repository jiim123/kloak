

## Fix: Stop DB fetches from overwriting real-time presence data

Six targeted changes across 8 files. No database or edge function modifications.

### Fix 1: Merge Presence-patched status in `fetchMembers`
**File:** `src/stores/serverStore.ts`
- Add `import { hasRecentRealtimePresence } from '@/hooks/useRealtimeUsers'` at top
- After line 1612 (where `members` array is built), before the `set()` call on line 1628, build a `mergedMembers` array that preserves existing Presence-patched status for users with `hasRecentRealtimePresence(userId) === true`
- Use `mergedMembers` in the `set()` call and cache calls instead of `members`

### Fix 2: Only trigger `fetchMembers` for new online users
**File:** `src/hooks/useRealtimeMembers.ts`
- In the `handlePresenceChange` handler (lines 72-94), remove the `isGoingOffline` branch. Only call `fetchMembers` when `isComingOnline` (user not in list and status !== 'offline'). Users going offline are already handled by `patchUserAcrossStores`.

### Fix 3: Add `userId` param to `getEffectivePresence`
**File:** `src/lib/presence.ts`
- Add `import { hasRecentRealtimePresence } from '@/hooks/useRealtimeUsers'`
- Add optional `userId?: string` parameter
- If `userId` is provided and `hasRecentRealtimePresence(userId)` is true, trust the status as-is (skip last_seen heuristics)

### Fix 4: Update all callers to pass `userId`
**Files:** 7 files
- `src/components/layout/MembersSidebar.tsx` — pass `member.user_id`
- `src/components/dm/FriendsList.tsx` — pass `friend.id` (3 call sites)
- `src/components/dm/DMSidebar.tsx` — pass `conversation.other_user?.id`
- `src/components/dm/DMHeader.tsx` — pass `otherUser?.id`
- `src/components/modals/UserProfilePopup.tsx` — pass `profileUser.id`
- `src/components/dm/UserSearchResults.tsx` — pass `result.id`
- `src/components/debug/PresenceDebugOverlay.tsx` — pass user id

### Fix 5: Increase background poll interval
**File:** `src/hooks/useRealtimeMembers.ts`
- Change `MEMBER_POLL_INTERVAL_MS` from `60_000` to `120_000`

### Fix 6: Fix `userCacheStore` status reactivity
**File:** `src/stores/userCacheStore.ts`
- In `patchUser`, change the non-visual (status/last_seen) branch to also create a new object reference and bump version, so components reading status from the cache re-render. The `useMessageUser` hook already uses per-user version tracking, so message components for *other* users won't be affected.

### What is NOT changed
- Presence channel subscription logic
- Own-user status management (authStore)
- `updateLastSeen` heartbeat
- Presence channel track/untrack
- `patchUserAcrossStores`
- 30-second absent grace period
- Any SQL/RPC functions

