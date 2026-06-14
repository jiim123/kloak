-- Rate-limit TOTP verification paths that are reachable after custom-auth
-- identity has been established. This prevents online brute force against
-- enrollment confirmation, TOTP disable, and login-key reset, and caps
-- enrollment-start churn.

CREATE OR REPLACE FUNCTION public.begin_totp_enrollment(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  secret text;
  username text;
  client_id text;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  client_id := public.request_client_identifier();
  IF NOT public.check_rate_limit('totp-begin:user:' || _user_id::text, 'totp_begin', 6, 3600)
     OR (client_id <> 'unknown' AND NOT public.check_rate_limit('totp-begin:' || client_id, 'totp_begin', 30, 3600)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  secret := public.base32_encode_bytes(extensions.gen_random_bytes(20));

  UPDATE public.user_auth
  SET totp_pending_secret = secret
  WHERE user_id = _user_id;

  SELECT u.username INTO username
  FROM public.users u
  WHERE u.id = _user_id;

  RETURN jsonb_build_object(
    'secret', secret,
    'otpauth_uri',
    'otpauth://totp/Kloak:' || replace(COALESCE(username, _user_id::text), ' ', '%20') ||
      '?secret=' || secret || '&issuer=Kloak&algorithm=SHA1&digits=6&period=30'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.confirm_totp_enrollment(_user_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  pending_secret text;
  verified_counter bigint;
  session_token text;
  client_id text;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT ua.totp_pending_secret INTO pending_secret
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id
  FOR UPDATE;

  IF pending_secret IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'no_pending_enrollment');
  END IF;

  client_id := public.request_client_identifier();
  IF NOT public.check_rate_limit('totp-confirm:user:' || _user_id::text, 'totp_confirm', 8, 300)
     OR (client_id <> 'unknown' AND NOT public.check_rate_limit('totp-confirm:' || client_id, 'totp_confirm', 20, 300)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'rate_limited');
  END IF;

  verified_counter := public.verify_totp_code(pending_secret, _code, NULL);
  IF verified_counter IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.user_auth
  SET totp_secret = pending_secret,
      totp_pending_secret = NULL,
      totp_enabled_at = now(),
      totp_last_counter = verified_counter
  WHERE user_id = _user_id;

  session_token := public.issue_mfa_session(_user_id);
  RETURN jsonb_build_object('success', true, 'mfa_session_token', session_token);
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

  RETURN jsonb_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_user_secret_key(_user_id uuid, _new_key_hash character, _totp_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_last_reset timestamptz;
  v_cooldown_hours int := 24;
  v_time_remaining interval;
  v_totp_secret text;
  v_totp_last_counter bigint;
  v_verified_counter bigint;
  client_id text;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _new_key_hash IS NULL OR _new_key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid key hash format';
  END IF;

  SELECT ua.totp_secret, ua.totp_last_counter, ua.last_key_reset_at
  INTO v_totp_secret, v_totp_last_counter, v_last_reset
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id
  FOR UPDATE;

  IF v_totp_secret IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'mfa_required');
  END IF;

  client_id := public.request_client_identifier();
  IF NOT public.check_rate_limit('totp-reset-key:user:' || _user_id::text, 'totp_reset_key', 8, 300)
     OR (client_id <> 'unknown' AND NOT public.check_rate_limit('totp-reset-key:' || client_id, 'totp_reset_key', 20, 300)) THEN
    RETURN json_build_object('success', false, 'error', 'rate_limited');
  END IF;

  v_verified_counter := public.verify_totp_code(v_totp_secret, _totp_code, v_totp_last_counter);
  IF v_verified_counter IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'invalid_totp');
  END IF;

  IF v_last_reset IS NOT NULL
     AND v_last_reset > (now() - (v_cooldown_hours || ' hours')::interval) THEN
    v_time_remaining := v_last_reset + (v_cooldown_hours || ' hours')::interval - now();
    RETURN json_build_object(
      'success', false,
      'error', 'cooldown',
      'cooldown_ends_at', v_last_reset + (v_cooldown_hours || ' hours')::interval,
      'hours_remaining', extract(epoch from v_time_remaining) / 3600
    );
  END IF;

  UPDATE public.user_auth
  SET key_hash = lower(_new_key_hash::text),
      totp_last_counter = v_verified_counter,
      last_key_reset_at = now()
  WHERE user_id = _user_id;

  RETURN json_build_object('success', true, 'last_key_reset_at', now());
END;
$function$;

CREATE OR REPLACE FUNCTION public.reset_user_secret_key(_user_id uuid, _new_key_hash character)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT public.reset_user_secret_key(_user_id, _new_key_hash, NULL);
$function$;

REVOKE EXECUTE ON FUNCTION public.begin_totp_enrollment(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_totp_enrollment(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.disable_totp(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.begin_totp_enrollment(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_totp_enrollment(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.disable_totp(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character, text) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
