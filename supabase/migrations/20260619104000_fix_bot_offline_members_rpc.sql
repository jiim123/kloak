-- Fix offline member pagination after bot member changes.
-- The previous override referenced offline_base outside its CTE scope when
-- _include_count = true, causing the first offline-section expansion to fail.

CREATE OR REPLACE FUNCTION public.get_server_members_offline_page_secure(
  _server_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 100,
  _cursor_joined_at timestamptz DEFAULT NULL,
  _cursor_member_id uuid DEFAULT NULL,
  _include_count boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _safe_limit integer;
  _online_cutoff timestamptz;
  _offline_count integer := NULL;
  _members json := '[]'::json;
  _has_more boolean := false;
  _next_cursor_joined_at timestamptz := NULL;
  _next_cursor_member_id uuid := NULL;
  _can_manage_invites boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN json_build_object(
      'members', '[]'::json,
      'has_more', false,
      'next_cursor_joined_at', NULL,
      'next_cursor_member_id', NULL,
      'offline_count', 0
    );
  END IF;

  _can_manage_invites := public.check_user_server_permission(_user_id, _server_id, 'manage_invites');
  _safe_limit := LEAST(GREATEST(COALESCE(_limit, 100), 1), 200);
  _online_cutoff := now() - interval '5 minutes';

  WITH offline_base AS (
    SELECT
      sm.id,
      sm.server_id,
      sm.user_id,
      sm.role,
      sm.nickname,
      sm.is_banned,
      sm.is_muted,
      sm.joined_at,
      sm.join_source,
      sm.join_invite_code,
      u.id AS user_public_id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.banner_url,
      u.avatar_decoration,
      u.profile_effect,
      u.banner_color,
      u.profile_theme_primary,
      u.profile_theme_accent,
      u.bio,
      u.status,
      u.custom_status,
      u.created_at AS user_created_at,
      u.last_seen,
      u.is_bot
    FROM public.server_members sm
    JOIN public.users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id
      AND COALESCE(sm.is_banned, false) = false
      AND COALESCE(u.is_bot, false) = false
      AND (
        (u.last_seen IS NOT NULL AND u.last_seen < _online_cutoff)
        OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') = 'offline')
      )
  ),
  offline_total AS (
    SELECT CASE WHEN _include_count THEN count(*)::integer ELSE NULL::integer END AS offline_count
    FROM offline_base
  ),
  page_source AS (
    SELECT *
    FROM offline_base b
    WHERE (
      _cursor_joined_at IS NULL
      OR (b.joined_at, b.id) < (
        _cursor_joined_at,
        COALESCE(_cursor_member_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
      )
    )
    ORDER BY b.joined_at DESC, b.id DESC
    LIMIT (_safe_limit + 1)
  ),
  page_rows AS (
    SELECT *
    FROM page_source
    ORDER BY joined_at DESC, id DESC
    LIMIT _safe_limit
  ),
  page_json AS (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', pr.id,
          'server_id', pr.server_id,
          'user_id', pr.user_id,
          'role', pr.role,
          'nickname', pr.nickname,
          'is_banned', pr.is_banned,
          'is_muted', pr.is_muted,
          'joined_at', pr.joined_at,
          'join_source', pr.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN pr.join_invite_code ELSE NULL END,
          'user', json_build_object(
            'id', pr.user_public_id,
            'username', pr.username,
            'display_name', pr.display_name,
            'avatar_url', pr.avatar_url,
            'banner_url', pr.banner_url,
            'avatar_decoration', pr.avatar_decoration,
            'profile_effect', pr.profile_effect,
            'banner_color', pr.banner_color,
            'profile_theme_primary', pr.profile_theme_primary,
            'profile_theme_accent', pr.profile_theme_accent,
            'bio', pr.bio,
            'status', pr.status,
            'custom_status', pr.custom_status,
            'created_at', pr.user_created_at,
            'last_seen', pr.last_seen,
            'is_bot', pr.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'icon', sr.icon,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = pr.id
            ),
            '[]'::json
          )
        )
      ),
      '[]'::json
    ) AS members
    FROM page_rows pr
  ),
  cursor_row AS (
    SELECT joined_at, id
    FROM page_rows
    ORDER BY joined_at ASC, id ASC
    LIMIT 1
  )
  SELECT
    pj.members,
    EXISTS(SELECT 1 FROM page_source OFFSET _safe_limit),
    cr.joined_at,
    cr.id,
    ot.offline_count
  INTO _members, _has_more, _next_cursor_joined_at, _next_cursor_member_id, _offline_count
  FROM page_json pj
  CROSS JOIN offline_total ot
  LEFT JOIN cursor_row cr ON true;

  RETURN json_build_object(
    'members', COALESCE(_members, '[]'::json),
    'has_more', COALESCE(_has_more, false),
    'next_cursor_joined_at', _next_cursor_joined_at,
    'next_cursor_member_id', _next_cursor_member_id,
    'offline_count', _offline_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_server_members_offline_page_secure(uuid, uuid, integer, timestamptz, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_members_offline_page_secure(uuid, uuid, integer, timestamptz, uuid, boolean) TO anon, authenticated;
