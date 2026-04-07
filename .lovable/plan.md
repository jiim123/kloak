

## Fix layout shift on channel/server switching

### Problem
Two issues cause jumpy renders when switching servers/channels:

1. **`setCurrentServer()` clears `members: []` immediately**, causing all member-dependent UI (avatars, role colors, nicknames) to flash empty before `fetchMembers` restores data from the existing cache. The cache infrastructure (`membersCache` + sessionStorage) already exists — the problem is just the Zustand state being wiped to `[]` before it's consulted.

2. **`useMessageUser` fetches missing users one-by-one** with individual `get_user_by_id` RPC calls. When switching servers, 30+ message authors trigger 30 separate network requests, causing avatars to pop in sequentially.

### Changes

#### 1. Database migration: Create `get_users_by_ids` RPC
Create a new SECURITY DEFINER function that accepts an array of UUIDs and returns all matching users in one query. Mirrors `get_user_by_id` field selection, includes `can_view_user` filtering, caps input at 100 IDs.

```sql
CREATE OR REPLACE FUNCTION public.get_users_by_ids(_user_ids uuid[])
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF array_length(_user_ids, 1) > 100 THEN
    RAISE EXCEPTION 'Too many user IDs (max 100)';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_data), '[]'::json)
    FROM (
      SELECT json_build_object(
        'id', u.id, 'username', u.username,
        'display_name', u.display_name, 'avatar_url', u.avatar_url,
        'banner_url', u.banner_url, 'avatar_decoration', u.avatar_decoration,
        'profile_effect', u.profile_effect, 'banner_color', u.banner_color,
        'profile_theme_primary', u.profile_theme_primary,
        'profile_theme_accent', u.profile_theme_accent,
        'bio', u.bio, 'status', u.status, 'custom_status', u.custom_status,
        'created_at', u.created_at, 'last_seen', u.last_seen, 'is_bot', u.is_bot
      ) AS row_data
      FROM public.users u
      WHERE u.id = ANY(_user_ids)
        AND public.can_view_user(u.id, _caller)
    ) sub
  );
END;
$$;
```

#### 2. `src/stores/userCacheStore.ts` — Batch-fetch with single RPC
Replace the individual `fetchAndCacheUser` calls in `useMessageUser` with a batched mechanism:
- Collect missing user IDs over a 16ms window (one animation frame)
- Fire a single `get_users_by_ids` RPC call
- Upsert all results via `bulkSetUsersInCache`
- Remove the `autoFetchingIds` set; use the pending batch set instead

#### 3. `src/stores/serverStore.ts` — Restore cached members immediately in `setCurrentServer`
Instead of setting `members: []`, check `getCachedMembers()` for the target server and restore that data immediately. This prevents the empty flash while `fetchMembers` runs in the background.

```typescript
// In setCurrentServer, before set():
const userId = useAuthStore.getState().user?.id ?? null;
const cached = getCachedMembers(server.id, 'lite', userId);

set({
  currentServer: server,
  currentChannel: null,
  channels: [],
  categories: [],
  members: cached ? cached.members : [],
  membersServerId: cached ? server.id : null,
  membersFetchMode: cached ? 'lite' : null,
  roles: [],  // roles also restored below
  rolePermissions: [],
  channelPermissions: [],
  categoryPermissions: [],
  isMembersLoading: !cached,
});
```

Also restore `roles` from the existing `serverRolesCache` if available (same pattern — check cache, restore if fresh).

#### 4. `src/stores/serverStore.ts` — Cap `membersCache` size
The `membersCache` Map already exists but has no size limit. After each `setCachedMembers` call, evict entries beyond 5 servers (10 keys max since lite+full per server). Evict by oldest `cachedAt`.

#### 5. `src/components/layout/ChatArea.tsx` — Remove NoChannelPlaceholder animations
Replace `motion.div` with plain `div` in `NoChannelPlaceholder` to eliminate fade-in flashes during the brief null-channel transitional state.

### Summary
- **1 migration**: `get_users_by_ids` RPC for batch user fetching
- **userCacheStore**: Batch missing user IDs into one RPC call per frame
- **serverStore**: Restore cached members/roles instantly on server switch; cap cache at 5 servers
- **ChatArea**: Remove animations from the transitional placeholder

