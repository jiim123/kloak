
# Harden Server-Side Permission Enforcement

## Problem

All RLS policies currently use `USING (true)` / `WITH CHECK (true)` -- meaning any user with the Supabase anon key can directly read, insert, update, or delete any row in any table. Since Kloak uses custom authentication (secret key hashing, not Supabase Auth), `auth.uid()` is always null, so traditional RLS cannot be used.

The critical message RPCs (`send_message`, `edit_message`, `delete_message`, `toggle_pin_message`, reactions, polls) already use the `check_user_permission()` function -- these are protected. However, many other operations bypass RPCs and hit tables directly from the client.

## Current Risk Assessment

**Already Protected (via SECURITY DEFINER RPCs with permission checks):**
- Send/edit/delete messages
- Pin/unpin messages
- Add/remove reactions
- Create/vote on polls
- Join/leave servers
- Register/login

**NOT Protected (direct table mutations, no permission checks):**
- Create/update/delete channels (direct `.from('channels')`)
- Create/update/delete server roles (direct `.from('server_roles')`)
- Assign/remove member roles (direct `.from('server_member_roles')`)
- Update server members (role changes, mute, ban -- direct `.from('server_members')`)
- Update/delete servers (direct `.from('servers')`)
- Manage channel/role/category permissions (direct `.from('channel_permissions')`)
- Insert/delete media items
- Insert/update/delete announcement comments and reactions
- Insert/update/delete thread messages
- Insert/delete server emojis
- Delete notifications (any user's)

## Solution Strategy

Since `auth.uid()` is always null (custom auth), we cannot use RLS for enforcement. The approach is:

1. **Create SECURITY DEFINER RPCs** for all unprotected mutations, with permission checks
2. **Update the client** to call these RPCs instead of direct table operations
3. **Lock down RLS** on write operations to `false` on the most critical tables, forcing all writes through RPCs

We will prioritize by risk level and tackle the most dangerous gaps first.

## Implementation Plan

### Phase 1: Highest Priority -- Channel & Server Management RPCs

**Migration: Create protected RPCs for channel CRUD**

```text
create_channel(server_id, name, type, category_id, ...)
  -> check_user_permission(user_id, server_id, 'manage_channels')

update_channel(channel_id, user_id, name, topic, ...)
  -> check_user_permission(user_id, channel_id, 'manage_channels')

delete_channel(channel_id, user_id)
  -> check_user_permission(user_id, channel_id, 'manage_channels')
```

**Migration: Create protected RPCs for server management**

```text
update_server(server_id, user_id, name, icon_url, ...)
  -> check_user_server_permission(user_id, server_id, 'manage_server')

delete_server(server_id, user_id)
  -> verify user is owner
```

**Client changes:**
- `src/stores/serverStore.ts`: Replace all direct `.from('channels')`, `.from('servers')` mutations with RPC calls

### Phase 2: Role Management RPCs

**Migration: Create protected RPCs for role operations**

```text
create_server_role(server_id, user_id, name, color, icon)
  -> check_user_server_permission(user_id, server_id, 'manage_roles')

update_server_role(role_id, user_id, name, color, icon, position)
  -> check_user_server_permission(user_id, server_id, 'manage_roles')

delete_server_role(role_id, user_id)
  -> check_user_server_permission(user_id, server_id, 'manage_roles')

assign_member_role(member_id, role_id, user_id)
  -> check_user_server_permission(user_id, server_id, 'manage_roles')

remove_member_role(member_id, role_id, user_id)
  -> check_user_server_permission(user_id, server_id, 'manage_roles')
```

**Client changes:**
- `src/stores/serverStore.ts`: Replace `createRole`, `updateRole`, `deleteRole`, `assignRole`, `removeRole` to use RPCs

### Phase 3: Member Management RPCs

**Migration: Create protected RPCs for member operations**

```text
update_member(member_id, actor_user_id, updates)
  -> check role hierarchy (actor must outrank target)
  -> check relevant permission (kick_members, ban_members, mute_members, manage_nicknames)

update_member_role(member_id, actor_user_id, new_role)
  -> verify actor can assign roles and outranks target
```

**Client changes:**
- `src/stores/serverStore.ts`: Replace direct `server_members` updates with RPCs

### Phase 4: Permission Management RPCs

**Migration: Create protected RPCs for permission operations**

```text
set_role_permission(server_id, user_id, permission, role_name/role_id, allowed)
  -> check_user_server_permission(user_id, server_id, 'manage_roles')

set_channel_permission(channel_id, user_id, permission, target_role/target_user, allowed)
  -> check_user_permission(user_id, channel_id, 'manage_channels')

delete_role_permission(permission_id, user_id)
  -> same checks

delete_channel_permission(permission_id, user_id)
  -> same checks
```

**Client changes:**
- `src/stores/serverStore.ts`: Replace direct `role_permissions`, `channel_permissions`, `category_permissions` mutations with RPCs

### Phase 5: Content Tables (Media, Announcements, Threads)

**Migration: Create protected RPCs**

```text
insert_media_item(channel_id, user_id, ...)
  -> check_user_permission(user_id, channel_id, 'send_messages')
  -> check_user_permission(user_id, channel_id, 'attach_files')

delete_media_item(item_id, user_id)
  -> verify ownership or manage_messages permission

insert_announcement_comment(message_id, user_id, content)
  -> check send_messages permission on the announcement's channel

delete_announcement_comment(comment_id, user_id)
  -> verify ownership or manage_messages permission

send_thread_message(thread_id, user_id, content)
  -> check send_messages permission on the thread's channel

edit_thread_message(message_id, user_id, content)
  -> verify ownership + send_messages permission

delete_thread_message(message_id, user_id)
  -> verify ownership or manage_messages permission
```

**Client changes:**
- `src/components/media/MediaChannelArea.tsx`
- `src/components/media/MediaComments.tsx`
- `src/components/announcement/AnnouncementView.tsx`
- `src/components/forum/ForumChannelArea.tsx`

### Phase 6: Server Emoji RPCs

**Migration:**

```text
upload_server_emoji(server_id, user_id, name, file_path)
  -> check_user_server_permission(user_id, server_id, 'manage_emojis')

delete_server_emoji(emoji_id, user_id)
  -> check_user_server_permission(user_id, server_id, 'manage_emojis')
```

**Client changes:**
- `src/components/modals/ServerSettingsModal.tsx`
- `src/components/settings/ServerSettingsPage.tsx`
- `src/components/modals/ImportEmojiPackModal.tsx`

### Phase 7: Lock Down RLS Policies

After all mutations go through RPCs, update RLS on the most critical tables to deny direct writes:

```text
-- Messages: deny direct INSERT/UPDATE/DELETE (force through RPCs)
CREATE POLICY "Deny direct message writes" ON messages
  FOR INSERT WITH CHECK (false);

-- Similar for: channels, servers, server_members, server_roles,
-- role_permissions, channel_permissions, server_member_roles
```

SELECT policies can remain `USING (true)` since reads are not sensitive in this context (users already need the anon key and all data is server-scoped).

### Phase 8: Client Error Handling

**File: `src/lib/errorHandler.ts`**

Update to detect permission errors from RPCs (errors containing "Permission denied" or "do not have permission") and show clear messages. Add a permission cache refresh trigger.

**Files: All stores and components making RPC calls**

Wrap RPC calls with proper error handling that surfaces permission denials to the user.

## Files to Modify

- 6-8 new migration files (one per phase of RPCs)
- `src/stores/serverStore.ts` (major refactor: replace ~20 direct mutations with RPCs)
- `src/components/media/MediaChannelArea.tsx`
- `src/components/media/MediaComments.tsx`
- `src/components/announcement/AnnouncementView.tsx`
- `src/components/forum/ForumChannelArea.tsx`
- `src/components/modals/ServerSettingsModal.tsx`
- `src/components/settings/ServerSettingsPage.tsx`
- `src/components/modals/ImportEmojiPackModal.tsx`
- `src/lib/errorHandler.ts`

## Important Notes

- All new RPCs will be `SECURITY DEFINER` with `SET search_path = public` to bypass permissive RLS
- Every RPC will validate the acting user is a non-banned server member before any operation
- The `check_user_permission` and `check_user_server_permission` functions are already battle-tested and handle the full permission hierarchy
- This is a large change -- we should implement in phases and test after each phase
- SELECT/read operations remain open since the custom auth model requires it for realtime subscriptions
