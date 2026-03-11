CREATE OR REPLACE FUNCTION public.get_server_surface_secure(
  _server_id uuid,
  _user_id uuid DEFAULT NULL::uuid
)
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
    RETURN json_build_object(
      'categories', '[]'::json,
      'channels', '[]'::json
    );
  END IF;

  RETURN json_build_object(
    'categories', COALESCE(public.get_server_categories(_server_id, _caller), '[]'::json),
    'channels', COALESCE(public.get_server_channels(_server_id, _caller), '[]'::json)
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_surface_secure(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_surface_secure(uuid, uuid) TO anon, authenticated;
