

## Fix app freeze caused by rapid userCacheStore version bumps

### Problem
When a Presence sync fires with N users, `patchUserAcrossStores` is called N times in rapid succession. Each call triggers:
1. `userCacheStore.patchUser` → `set({ _version: +1 })` — N Zustand state updates
2. `useServerStore.setState` — N new members arrays
3. `useFriendStore.setState` — N friend list rebuilds
4. `useDMStore.setState` — N conversation rebuilds

This causes N × 4 store updates and cascading re-renders, freezing the UI.

### Changes

**File 1: `src/stores/userCacheStore.ts`**
- Add module-level `pendingVersionBump` flag and `scheduleBatchedVersionBump()` using `queueMicrotask`
- In `patchUser`: replace `set({ _version: state._version + 1 })` with `scheduleBatchedVersionBump()` — cache is still mutated immediately, but the version bump (which triggers React re-renders) is deferred and deduplicated within the same microtask

**File 2: `src/hooks/useRealtimeUsers.ts`**
- Add three module-level batch systems for member, friend, and DM patches:
  - `pendingMemberPatches` Map + `flushMemberPatches()` via `setTimeout(fn, 0)`
  - `pendingFriendPatches` Map + `flushFriendPatches()` via `setTimeout(fn, 0)`
  - `pendingDMPatches` Map + `flushDMPatches()` via `setTimeout(fn, 0)`
- In `patchUserAcrossStores`: replace the three inline `setState` blocks with batch collection calls — patches accumulate during the loop, then flush as a single `setState` per store

### What stays the same
- Presence channel subscription logic unchanged
- `applyPresenceSnapshot` still calls `patchUserAcrossStores` per user — batching happens inside
- `fetchMembers` merge logic unchanged
- `useRealtimeMembers` unchanged
- `patchUserAcrossStores` signature and exports unchanged
- `upsertUsers` already batches correctly (single `set()` at end)

### Technical detail
- `queueMicrotask` for userCacheStore: runs after all synchronous `patchUser` calls complete but before the browser paints — single version bump per tick
- `setTimeout(fn, 0)` for cross-store patches: runs after the current task completes — collects all patches from the presence loop, applies once per store
- Result: 50 presence updates → 1 userCacheStore re-render + 1 serverStore re-render + 1 friendStore re-render + 1 dmStore re-render (instead of 50 × 4 = 200)

