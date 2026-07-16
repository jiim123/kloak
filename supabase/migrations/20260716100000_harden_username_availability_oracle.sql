-- Close the public username availability oracle. Username collisions are still
-- enforced by register_user behind the captcha-protected edge function.

CREATE OR REPLACE FUNCTION public.check_username_available(_username text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _jwt_role text := nullif(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF COALESCE(_jwt_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'Direct username availability checks are forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF _username IS NULL THEN
    RETURN false;
  END IF;

  _username := lower(trim(_username));

  IF length(_username) < 3 OR length(_username) > 16 THEN
    RETURN false;
  END IF;

  IF _username !~ '^[a-z0-9_-]+$' THEN
    RETURN false;
  END IF;

  IF _username ~ '^[-_]' OR _username ~ '[-_]$' THEN
    RETURN false;
  END IF;

  IF _username ~ '[-_]{2,}' THEN
    RETURN false;
  END IF;

  IF _username ~ '^\d+$' THEN
    RETURN false;
  END IF;

  IF public.is_username_blocked(_username) THEN
    RETURN false;
  END IF;

  RETURN NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE username = _username
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
