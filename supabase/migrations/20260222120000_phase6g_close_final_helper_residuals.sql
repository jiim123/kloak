-- Phase 6G:
-- Close final helper residuals from oracle-surface audit.

-- -------------------------------------------------------------------
-- get_user_by_id: make caller identity check explicit.
-- -------------------------------------------------------------------
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
      'last_seen', u.last_seen
    )
    FROM public.users u
    WHERE u.id = _user_id
  );
END;
$function$;

-- -------------------------------------------------------------------
-- has_private_channel_access: bind requested _user_id to caller identity.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_private_channel_access(_channel_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND public.can_access_channel(_channel_id, _user_id)
$function$;

-- -------------------------------------------------------------------
-- assert_request_user: internal helper, not needed as client-callable RPC.
-- -------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.assert_request_user(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assert_request_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assert_request_user(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.assert_request_user(uuid) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
