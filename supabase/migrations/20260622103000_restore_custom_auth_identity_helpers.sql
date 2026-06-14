-- Hotfix: restore custom-auth identity helpers to their pre-MFA semantics.
-- MFA session validation must not live in these helpers because they back nearly
-- every RPC and RLS policy. Keep MFA enforcement in restore_user_session/login.

CREATE OR REPLACE FUNCTION public.get_request_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _key_hash text;
  _user_id uuid;
BEGIN
  _key_hash := current_setting('request.headers', true)::json->>'x-key-hash';
  IF _key_hash IS NULL OR _key_hash = '' THEN
    RETURN NULL;
  END IF;

  SELECT ua.user_id INTO _user_id
  FROM public.user_auth ua
  WHERE ua.key_hash = lower(_key_hash)
  LIMIT 1;

  RETURN _user_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  BEGIN
    RETURN public.get_request_user_id();
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_request_identity(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  header_hash text;
  stored_hash text;
BEGIN
  BEGIN
    header_hash := current_setting('request.headers', true)::json->>'x-key-hash';
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF header_hash IS NULL OR header_hash = '' THEN
    RETURN false;
  END IF;

  SELECT ua.key_hash INTO stored_hash
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN lower(header_hash) = lower(stored_hash);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_request_user_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.requesting_user_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_request_identity(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_request_user_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.requesting_user_id() TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_request_identity(uuid) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
