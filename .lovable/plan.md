

# Clean up unused variables in AppLayout.tsx

## Changes

1. **Remove `fetchMembers` and `fetchRolePermissions` from destructuring** (line 95-96): `fetchMembers` is called via `useServerStore.getState().fetchMembers` on line 229, so the destructured binding is unused. `fetchRolePermissions` is not referenced anywhere.

2. **Remove `currentMembership` memo** (lines 127-130): Defined but never used in render or logic.

3. **Remove `isOwner`** (line 132): Defined but never referenced.

4. **Remove `handleMobileBack`** (lines 413-418): Defined but never called.

All removals are safe — no references exist in the rest of the file.

