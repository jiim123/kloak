CREATE OR REPLACE FUNCTION public.server(
  _server_id uuid,
  _user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.get_server_surface_secure(_server_id, _user_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.server(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.server(uuid, uuid) TO anon, authenticated;
