
## Root causes

### 1. "I need to toggle the members sidebar to activate my permissions"

This is not actually a permission bug — it's a **members-not-loaded** bug.

- `setCurrentServer` (serverStore line 904–920) sets `members: []` whenever the server has no cached member snapshot for the current user, and clears `rolePermissions: []` unconditionally.
- The only thing that triggers the initial `fetchMembers` for a server is **`MembersSidebar`** (line 480–484: `useEffect ... fetchMembers(currentServer.id)`).
- On desktop, `MembersSidebar` is **conditionally mounted** (`AppLayout.tsx` line 952: `isMemberSidebarOpen && <MembersSidebar />`). On mobile the same effect is gated by `!isMemberSidebarOpen && isMobile`.
- Consequence: if a user enters a server with the members sidebar closed, `members` stays `[]`. `useMemberPermissions` does `members.find(m => m.user_id === user.id)` → `currentMember = null` → `checkPermission` returns `false` for everything except literal `owner` (which is short-circuited via `currentServer.owner_id === user.id`). Anyone with admin/custom-role permissions but who is not the owner appears to have **no** permissions until they open the sidebar, which finally triggers `fetchMembers`.

Toggling the sidebar "fixes" it because opening it runs the lazy fetch.

### 2. `rolePermissions` not restored from cache on re-entry

`fetchChannels` has a cached-surface fast path (serverStore line 975–987) that applies categories/channels and returns early. It restores `roles` from cache but **does not** restore `rolePermissions` from `rolePermissionsCache`, even though that cache exists and is populated on the non-cached path (line 1068). Combined with `setCurrentServer` resetting `rolePermissions: []`, re-entering a server can leave permissions empty until a realtime broadcast or background sync force-refreshes them.

### 3. MembersSidebar audit findings

- `fetchRolePermissions` is imported at line 407 but **never called** — dead import.
- `useRealtimeMembers(currentServer?.id)` at line 477 fully duplicates the member/role refresh that `useRealtimeServer` (mounted in `AppLayout`) already performs on the same `server:${serverId}` broadcast channel. With the in-module `activeServerIds` guard inside `useRealtimeMembers`, the duplication is harmless but pointless. It also means that on desktop with the sidebar closed, member updates still arrive (via `useRealtimeServer`) — render correctness on join/leave does not depend on the sidebar being open.
- Member rendering itself is fine: `members` is a selector subscription, so when `useRealtimeServer` calls `fetchMembers(force:true)` the sidebar re-renders. There is no stale-cache or memo bug in the list rendering path that explains missing updates.

## Plan

### Fix A — Ensure members are loaded as soon as a server becomes active (frontend only)

Move the initial member fetch out of `MembersSidebar` so it does not depend on the sidebar being mounted/open.

- In `AppLayout.tsx`, in the existing effect that already conditionally calls `fetchMembers` when the sidebar is open (line 306–315), **always** call `fetchMembers(serverId)` once a `currentServer.id` is present, regardless of sidebar state. Keep it as a lite fetch (no `full: true`) so it's cheap.
- Also re-run it on `currentServer?.id` change, not just on `user?.id` change.
- Remove the `!isMemberSidebarOpen && isMobile` early-return inside `MembersSidebar`'s lazy-load effect so the sidebar still refreshes when reopened, but the source of truth for "members are loaded" is no longer the sidebar.

This restores correct permission evaluation immediately on server entry for non-owners with admin/custom roles.

### Fix B — Restore cached `rolePermissions` on the fast path

In `serverStore.ts` `fetchChannels`, inside the `if (cachedSurface)` block (line 975–987), also read from `rolePermissionsCache.get(serverId)` and, if fresh, `set({ rolePermissions: ... })` when `currentServer?.id === serverId`. Mirror the TTL check used elsewhere (`PERMISSIONS_TTL_MS`).

### Fix C — Cleanup in `MembersSidebar.tsx`

- Remove the unused `fetchRolePermissions` selector (line 407).
- Remove the redundant `useRealtimeMembers(currentServer?.id)` call (line 477). `useRealtimeServer` in `AppLayout` already handles `server_members` / `server_roles` / `server_member_roles` broadcasts and calls `fetchMembers` + `fetchRoles` with the correct `full`/`lite` mode. This reduces duplicate work and removes the `activeServerIds` module-level set that's only needed because of the duplication.

### Out of scope

- No changes to permission evaluation logic (`evaluatePermission`, `useMemberPermissions`).
- No DB / RPC changes.
- No visual/UI changes to the sidebar.

### Files touched

- `src/pages/AppLayout.tsx` — unconditionally trigger initial `fetchMembers` on `currentServer.id` change.
- `src/stores/serverStore.ts` — hydrate `rolePermissions` from cache in `fetchChannels` fast path.
- `src/components/layout/MembersSidebar.tsx` — drop dead `fetchRolePermissions` import and redundant `useRealtimeMembers`; drop mobile-closed gate on the lazy-load effect.
- Optionally `src/hooks/useRealtimeMembers.ts` — left in place if used elsewhere; otherwise delete.
