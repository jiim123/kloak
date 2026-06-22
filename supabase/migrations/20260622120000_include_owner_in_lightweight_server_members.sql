-- Always include the server owner in the lightweight member payload so server
-- overview surfaces can resolve the owner's name even while they are offline.
CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
  _owner_id uuid;
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

  SELECT s.owner_id
  INTO _owner_id
  FROM public.servers s
  WHERE s.id = _server_id;

  _can_manage_invites := public.check_user_server_permission(
    _caller,
    _server_id,
    'manage_invites'
  );

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
          'join_invite_code',
            CASE
              WHEN _can_manage_invites THEN sm.join_invite_code
              ELSE NULL
            END,
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
                  'icon', sr.icon,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr
                ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u
        ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND COALESCE(sm.is_banned, false) = false
        AND (
          sm.user_id = _caller
          OR sm.user_id = _owner_id
          OR (
            (
              u.last_seen IS NOT NULL
              AND u.last_seen >= _online_cutoff
            )
            OR (
              u.last_seen IS NULL
              AND COALESCE(u.status::text, 'offline') <> 'offline'
            )
          )
        )
    ),
    '[]'::json
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_members(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_members(uuid) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
