ALTER TABLE public.user_auth
  ADD COLUMN IF NOT EXISTS mfa_session_token_hash text,
  ADD COLUMN IF NOT EXISTS mfa_session_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.hash_mfa_session_token(_token text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT encode(extensions.digest(convert_to(_token, 'UTF8'), 'sha256'), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.issue_mfa_session(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  token text;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Cannot issue MFA session for null user';
  END IF;

  token := encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.user_auth
  SET mfa_session_token_hash = public.hash_mfa_session_token(token),
      mfa_session_expires_at = now() + interval '30 days'
  WHERE user_id = _user_id;

  RETURN token;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_request_mfa_session_valid(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  headers json;
  session_token text;
  stored_token_hash text;
  expires_at timestamptz;
  has_totp boolean;
BEGIN
  SELECT ua.totp_secret IS NOT NULL,
         ua.mfa_session_token_hash,
         ua.mfa_session_expires_at
  INTO has_totp, stored_token_hash, expires_at
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
  IF session_token IS NULL
     OR session_token !~ '^[a-f0-9]{64}$'
     OR stored_token_hash IS NULL
     OR expires_at IS NULL
     OR expires_at <= now() THEN
    RETURN false;
  END IF;

  RETURN public.hash_mfa_session_token(session_token) = stored_token_hash;
END;
$$;

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

  IF stored_hash IS NULL OR header_hash <> lower(stored_hash) THEN
    RETURN false;
  END IF;

  RETURN public.current_request_mfa_session_valid(_user_id);
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

  IF user_id IS NULL OR NOT public.current_request_mfa_session_valid(user_id) THEN
    RETURN NULL;
  END IF;

  RETURN user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.perform_login_user(
  _key_hash text,
  _totp_code text DEFAULT NULL,
  _require_totp boolean DEFAULT true
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  result json;
  _user_id uuid;
  _dummy_hash text := 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  _client_id text;
  _key_bucket text;
  _punishment record;
  _totp_secret text;
  _totp_last_counter bigint;
  _verified_counter bigint;
  _mfa_session_token text;
BEGIN
  _client_id := public.request_client_identifier();

  IF _key_hash IS NULL OR length(_key_hash) != 64 OR _key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    IF _client_id <> 'unknown'
       AND NOT public.check_rate_limit(_client_id, 'login_user_invalid', 30, 60) THEN
      RAISE EXCEPTION 'Rate limited: login temporarily blocked';
    END IF;
    PERFORM pg_sleep(0.1);
    RETURN NULL;
  END IF;

  _key_hash := lower(_key_hash);
  _key_bucket := left(_key_hash, 16);
  IF NOT public.check_rate_limit(_key_bucket, 'login_user_keyhash', 20, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many login attempts';
  END IF;

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'login_user_client', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many login attempts';
  END IF;

  SELECT ua.user_id, ua.totp_secret, ua.totp_last_counter
  INTO _user_id, _totp_secret, _totp_last_counter
  FROM public.user_auth ua
  WHERE ua.key_hash = _key_hash
  LIMIT 1
  FOR UPDATE;

  IF _user_id IS NULL THEN
    PERFORM key_hash FROM public.user_auth WHERE key_hash = _dummy_hash LIMIT 1;
    RETURN NULL;
  END IF;

  IF _totp_secret IS NOT NULL THEN
    IF _require_totp THEN
      IF COALESCE(_totp_code, '') = '' THEN
        RETURN json_build_object('mfa_required', true);
      END IF;

      IF NOT public.check_rate_limit(_key_bucket, 'login_user_totp', 8, 300) THEN
        RAISE EXCEPTION 'Rate limited: too many verification attempts';
      END IF;

      _verified_counter := public.verify_totp_code(_totp_secret, _totp_code, _totp_last_counter);
      IF _verified_counter IS NULL THEN
        RETURN json_build_object('mfa_required', true, 'mfa_error', 'invalid_code');
      END IF;

      UPDATE public.user_auth
      SET totp_last_counter = _verified_counter
      WHERE user_id = _user_id;

      _mfa_session_token := public.issue_mfa_session(_user_id);
    ELSIF NOT public.current_request_mfa_session_valid(_user_id) THEN
      RETURN json_build_object('mfa_required', true);
    END IF;
  END IF;

  SELECT action_type, expires_at INTO _punishment
  FROM public.user_punishments
  WHERE user_id = _user_id
    AND revoked_at IS NULL
    AND action_type IN ('suspend', 'ban')
    AND acknowledged_at IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY starts_at DESC
  LIMIT 1;

  IF _punishment.action_type = 'ban' THEN
    RAISE EXCEPTION 'Account banned';
  ELSIF _punishment.action_type = 'suspend' THEN
    RAISE EXCEPTION 'Account suspended until %', _punishment.expires_at;
  END IF;

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
    'allow_nsfw', u.allow_nsfw,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  IF result IS NULL THEN
    RETURN NULL;
  END IF;

  IF _mfa_session_token IS NOT NULL THEN
    result := (result::jsonb || jsonb_build_object('mfa_session_token', _mfa_session_token))::json;
  END IF;

  UPDATE public.users
  SET status = 'online',
      last_seen = now()
  WHERE id = _user_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_totp_enrollment(_user_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  pending_secret text;
  verified_counter bigint;
  session_token text;
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
$$;

CREATE OR REPLACE FUNCTION public.disable_totp(_user_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  current_secret text;
  last_counter bigint;
  verified_counter bigint;
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
$$;

REVOKE EXECUTE ON FUNCTION public.hash_mfa_session_token(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.issue_mfa_session(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_request_mfa_session_valid(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.perform_login_user(text, text, boolean) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.login_user(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.login_user_with_totp(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_user_session(text) TO anon, authenticated, service_role;
