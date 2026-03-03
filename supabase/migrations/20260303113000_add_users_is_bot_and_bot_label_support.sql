-- Add users.is_bot and expose it through user read surfaces used by chat/profile UI.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.users.is_bot IS 'Marks automated/bot accounts for UI labeling.';

CREATE OR REPLACE VIEW public.users_public
WITH (security_invoker = 'true') AS
SELECT
  id,
  username,
  display_name,
  avatar_url,
  banner_color,
  bio,
  status,
  custom_status,
  created_at,
  avatar_decoration,
  profile_theme_primary,
  profile_theme_accent,
  banner_url,
  profile_effect,
  pronouns,
  CASE
    WHEN (id = (SELECT public.requesting_user_id() AS requesting_user_id)) THEN last_seen
    ELSE NULL::timestamp with time zone
  END AS last_seen,
  is_bot
FROM public.users;

CREATE OR REPLACE FUNCTION public.get_user_by_id(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_user_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
    SELECT json_build_object(
      'id', u.id,
      'username', u.username,
      'display_name', u.display_name,
      'avatar_url', u.avatar_url,
      'banner_url', u.banner_url,
      'avatar_decoration', u.avatar_decoration,
      'profile_effect', u.profile_effect,
      'banner_color', u.banner_color,
      'profile_theme_primary', u.profile_theme_primary,
      'profile_theme_accent', u.profile_theme_accent,
      'bio', u.bio,
      'status', u.status,
      'custom_status', u.custom_status,
      'created_at', u.created_at,
      'last_seen', u.last_seen,
      'is_bot', u.is_bot
    )
    FROM public.users u
    WHERE u.id = _user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_users_basic_secure(
  _user_id uuid,
  _target_user_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.banner_color, u.is_bot
        FROM public.users u
        WHERE u.id = ANY(_target_user_ids)
          AND public.can_view_user(u.id, _user_id)
      ) t
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_profile_secure(
  _target_user_id uuid,
  _requesting_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
    SELECT row_to_json(u)
    FROM (
      SELECT id, username, display_name, avatar_url, banner_url, avatar_decoration, profile_effect,
             banner_color, profile_theme_primary, profile_theme_accent, bio, status,
             custom_status, created_at, last_seen, pronouns, is_bot
      FROM public.users
      WHERE id = _target_user_id
      LIMIT 1
    ) u
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
  _online_cutoff timestamptz;
  _can_manage_invites boolean := false;
BEGIN
  _caller := public.requesting_user_id();
  _online_cutoff := now() - interval '5 minutes';

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  _can_manage_invites := public.check_user_server_permission(_caller, _server_id, 'manage_invites');

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN sm.join_invite_code ELSE NULL END,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_url', u.banner_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            'last_seen', u.last_seen,
            'is_bot', u.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND (
          sm.user_id = _caller
          OR (
            (u.last_seen IS NOT NULL AND u.last_seen >= _online_cutoff)
            OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') <> 'offline')
          )
        )
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_server_members_full_secure(
  _server_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _can_manage_invites boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN '[]'::json;
  END IF;

  _can_manage_invites := public.check_user_server_permission(_user_id, _server_id, 'manage_invites');

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN sm.join_invite_code ELSE NULL END,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_url', u.banner_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            'last_seen', u.last_seen,
            'is_bot', u.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
    ),
    '[]'::json
  );
END;
$function$;

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
AS $function$
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
      AND (
        (u.last_seen IS NOT NULL AND u.last_seen < _online_cutoff)
        OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') = 'offline')
      )
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
    LIMIT _safe_limit + 1
  ),
  page AS (
    SELECT *
    FROM page_source
    ORDER BY joined_at DESC, id DESC
    LIMIT _safe_limit
  ),
  page_tail AS (
    SELECT p.joined_at, p.id
    FROM page p
    ORDER BY p.joined_at ASC, p.id ASC
    LIMIT 1
  )
  SELECT
    COALESCE(
      json_agg(
        json_build_object(
          'id', p.id,
          'server_id', p.server_id,
          'user_id', p.user_id,
          'role', p.role,
          'nickname', p.nickname,
          'is_banned', p.is_banned,
          'is_muted', p.is_muted,
          'joined_at', p.joined_at,
          'join_source', p.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN p.join_invite_code ELSE NULL END,
          'user', json_build_object(
            'id', p.user_public_id,
            'username', p.username,
            'display_name', p.display_name,
            'avatar_url', p.avatar_url,
            'banner_url', p.banner_url,
            'avatar_decoration', p.avatar_decoration,
            'profile_effect', p.profile_effect,
            'banner_color', p.banner_color,
            'profile_theme_primary', p.profile_theme_primary,
            'profile_theme_accent', p.profile_theme_accent,
            'bio', p.bio,
            'status', p.status,
            'custom_status', p.custom_status,
            'created_at', p.user_created_at,
            'last_seen', p.last_seen,
            'is_bot', p.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = p.id
            ),
            '[]'::json
          )
        )
        ORDER BY p.joined_at DESC, p.id DESC
      ),
      '[]'::json
    ),
    EXISTS (SELECT 1 FROM page_source OFFSET _safe_limit),
    (SELECT t.joined_at FROM page_tail t),
    (SELECT t.id FROM page_tail t)
  INTO _members, _has_more, _next_cursor_joined_at, _next_cursor_member_id
  FROM page p;

  IF NOT _has_more THEN
    _next_cursor_joined_at := NULL;
    _next_cursor_member_id := NULL;
  END IF;

  IF _include_count THEN
    SELECT COUNT(*)::integer
      INTO _offline_count
    FROM public.server_members sm
    JOIN public.users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id
      AND COALESCE(sm.is_banned, false) = false
      AND (
        (u.last_seen IS NOT NULL AND u.last_seen < _online_cutoff)
        OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') = 'offline')
      );
  END IF;

  RETURN json_build_object(
    'members', COALESCE(_members, '[]'::json),
    'has_more', COALESCE(_has_more, false),
    'next_cursor_joined_at', _next_cursor_joined_at,
    'next_cursor_member_id', _next_cursor_member_id,
    'offline_count', _offline_count
  );
END;
$function$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
