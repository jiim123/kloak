-- Keep MFA enforced for session restoration without making every legacy RPC
-- depend on the new x-mfa-session header. Most existing authorization checks
-- call verify_request_identity()/requesting_user_id(), so putting MFA there
-- breaks valid logged-in sessions when a request path misses the new header.

CREATE OR REPLACE FUNCTION public.verify_request_identity(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  header_hash text;
  stored_hash text;
BEGIN
  BEGIN
    header_hash := lower(NULLIF(trim(current_setting('request.headers', true)::json->>'x-key-hash'), ''));
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF header_hash IS NULL OR header_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  SELECT ua.key_hash INTO stored_hash
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id;

  RETURN stored_hash IS NOT NULL AND header_hash = lower(stored_hash);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_request_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  key_hash text;
  user_id uuid;
BEGIN
  BEGIN
    key_hash := lower(NULLIF(trim(current_setting('request.headers', true)::json->>'x-key-hash'), ''));
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;

  IF key_hash IS NULL OR key_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN NULL;
  END IF;

  SELECT ua.user_id INTO user_id
  FROM public.user_auth ua
  WHERE ua.key_hash = key_hash
  LIMIT 1;

  RETURN user_id;
END;
$$;
