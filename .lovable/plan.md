

## Consolidate Server Join Flow to Single Component

### Problem
There are two issues:
1. The `CreateServerModal` has its own duplicate join-server logic that is buggy -- banned users can still see/access the server after joining because the store's `joinServer` function refreshes the server list internally before returning, and the error-checking logic has race conditions.
2. Multiple components have independent join flows, making it hard to maintain consistent behavior.

### Solution
Remove the join-server functionality entirely from `CreateServerModal` and instead have it open the existing `JoinServerModal` (which already handles bans correctly). This eliminates all duplicate code and ensures a single source of truth for join logic.

### Changes

**1. `src/components/modals/CreateServerModal.tsx`**
- Remove all join-related code: `joinServerSchema`, `JoinServerForm` type, `joinForm`, `joinError`, `showBannedModal`, `onJoinSubmit`, `handleInviteChange`, the banned modal JSX, and the entire "join" view
- Remove unused imports (`Frown`, `Users` for join icon, `joinServer` from store)
- Change the "Join a Server" button in the "choose" view to call `openModal('join-server')` instead of `setView("join")`, then close the create-server modal
- Remove `"join"` from the `ModalView` type (becomes `"choose" | "create"` only)

**2. `src/components/home/HomeLanding.tsx`**
- Already correct -- the "Join Server" button calls `openModal('join-server')` which opens the `JoinServerModal`. No changes needed.

**3. `src/components/modals/JoinServerModal.tsx`**
- Already handles banned users correctly (checks after `joinServer` returns null). No changes needed.

### Result
- All server-join flows (vertical sidebar, horizontal sidebar, HomeLanding) will use the single `JoinServerModal` component
- Banned users will always see only the banned modal and never be navigated to the server
- The `CreateServerModal` becomes a focused create-only component with an option to open the join modal
