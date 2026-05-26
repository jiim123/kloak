## Audit findings

**Presence does NOT get re-activated by toggling the member sidebar** — the realtime presence subscription (`useRealtimeUsers()`) is mounted once at `src/pages/AppLayout.tsx:300` and runs for the whole session regardless of sidebar visibility.

**However, the perceived bug is real and traceable:** on desktop, `MembersSidebar` is conditionally mounted in `AppLayout.tsx:955-959` (`{isMemberSidebarOpen && <MembersSidebar />}`). Every toggle fully unmounts and remounts the component, which:
- Resets local state (`isOfflineExpanded`, `totalMemberCount`, `offlineMembers`, cursors).
- Re-reads each member's presence from `userCacheStore` on first render — causing visible flicker / status dots changing color or re-appearing as the cache is consulted again.
- Re-triggers the cached member-count fetch effect (line 490).

That mount/unmount cycle is why users feel like presence is "activated" on every toggle.

## Changes

### 1. Keep `MembersSidebar` mounted on desktop
In `src/pages/AppLayout.tsx`, replace the conditional render with a permanently mounted container whose width collapses to 0 when closed:

```tsx
{!isDMView && !isProfileView && (
  <div
    className={cn(
      "shrink-0 overflow-hidden transition-[width] duration-200",
      isMemberSidebarOpen ? "w-[304px]" : "w-0"
    )}
  >
    <MembersSidebar />
  </div>
)}
```

This preserves local state and presence rendering across toggles, eliminating the flicker.

### 2. Offline section behavior in `src/components/layout/MembersSidebar.tsx`

- Add a constant `OFFLINE_AUTO_HIDE_THRESHOLD = 1000`.
- Change default of `isOfflineExpanded` from `false` to `true`, so users that go offline automatically appear in the section without requiring a click.
- Once `totalMemberCount` is known and `> 1000`, force collapse and skip auto-loading offline pages (display becomes opt-in via the existing chevron toggle). Implementation:
  - Initialize `useState(true)`.
  - Add a `useEffect` watching `totalMemberCount`: when it transitions above the threshold and the user hasn't manually interacted, set expanded to `false`.
  - Track a `userManuallyToggledOfflineRef` so we don't override the user's explicit choice.
- When expanded by default, trigger `loadOfflineMembers({ reset: true })` on first mount/server-change (gated by the same threshold).

### 3. No backend changes required
The existing `get_server_members_offline_page_secure` RPC and pagination logic remain unchanged.

## Files touched
- `src/pages/AppLayout.tsx` — keep MembersSidebar mounted, collapse via width.
- `src/components/layout/MembersSidebar.tsx` — default offline expanded, auto-collapse above 1000 members, auto-load offline page on mount when expanded.