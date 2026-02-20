-- Query performance: Explore servers + friend dashboard
-- 1. get_explore_servers: single query with JOIN to aggregated member counts (replaces slow PostgREST servers + server_members(count))
-- 2. get_friend_dashboard: one RPC returning all friend data (replaces 5 separate RPCs per load)

-- get_explore_servers: published servers with member_count in one efficient query
CREATE OR REPLACE FUNCTION public.get_explore_servers()
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    json_agg(row_to_json(t) ORDER BY t.member_count DESC NULLS LAST, t.created_at DESC NULLS LAST),
    '[]'::json
  )
  FROM (
    SELECT
      s.id,
      s.name,
      s.icon_url,
      s.banner_url,
      s.invite_code,
      s.owner_id,
      s.created_at,
      s.is_published,
      s.about,
      (cnt.c::bigint) AS member_count
    FROM servers s
    LEFT JOIN (
      SELECT server_id, count(*) AS c
      FROM server_members
      WHERE is_banned IS NOT TRUE
      GROUP BY server_id
    ) cnt ON cnt.server_id = s.id
    WHERE s.is_published = true
  ) t;
$$;

COMMENT ON FUNCTION public.get_explore_servers() IS 'Explore page: published servers with member count in one query (avoids N LATERAL joins)';

GRANT EXECUTE ON FUNCTION public.get_explore_servers() TO anon, authenticated;

-- get_friend_dashboard: single RPC returning friends, pending, outgoing, blocked, visibility_blocked (replaces 5 RPCs)
CREATE OR REPLACE FUNCTION public.get_friend_dashboard(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _friends json;
  _pending json;
  _outgoing json;
  _blocked json;
  _visibility_blocked json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Friends (accepted)
  SELECT json_agg(friend) INTO _friends
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', CASE
        WHEN f.requester_id = _user_id THEN (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status) FROM users u WHERE u.id = f.addressee_id)
        ELSE (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status) FROM users u WHERE u.id = f.requester_id)
      END
    ) AS friend
    FROM friendships f
    WHERE (f.requester_id = _user_id OR f.addressee_id = _user_id) AND f.status = 'accepted'
  ) sub;

  -- Pending (incoming)
  SELECT json_agg(request) INTO _pending
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status) FROM users u WHERE u.id = f.requester_id)
    ) AS request
    FROM friendships f
    WHERE f.addressee_id = _user_id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  ) sub;

  -- Outgoing
  SELECT json_agg(request) INTO _outgoing
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status) FROM users u WHERE u.id = f.addressee_id)
    ) AS request
    FROM friendships f
    WHERE f.requester_id = _user_id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  ) sub;

  -- Blocked
  SELECT json_agg(blocked) INTO _blocked
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color) FROM users u WHERE u.id = f.addressee_id)
    ) AS blocked
    FROM friendships f
    WHERE f.requester_id = _user_id AND f.status = 'blocked'
  ) sub;

  -- Visibility blocked IDs
  SELECT COALESCE(json_agg(x.other_user_id), '[]'::json) INTO _visibility_blocked
  FROM (
    SELECT DISTINCT CASE WHEN f.requester_id = _user_id THEN f.addressee_id ELSE f.requester_id END AS other_user_id
    FROM friendships f
    WHERE f.status = 'blocked' AND (f.requester_id = _user_id OR f.addressee_id = _user_id)
  ) x;

  RETURN json_build_object(
    'friends', COALESCE(_friends, '[]'::json),
    'pending_requests', COALESCE(_pending, '[]'::json),
    'outgoing_requests', COALESCE(_outgoing, '[]'::json),
    'blocked_users', COALESCE(_blocked, '[]'::json),
    'visibility_blocked_user_ids', COALESCE(_visibility_blocked, '[]'::json)
  );
END;
$$;

COMMENT ON FUNCTION public.get_friend_dashboard(uuid) IS 'Single RPC for all friend data (replaces 5 separate RPCs per app load)';

GRANT EXECUTE ON FUNCTION public.get_friend_dashboard(uuid) TO anon, authenticated;
