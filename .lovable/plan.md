

## Add Bulk Permission Controls

Add "Set All" buttons at the global level and per-group level across all three permission editors.

### Shared Component

Create `src/components/permissions/BulkPermissionButtons.tsx` — a reusable row of Inherit/Deny/Allow buttons with the specified styling. Props: `onSet(value: boolean | null)`, `label?: string` (defaults to "Set all:"). This avoids duplicating the button markup across three editors.

### Changes per Editor

**1. `src/components/modals/RolePermissionsEditor.tsx`**
- Add `handleBulkSet(permissions: Permission[], value: boolean | null)` that loops over the array and calls `handlePermissionChange` for each
- Add `handleGlobalBulkSet(value: boolean | null)` that collects all permissions from all groups
- Add global "Set All Permissions" row inside the ScrollArea, above the first group (uses `BulkPermissionButtons`)
- Add per-group `BulkPermissionButtons` row below each group label
- For global Deny All and Allow All: wrap in `AlertDialog` confirmation ("Are you sure you want to set ALL permissions to Deny/Allow?")
- No confirmation for per-group actions or Inherit All

**2. `src/components/modals/ChannelPermissionsEditor.tsx`**
- Same pattern: `handleBulkSet` loops `handlePermissionChange(selectedRoleKey!, perm, value)` for each permission
- Global row above groups, per-group row below group label
- AlertDialog for global Deny/Allow All

**3. `src/components/modals/CategoryPermissionsEditor.tsx`**
- Identical pattern to Channel editor (uses `selectedRoleKey`)

### Confirmation Dialog

Use the existing `AlertDialog` component from `src/components/ui/alert-dialog.tsx`. State: `confirmAction: { type: 'deny' | 'allow'; permissions: Permission[] } | null`. When user clicks global Deny/Allow All, set this state to show the dialog. On confirm, execute the bulk set and close.

### Technical Details

- Bulk actions only update local state (the `permissionStates` Map). Saving still requires clicking "Save Changes" / "Save Permissions" — no change to save logic.
- Per-group buttons only affect enabled permissions (skip `!meta.enabled` in Channel/Category editors).
- All permissions in `PERMISSION_GROUPS` are included for the global action.

### Files Changed
- **New:** `src/components/permissions/BulkPermissionButtons.tsx`
- **Modified:** `RolePermissionsEditor.tsx`, `ChannelPermissionsEditor.tsx`, `CategoryPermissionsEditor.tsx`

