-- Harden legacy server governance read surfaces:
-- 1) Bind legacy read RPCs to request identity + membership checks.
-- 2) Remove direct REST SELECT on governance permission tables.

CREATE OR REPLACE FUNCTION public.get_server_categories(_server_id uuid, _user_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _user_id IS NOT NULL AND _user_id <> _caller THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', cc.id,
          'server_id', cc.server_id,
          'name', cc.name,
          'position', cc.position,
          'is_collapsed', cc.is_collapsed,
          'created_at', cc.created_at
        )
        ORDER BY cc.position
      ),
      '[]'::json
    )
    FROM public.channel_categories cc
    WHERE cc.server_id = _server_id
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
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

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
          'join_invite_code', sm.join_invite_code,
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
            'last_seen', u.last_seen
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

CREATE OR REPLACE FUNCTION public.get_channel_members(_channel_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  RETURN (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', cm.id,
          'channel_id', cm.channel_id,
          'user_id', cm.user_id,
          'added_by', cm.added_by,
          'created_at', cm.created_at,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'status', u.status
          )
        )
      ),
      '[]'::json
    )
    FROM public.channel_members cm
    JOIN public.users u ON u.id = cm.user_id
    WHERE cm.channel_id = _channel_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_channel_server_id(_channel_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
  _server_id uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RETURN NULL;
  END IF;

  SELECT c.server_id INTO _server_id
  FROM public.channels c
  WHERE c.id = _channel_id;

  RETURN _server_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_channel_permissions(_channel_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'channel_id', cp.channel_id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'user_id', cp.user_id,
          'permission', cp.permission,
          'allowed', cp.allowed,
          'created_at', cp.created_at
        )
        ORDER BY cp.created_at ASC
      )
      FROM public.channel_permissions cp
      WHERE cp.channel_id = _channel_id
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_role_permissions(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', rp.id,
          'server_id', rp.server_id,
          'role_id', rp.role_id,
          'role_name', rp.role_name,
          'permission', rp.permission,
          'allowed', rp.allowed,
          'created_at', rp.created_at
        )
        ORDER BY rp.created_at ASC
      )
      FROM public.role_permissions rp
      WHERE rp.server_id = _server_id
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_category_permissions(_category_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_category_server_member(_category_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'category_id', cp.category_id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'user_id', cp.user_id,
          'permission', cp.permission,
          'allowed', cp.allowed,
          'created_at', cp.created_at
        )
        ORDER BY cp.created_at ASC
      )
      FROM public.category_permissions cp
      WHERE cp.category_id = _category_id
    ),
    '[]'::json
  );
END;
$function$;

REVOKE SELECT ON TABLE public.channel_permissions FROM anon, authenticated;
REVOKE SELECT ON TABLE public.role_permissions FROM anon, authenticated;
REVOKE SELECT ON TABLE public.category_permissions FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_channel_permissions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_role_permissions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_category_permissions(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_channel_members(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_channel_server_id(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_server_members(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_server_categories(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_channel_permissions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_role_permissions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_permissions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_channel_members(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_channel_server_id(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_members(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_categories(uuid, uuid) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
