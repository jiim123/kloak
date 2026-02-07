

# Fix Channel and Role Permission Syncing Across Devices in Real Time

## Summary

The realtime subscription infrastructure for channels already exists and works (`useRealtimeServer.ts` subscribes to INSERT/UPDATE/DELETE on `channels` and `channel_categories`). The core issues are missing behaviors around those events and missing subscriptions for permission-related tables.

## Issues Found

1. **Channel INSERT blindly adds all channels** -- does not check if the channel is private and if the user has access
2. **Channel DELETE sets currentChannel to null but does not navigate** -- user sees a blank screen instead of being redirected
3. **No toast notification** when a channel the user is viewing gets deleted
4. **No reconnection recovery** -- after a disconnect/reconnect, channels are not re-fetched to catch missed events
5. **No realtime subscription for permission tables** -- changes to `channel_permissions`, `role_permissions`, `channel_members`, or `server_member_roles` do not trigger a re-evaluation of which channels the user can see
6. **No handling when user loses channel access** -- if a role change or permission override removes a user's access to a private channel, it stays in their sidebar

## Implementation Plan

### 1. Fix Channel INSERT Handler -- Private Channel Filtering

**File: `src/hooks/useRealtimeServer.ts`**

When a channel INSERT event arrives and the channel's `is_private` flag is true, check whether the current user is in the `channel_members` table for that channel before adding it to the store. If the user is not a member, skip adding the channel.

- Query `channel_members` table for (channel_id, user_id) match
- Only add the channel to state if the user has access
- Non-private channels continue to be added immediately (current behavior)

### 2. Fix Channel DELETE Handler -- Navigation and Toast

**File: `src/hooks/useRealtimeServer.ts`**

When the current channel is deleted:
- Show a toast: "The channel you were viewing has been deleted"
- Navigate to the first available channel in the server, or the server overview if no channels remain
- This requires passing a navigate callback or using a ref pattern

Implementation approach:
- Add a `useNavigate` import and pass it through, or use a callback ref pattern
- After setting `currentChannel: null`, find the next available channel from the remaining list and navigate to it

### 3. Add Reconnection Recovery

**File: `src/hooks/useRealtimeServer.ts`**

When the `isConnected` state transitions from `false` to `true` (reconnection), trigger a full re-fetch of channels and categories for the current server to catch any changes missed during the disconnect.

- Track previous connection state with a ref
- On reconnect (wasDisconnected -> isConnected), call `fetchChannels(serverId)` and `fetchRolePermissions(serverId)`

### 4. Add Realtime Subscriptions for Permission Tables

**File: `src/hooks/useRealtimeServer.ts`**

Add subscriptions for tables that affect channel visibility and user permissions:

- `channel_permissions` (INSERT/UPDATE/DELETE filtered by channels in this server)
- `role_permissions` (INSERT/UPDATE/DELETE filtered by server_id)
- `server_member_roles` (INSERT/UPDATE/DELETE for the current user)
- `channel_members` (INSERT/DELETE for the current user)

When any of these change, trigger a lightweight refresh:
- Re-fetch `fetchChannels(serverId)` to get the filtered channel list (the RPC already handles private channel filtering)
- Re-fetch `fetchRolePermissions(serverId)` to update permission state

This is simpler and more reliable than trying to incrementally update permissions client-side.

### 5. Handle Permission/Access Revocation

**File: `src/hooks/useRealtimeServer.ts`**

After re-fetching channels due to a permission change:
- Compare the new channel list with the current one
- If the user's `currentChannel` is no longer in the list (access revoked), redirect them to the first available channel
- Show a toast: "You no longer have access to that channel"

### 6. Ensure Realtime Publication for Permission Tables

**Migration file** (if needed):

Check that `channel_permissions`, `role_permissions`, `server_member_roles`, and `channel_members` are in the `supabase_realtime` publication with `REPLICA IDENTITY FULL`. Based on the audit:
- `role_permissions` and `channel_permissions` -- already in publication
- `server_member_roles` -- already in publication  
- `channel_members` -- already has `REPLICA IDENTITY FULL`
- Need to verify `channel_members` is in `supabase_realtime` publication

### 7. Background Sync Enhancement

**File: `src/hooks/useBackgroundSync.ts`**

On reconnection (the `attemptReconnect` success path), also call `fetchChannels` for the current server to ensure stale state is resolved.

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useRealtimeServer.ts` | Add private channel filtering on INSERT, navigation on DELETE, reconnection recovery, permission table subscriptions |
| `src/hooks/useBackgroundSync.ts` | Add channel re-fetch on reconnection |
| One migration file (if needed) | Ensure `channel_members` is in realtime publication |

### Subscription Architecture After Changes

The `useRealtimeServer` hook will subscribe to one Supabase channel (`server:{serverId}`) with these postgres_changes listeners:

- `servers` UPDATE/DELETE (existing)
- `channels` INSERT/UPDATE/DELETE (existing, enhanced handlers)
- `channel_categories` INSERT/UPDATE/DELETE (existing)
- `channel_permissions` INSERT/UPDATE/DELETE (new -- triggers permission refresh)
- `role_permissions` INSERT/UPDATE/DELETE (new -- triggers permission refresh)
- `server_member_roles` INSERT/DELETE (new -- triggers permission refresh)
- `channel_members` INSERT/DELETE (new -- triggers channel list refresh)

Permission-change listeners will be debounced (500ms) to avoid excessive re-fetches when multiple permission rows change at once (e.g., bulk role permission updates).

### No Database Changes Required

All the necessary realtime publications and table configurations are already in place. The fix is entirely client-side logic in the realtime event handlers.

