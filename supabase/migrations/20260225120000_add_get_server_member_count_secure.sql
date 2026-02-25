-- Return total (non-banned) member count for a server.
-- This is used by overview surfaces that should show total members,
-- while get_server_members may return an online-filtered subset.

CREATE OR REPLACE FUNCTION public.get_server_member_count_secure(
  _server_id uuid,
  _user_id uuid
)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _count integer;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)::integer
    INTO _count
  FROM public.server_members sm
  WHERE sm.server_id = _server_id
    AND COALESCE(sm.is_banned, false) = false;

  RETURN COALESCE(_count, 0);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_member_count_secure(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_member_count_secure(uuid, uuid) TO anon, authenticated;

