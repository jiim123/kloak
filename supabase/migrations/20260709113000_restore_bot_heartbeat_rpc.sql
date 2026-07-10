-- Restore bot heartbeat RPC used by external bot runners.
--
-- This RPC lets a bot account keep its presence fresh without granting direct
-- table writes. Identity is bound to the x-key-hash request header through the
-- existing custom-auth helpers.

CREATE OR REPLACE FUNCTION public.bot_heartbeat(_bot_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _updated_count integer;
BEGIN
  IF _bot_user_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.verify_request_identity(_bot_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  UPDATE public.users
  SET status = 'online'::public.user_status,
      last_seen = now()
  WHERE id = _bot_user_id
    AND is_bot = true;

  GET DIAGNOSTICS _updated_count = ROW_COUNT;
  RETURN _updated_count = 1;
END;
$function$;

CREATE OR REPLACE FUNCTION public.bot_heartbeat()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _bot_user_id uuid;
BEGIN
  _bot_user_id := public.requesting_user_id();
  IF _bot_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.bot_heartbeat(_bot_user_id);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.bot_heartbeat(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.bot_heartbeat() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.bot_heartbeat(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bot_heartbeat() TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
