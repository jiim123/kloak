-- Enabled bots are server identities, not realtime users. Keep them visible as
-- online members regardless of heartbeat/last_seen aging.

UPDATE public.users u
SET is_bot = true,
    status = 'online'::public.user_status,
    custom_status = COALESCE(NULLIF(u.custom_status, ''), 'Bot'),
    last_seen = now()
FROM public.server_bots b
WHERE b.bot_user_id = u.id
  AND b.is_enabled = true;

INSERT INTO public.server_members (
  server_id,
  user_id,
  role,
  nickname,
  is_banned,
  is_muted,
  join_source
)
SELECT
  b.server_id,
  b.bot_user_id,
  'member'::public.server_role,
  NULL,
  false,
  false,
  'bot'
FROM public.server_bots b
WHERE b.is_enabled = true
ON CONFLICT (server_id, user_id)
DO UPDATE SET
  is_banned = false,
  is_muted = false,
  role = CASE
    WHEN public.server_members.role = 'owner' THEN public.server_members.role
    ELSE 'member'::public.server_role
  END,
  join_source = 'bot';

CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
            'status', CASE WHEN COALESCE(u.is_bot, false) THEN 'online'::public.user_status ELSE u.status END,
            'custom_status', CASE WHEN COALESCE(u.is_bot, false) THEN COALESCE(NULLIF(u.custom_status, ''), 'Bot') ELSE u.custom_status END,
            'created_at', u.created_at,
            'last_seen', CASE WHEN COALESCE(u.is_bot, false) THEN now() ELSE u.last_seen END,
            'is_bot', u.is_bot
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
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND COALESCE(sm.is_banned, false) = false
        AND (
          COALESCE(u.is_bot, false) = true
          OR sm.user_id = _caller
          OR (
            (u.last_seen IS NOT NULL AND u.last_seen >= _online_cutoff)
            OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') <> 'offline')
          )
        )
    ),
    '[]'::json
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_server_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_members(uuid) TO anon, authenticated;

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
            'status', CASE WHEN COALESCE(u.is_bot, false) THEN 'online'::public.user_status ELSE u.status END,
            'custom_status', CASE WHEN COALESCE(u.is_bot, false) THEN COALESCE(NULLIF(u.custom_status, ''), 'Bot') ELSE u.custom_status END,
            'created_at', u.created_at,
            'last_seen', CASE WHEN COALESCE(u.is_bot, false) THEN now() ELSE u.last_seen END,
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
        AND COALESCE(sm.is_banned, false) = false
    ),
    '[]'::json
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_members_full_secure(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_members_full_secure(uuid, uuid) TO anon, authenticated;
