

## Audit: Role Permission System — Issues Found

### Summary of Issues

After a thorough audit of the DB functions (`check_user_permission`, `check_user_server_permission`), the frontend evaluation (`evaluatePermission` in `src/lib/permissions.ts`), and how permissions are consumed across the app, here are the problems identified:

---

### Issue 1: `check_user_server_permission` Has No Base Role Defaults (Critical)

The `check_user_server_permission` function (used for server-level actions like `manage_channels`, `manage_roles`, `kick_members`, `ban_members`, etc.) falls through to `RETURN false` when no explicit `role_permissions` rows exist. This means:

- An **admin** with no custom roles and no explicit `role_permissions` rows will be **denied** `manage_channels`, `manage_roles`, etc.
- A **moderator** will be denied `kick_members`, `mute_members`, `manage_messages`, etc.

**`check_user_permission`** (channel-scoped) has proper CASE defaults (lines 1810-1842), but **`check_user_server_permission`** does not — it just returns `false`.

**Fix:** Add the same CASE fallback defaults from `check_user_permission` to `check_user_server_permission` before the final `RETURN false`.

---

### Issue 2: `check_user_server_permission` Doesn't Check `@everyone` Role via `server_member_roles` (Minor)

The function looks up `@everyone` role separately (correct), but the main query joins `role_permissions` with `server_member_roles` — members are not automatically assigned the `@everyone` role in `server_member_roles`, so this join would miss the `@everyone` role. The separate fallback check for `_everyone_role_id` handles this, so this is working correctly.

---

### Issue 3: `view_channels` Not Enforced in `get_server_channels` (Previously Identified)

`get_server_channels` only checks `is_private` + `channel_members`. It never calls `check_user_permission` for `view_channels`. Setting `view_channels` to deny on a role or channel override has no effect.

**Fix:** Add `check_user_permission(_user_id, c.id, 'view_channels')` filter to the channel query in `get_server_channels`.

---

### Issue 4: `read_message_history` Not Enforced at DB Level

No RPC or RLS policy checks `read_message_history`. The messages SELECT RLS uses `can_access_channel` which checks membership/private but not the `read_message_history` permission.

**Fix:** This is lower priority since it's uncommon, but should be added to the messages SELECT policy or the message-fetching RPCs.

---

### Issue 5: Frontend `Permission` Type Missing Task Permissions

The DB enum includes `view_tasks`, `create_tasks`, `edit_own_tasks`, `edit_all_tasks`, `assign_tasks`, `change_task_status`, `delete_tasks` but the frontend `Permission` type in `src/types/index.ts` doesn't include them. This means task permissions can't be configured via the role permission UI.

**Fix:** Add task permissions to the frontend `Permission` type and the permission meta/groups.

---

### Issue 6: Frontend Base Role Defaults Don't Include All Permissions

The frontend `evaluatePermission` defaults for `moderator` and `member` are mostly correct but should be cross-checked against the DB. Comparison:

| Permission | DB (check_user_permission) | Frontend (moderator) | Frontend (member) |
|---|---|---|---|
| `manage_emojis` | admin | Not in list (correct) | Not in list (correct) |
| `manage_webhooks` | admin | Not in list (correct) | Not in list (correct) |
| `manage_threads` | moderator | Not in list (**MISSING**) | Not in list (correct) |

Wait — `manage_threads` IS in the moderator list. Let me re-check... No, it is NOT in the frontend moderator defaults. The DB says moderators get `manage_threads`, but the frontend moderator list doesn't include it.

Actually checking again: the frontend moderator list does NOT include `manage_threads`. But the DB defaults DO include it (`WHEN 'manage_threads' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator')`). This is a **mismatch**.

Additionally, the frontend moderator defaults don't include `manage_emojis` or `manage_webhooks`, matching the DB. Good.

---

### Plan

#### 1. SQL Migration: Add base role defaults to `check_user_server_permission`

Add the same CASE fallback that `check_user_permission` has, so server-level permission checks work for admins/moderators without explicit `role_permissions` rows.

#### 2. SQL Migration: Add `view_channels` enforcement to `get_server_channels`

Filter channels through `check_user_permission(_user_id, c.id, 'view_channels')`, with owner/admin bypass.

#### 3. Frontend: Fix `evaluatePermission` moderator defaults

Add `manage_threads` to the moderator allowed list to match DB defaults.

#### 4. Frontend: Add task permissions to `Permission` type (optional, lower priority)

Add the 7 task permissions to `src/types/index.ts` and `permissionMeta.ts`.

#### Files to Change

- **New SQL migration**: Update `check_user_server_permission` with base role defaults; update `get_server_channels` with `view_channels` filter
- **`src/lib/permissions.ts`**: Add `manage_threads` to moderator defaults
- **`src/types/index.ts`**: Add task permission types (optional)
- **`src/lib/permissionMeta.ts`**: Add task permission metadata (optional)

