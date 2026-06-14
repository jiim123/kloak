ALTER TABLE public.user_auth
  ADD COLUMN IF NOT EXISTS totp_secret text,
  ADD COLUMN IF NOT EXISTS totp_pending_secret text,
  ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS totp_last_counter bigint;

CREATE OR REPLACE FUNCTION public.base32_encode_bytes(_bytes bytea)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  bit_buffer integer := 0;
  bit_count integer := 0;
  output text := '';
  byte_value integer;
  i integer;
BEGIN
  FOR i IN 0..length(_bytes) - 1 LOOP
    byte_value := get_byte(_bytes, i);
    bit_buffer := (bit_buffer << 8) | byte_value;
    bit_count := bit_count + 8;

    WHILE bit_count >= 5 LOOP
      output := output || substr(alphabet, ((bit_buffer >> (bit_count - 5)) & 31) + 1, 1);
      bit_count := bit_count - 5;
    END LOOP;
  END LOOP;

  IF bit_count > 0 THEN
    output := output || substr(alphabet, ((bit_buffer << (5 - bit_count)) & 31) + 1, 1);
  END IF;

  RETURN output;
END;
$$;

CREATE OR REPLACE FUNCTION public.base32_decode(_value text)
RETURNS bytea
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  cleaned text := upper(regexp_replace(_value, '[=\s-]', '', 'g'));
  bit_buffer integer := 0;
  bit_count integer := 0;
  output bytea := ''::bytea;
  idx integer;
  value integer;
  ch text;
BEGIN
  FOR idx IN 1..char_length(cleaned) LOOP
    ch := substr(cleaned, idx, 1);
    value := strpos(alphabet, ch) - 1;
    IF value < 0 THEN
      RAISE EXCEPTION 'Invalid base32 character';
    END IF;

    bit_buffer := (bit_buffer << 5) | value;
    bit_count := bit_count + 5;

    IF bit_count >= 8 THEN
      output := output || decode(lpad(to_hex((bit_buffer >> (bit_count - 8)) & 255), 2, '0'), 'hex');
      bit_count := bit_count - 8;
    END IF;
  END LOOP;

  RETURN output;
END;
$$;

CREATE OR REPLACE FUNCTION public.totp_code(_secret text, _counter bigint)
RETURNS text
LANGUAGE plpgsql
STABLE
STRICT
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  key_bytes bytea;
  counter_hex text;
  hmac_bytes bytea;
  byte_offset integer;
  binary_code bigint;
BEGIN
  key_bytes := public.base32_decode(_secret);
  counter_hex := lpad(to_hex(_counter), 16, '0');
  hmac_bytes := extensions.hmac(decode(counter_hex, 'hex'), key_bytes, 'sha1');
  byte_offset := get_byte(hmac_bytes, length(hmac_bytes) - 1) & 15;
  binary_code :=
    ((get_byte(hmac_bytes, byte_offset) & 127)::bigint << 24) |
    (get_byte(hmac_bytes, byte_offset + 1)::bigint << 16) |
    (get_byte(hmac_bytes, byte_offset + 2)::bigint << 8) |
    get_byte(hmac_bytes, byte_offset + 3)::bigint;

  RETURN lpad((binary_code % 1000000)::text, 6, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_totp_code(_secret text, _code text, _last_counter bigint DEFAULT NULL)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  normalized_code text := regexp_replace(COALESCE(_code, ''), '\D', '', 'g');
  current_counter bigint := floor(extract(epoch from now()) / 30)::bigint;
  candidate_counter bigint;
BEGIN
  IF normalized_code !~ '^\d{6}$' THEN
    RETURN NULL;
  END IF;

  FOR candidate_counter IN current_counter - 1..current_counter + 1 LOOP
    IF _last_counter IS NOT NULL AND candidate_counter <= _last_counter THEN
      CONTINUE;
    END IF;

    IF public.totp_code(_secret, candidate_counter) = normalized_code THEN
      RETURN candidate_counter;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_mfa_status(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  enabled_at timestamptz;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT ua.totp_enabled_at INTO enabled_at
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id;

  RETURN jsonb_build_object(
    'totp_enabled', enabled_at IS NOT NULL,
    'totp_enabled_at', enabled_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_totp_enrollment(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  secret text;
  username text;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
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
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT ua.totp_pending_secret INTO pending_secret
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id;

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

  RETURN jsonb_build_object('success', true);
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
  WHERE ua.user_id = _user_id;

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
      totp_last_counter = NULL
  WHERE user_id = _user_id;

  RETURN jsonb_build_object('success', true);
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
  LIMIT 1;

  IF _user_id IS NULL THEN
    PERFORM key_hash FROM public.user_auth WHERE key_hash = _dummy_hash LIMIT 1;
    RETURN NULL;
  END IF;

  IF _require_totp AND _totp_secret IS NOT NULL THEN
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

  UPDATE public.users
  SET status = 'online',
      last_seen = now()
  WHERE id = _user_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_user(_key_hash text) RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.perform_login_user(_key_hash, NULL, true);
$$;

CREATE OR REPLACE FUNCTION public.login_user_with_totp(_key_hash text, _totp_code text) RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.perform_login_user(_key_hash, _totp_code, true);
$$;

CREATE OR REPLACE FUNCTION public.restore_user_session(_key_hash text) RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.perform_login_user(_key_hash, NULL, false);
$$;

CREATE OR REPLACE FUNCTION public.reset_user_secret_key(_user_id uuid, _new_key_hash character, _totp_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_last_reset timestamptz;
  v_cooldown_hours int := 24;
  v_time_remaining interval;
  v_totp_secret text;
  v_totp_last_counter bigint;
  v_verified_counter bigint;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _new_key_hash IS NULL OR _new_key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid key hash format';
  END IF;

  SELECT ua.totp_secret, ua.totp_last_counter
  INTO v_totp_secret, v_totp_last_counter
  FROM public.user_auth ua
  WHERE ua.user_id = _user_id;

  IF v_totp_secret IS NOT NULL THEN
    v_verified_counter := public.verify_totp_code(v_totp_secret, _totp_code, v_totp_last_counter);
    IF v_verified_counter IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'invalid_totp');
    END IF;
  ELSE
    RETURN json_build_object('success', false, 'error', 'mfa_required');
  END IF;

  SELECT last_key_reset_at INTO v_last_reset
  FROM public.user_auth
  WHERE user_id = _user_id;

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

  INSERT INTO public.user_auth (user_id, key_hash, totp_last_counter, last_key_reset_at)
  VALUES (_user_id, lower(_new_key_hash::text), v_verified_counter, now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    key_hash = EXCLUDED.key_hash,
    totp_last_counter = EXCLUDED.totp_last_counter,
    last_key_reset_at = EXCLUDED.last_key_reset_at;

  RETURN json_build_object('success', true, 'last_key_reset_at', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_user_secret_key(_user_id uuid, _new_key_hash character)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.reset_user_secret_key(_user_id, _new_key_hash, NULL);
$$;

REVOKE EXECUTE ON FUNCTION public.base32_encode_bytes(bytea) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.base32_decode(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.totp_code(text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_totp_code(text, text, bigint) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_mfa_status(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.begin_totp_enrollment(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_totp_enrollment(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.disable_totp(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.perform_login_user(text, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.login_user(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.login_user_with_totp(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_user_session(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_mfa_status(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.begin_totp_enrollment(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.confirm_totp_enrollment(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.disable_totp(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.login_user(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.login_user_with_totp(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.restore_user_session(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_user_secret_key(uuid, character, text) TO anon, authenticated, service_role;
