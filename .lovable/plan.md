
# Allow Custom Roles for Server Owners

## Overview
Enable server owners to be assigned custom roles without affecting their owner-level permissions. This allows owners to be grouped under custom roles in the member sidebar while maintaining full administrative access.

## Current Behavior
- The "Roles" dropdown is hidden for owners in Server Settings
- The right-click "Change Roles" menu is blocked for owners in the Members Sidebar
- This is an unnecessary restriction since custom roles are additive, not replacing the base role

## Why This is Safe
The permission evaluation system already handles this correctly:
- In `src/lib/permissions.ts`, the `evaluatePermission` function returns `true` for ALL permissions when `baseRole === 'owner'`
- Custom roles cannot override or reduce owner permissions
- The owner's base role remains "owner" - custom roles are supplementary

## Changes Required

### 1. Server Settings Modal - Members Tab
**File:** `src/components/modals/ServerSettingsModal.tsx`

Remove the `member.role !== "owner"` check from the Roles dropdown condition. The owner can assign custom roles to themselves.

**Current (line 1599):**
```typescript
{canManageRoles && member.user_id !== user?.id && member.role !== "owner" && (
```

**Change to:**
```typescript
{canManageRoles && (member.user_id !== user?.id || member.role === "owner") && (
```

This allows:
- Any member except self (existing behavior)
- OR the owner can manage their own roles (new)

### 2. Members Sidebar - Context Menu
**File:** `src/components/layout/MembersSidebar.tsx`

Update the `canManageRoles` check to allow owners to manage their own custom roles.

**Current (line 306):**
```typescript
const canManageRoles = checkPermission("manage_roles") && canModerate(currentUserRole, member.role) && !isSelf;
```

**Change to:**
```typescript
const canManageRoles = checkPermission("manage_roles") && (canModerate(currentUserRole, member.role) || (isSelf && isServerOwner));
```

This allows:
- Managing roles for members you can moderate (existing)
- OR owners managing their own roles (new)

## What This Enables
1. Server owners can assign custom roles to themselves via Server Settings
2. Owners can right-click themselves in the member sidebar to manage their roles
3. Owners with custom roles will appear in those role groups in the member sidebar
4. Owner permissions remain completely unchanged (always full access)

## Visual Result
Before: Owner always appears in "Online" section
After: Owner with a "VIP" role appears in the "VIP" role group, with crown icon and role color

## Files to Modify
| File | Change |
|------|--------|
| `src/components/modals/ServerSettingsModal.tsx` | Update role dropdown condition |
| `src/components/layout/MembersSidebar.tsx` | Update canManageRoles permission check |
