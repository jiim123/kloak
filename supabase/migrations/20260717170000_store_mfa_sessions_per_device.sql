-- Remember 2FA per device/session instead of keeping a single MFA token on
-- user_auth. The old user_auth columns remain as a compatibility fallback for
-- sessions issued before this migration.

CREATE TABLE IF NOT EXISTS public.user_mfa_sessions (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_mfa_sessions_user_expires_idx
  ON public.user_mfa_sessions (user_id, expires_at DESC);

ALTER TABLE public.user_mfa_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.issue_mfa_session(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  token text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot issue MFA session for null user';
  END IF;

  token := encode(extensions.gen_random_bytes(32), 'hex');

  DELETE FROM public.user_mfa_sessions
  WHERE user_id = _user_id
    AND expires_at <= now();

  INSERT INTO public.user_mfa_sessions (user_id, token_hash, expires_at)
  VALUES (_user_id, public.hash_mfa_session_token(token), now() + interval '30 days');

  RETURN token;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_request_mfa_session_valid(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  headers json;
  session_token text;
  session_token_hash text;
  legacy_token_hash text;
  legacy_expires_at timestamptz;
  has_totp boolean;
BEGIN
  SELECT ua.totp_secret IS NOT NULL,
         ua.mfa_session_token_hash,
         ua.mfa_session_expires_at
  INTO has_totp, legacy_token_hash, legacy_expires_at
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id;

  IF NOT COALESCE(has_totp, false) THEN
    RETURN true;
  END IF;

  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  session_token := NULLIF(trim(headers->>'x-mfa-session'), '');
  IF session_token IS NULL OR session_token !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  session_token_hash := public.hash_mfa_session_token(session_token);

  IF EXISTS (
    SELECT 1
    FROM public.user_mfa_sessions ums
    WHERE ums.user_id = _user_id
      AND ums.token_hash = session_token_hash
      AND ums.expires_at > now()
  ) THEN
    RETURN true;
  END IF;

  RETURN legacy_token_hash IS NOT NULL
     AND legacy_expires_at IS NOT NULL
     AND legacy_expires_at > now()
     AND session_token_hash = legacy_token_hash;
END;
$function$;

CREATE OR REPLACE FUNCTION public.disable_totp(_user_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  current_secret text;
  last_counter bigint;
  verified_counter bigint;
  client_id text;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT ua.totp_secret, ua.totp_last_counter INTO current_secret, last_counter
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id
  FOR UPDATE;

  IF current_secret IS NULL THEN
    DELETE FROM public.user_mfa_sessions WHERE user_id = _user_id;
    RETURN jsonb_build_object('success', true);
  END IF;

  client_id := public.request_client_identifier();
  IF NOT public.check_rate_limit('totp-disable:user:' || _user_id::text, 'totp_disable', 8, 300)
     OR (client_id <> 'unknown' AND NOT public.check_rate_limit('totp-disable:' || client_id, 'totp_disable', 20, 300)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  verified_counter := public.verify_totp_code(current_secret, _code, last_counter);
  IF verified_counter IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.user_auth
  SET totp_secret = NULL,
      totp_pending_secret = NULL,
      totp_enabled_at = NULL,
      totp_last_counter = NULL,
      mfa_session_token_hash = NULL,
      mfa_session_expires_at = NULL
  WHERE user_id = _user_id;

  DELETE FROM public.user_mfa_sessions WHERE user_id = _user_id;

  RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE ALL ON TABLE public.user_mfa_sessions FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_mfa_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_request_mfa_session_valid(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.disable_totp(uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.disable_totp(uuid, text) TO anon, authenticated, service_role;
