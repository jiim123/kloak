

## Fix: Banned User Toast in Create/Join Server Modal

### Problem
The `CreateServerModal.tsx` component (used by the horizontal server sidebar's "Create or Join Server" flow) was never updated with the banned-user detection logic. When a banned user tries to join, the `joinServer` store function returns `null` and sets a "banned" error, but `CreateServerModal` doesn't check for it -- it just shows a generic error message. Worse, there may be cases where the idempotent RPC returns data, causing a false "Successfully joined server!" toast.

### Root Cause
When the banned modal was added to `JoinServerModal.tsx` and `Invite.tsx`, the `CreateServerModal.tsx` was missed. Its `onJoinSubmit` function (lines 144-168) has no banned-state handling.

### Solution
Apply the same banned-modal pattern from `JoinServerModal.tsx` to `CreateServerModal.tsx`:

1. **Add state**: Add a `showBannedModal` boolean state variable.
2. **Add banned check in `onJoinSubmit`**: After `joinServer` returns `null`, read `useServerStore.getState().error` and check if it contains "banned". If so, set `showBannedModal(true)` instead of showing a generic error.
3. **Add the banned Dialog**: Render the same Frown icon + message modal used in the other components.
4. **Suppress the join dialog while banned modal is open**: Ensure the join form dialog doesn't show behind the banned modal.

### Technical Details

**File: `src/components/modals/CreateServerModal.tsx`**

- Import `Frown` from lucide-react and `Dialog`/`DialogContent` (already imported).
- Add `const [showBannedModal, setShowBannedModal] = useState(false)`.
- Update `onJoinSubmit` (around line 151-163):
  - After `joinServer` returns falsy, check `useServerStore.getState().error` for "banned".
  - If banned, call `setShowBannedModal(true)` instead of setting `joinError`.
- Add the banned modal JSX (Frown icon + text + Close button), same as in `JoinServerModal.tsx`.
- Reset `showBannedModal` in `handleClose`.

No other files need changes -- the store already handles the error correctly.
