-- Move platform staff checks out of hardcoded UUID allowlists.
-- Staff membership lives on public.users, but users must not be able to promote themselves.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_staff boolean NOT NULL DEFAULT false;

UPDATE public.users
SET is_staff = true
WHERE id IN (
  'd9ff3045-de3a-4878-9e4e-a015d43b00ab'::uuid,
  '925aea05-b0b7-4171-a925-e7dc8560014e'::uuid,
  'ce6e5466-80a5-42e0-835f-086e2347ea82'::uuid,
  'c3108f3f-d4ca-49c5-9dbf-bd83f9316db6'::uuid
);

CREATE OR REPLACE FUNCTION public.prevent_user_staff_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (
       (TG_OP = 'INSERT' AND COALESCE(NEW.is_staff, false) = true)
       OR (TG_OP = 'UPDATE' AND NEW.is_staff IS DISTINCT FROM OLD.is_staff)
     ) THEN
    RAISE EXCEPTION 'Only service role can change staff status';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_user_staff_self_update ON public.users;
CREATE TRIGGER trg_prevent_user_staff_self_update
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_user_staff_self_update();

CREATE OR REPLACE FUNCTION public.platform_admin_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(array_agg(id ORDER BY username), ARRAY[]::uuid[])
  FROM public.users
  WHERE is_staff = true;
$$;

CREATE OR REPLACE FUNCTION public.platform_admin_usernames()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT COALESCE(array_agg(lower(username) ORDER BY username), ARRAY[]::text[])
  FROM public.users
  WHERE is_staff = true;
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _is_staff boolean;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  SELECT u.is_staff INTO _is_staff
  FROM public.users u
  WHERE u.id = _user_id;

  RETURN COALESCE(_is_staff, false);
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
    'is_staff', u.is_staff,
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

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
