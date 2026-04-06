

## Fix: Member list refetch storm

Five changes to eliminate redundant `fetchMembers` triggers and prevent double-mount conflicts.

### Change 1: Delete background poll effect
**File:** `src/hooks/useRealtimeMembers.ts` — Remove lines 106-122 (the `MEMBER_POLL_INTERVAL_MS = 120_000` interval effect entirely).

### Change 2: Delete kloak-presence-change listener effect
**File:** `src/hooks/useRealtimeMembers.ts` — Remove lines 65-104 (the `handlePresenceChange` / `kloak-presence-change` listener effect entirely).

### Change 3: Remove kloak-presence-change dispatches from useRealtimeUsers
**File:** `src/hooks/useRealtimeUsers.ts`
- Remove lines 342-347 (offline dispatch block: `const currentServerId2 = ...` through the closing `}`)
- Remove lines 363-368 (online dispatch block: `const currentServerId = ...` through the closing `}`)
- Keep the `useServerStore` import (still used by `patchUserAcrossStores` and other code in the file).

### Change 4: Increase visibility handler throttle
**File:** `src/hooks/useRealtimeMembers.ts` — Line 30: change `30_000` to `60_000`.

### Change 5: Prevent double-mount conflict
**File:** `src/hooks/useRealtimeMembers.ts`
- Add module-level `const activeServerIds = new Set<string>()` before the hook export
- Add `instanceIdRef` and `isActiveInstanceRef` refs, plus a registration effect that adds the serverId to `activeServerIds` if not already present (first mount wins)
- Guard the visibility handler with `if (!isActiveInstanceRef.current) return`
- Guard the broadcast handler with `if (!isActiveInstanceRef.current) return`

### Final shape of useRealtimeMembers
After all changes, the hook will have exactly **three** `useEffect` blocks:
1. Store subscription (keeps refs updated) — unchanged
2. Instance registration (activeServerIds dedup)
3. Visibility handler (60s throttle, guarded by isActiveInstance)
4. Broadcast listener (server_surface events, guarded by isActiveInstance)

### Files changed
- `src/hooks/useRealtimeMembers.ts` — rewrite (remove 2 effects, add dedup, adjust throttle)
- `src/hooks/useRealtimeUsers.ts` — remove 2 dispatch blocks (6 lines each)

### What is NOT changed
- `patchUserAcrossStores`, Presence channel logic, `fetchMembers`, `MembersSidebar`, `ServerSettingsPage`

