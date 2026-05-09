-- Ensure auth bootstrap payloads include allow_nsfw so the privacy toggle survives refresh.

CREATE OR REPLACE FUNCTION public.register_user(
  _username text,
  _key_hash text,
  _banner_color text DEFAULT '#5865F2'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  result json;
  _client_id text;
  _key_bucket text;
  _jwt_role text := nullif(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF _jwt_role IS NOT NULL AND _jwt_role <> 'service_role' THEN
    RAISE EXCEPTION 'Direct register_user RPC access is forbidden'
      USING ERRCODE = '42501';
  END IF;

  IF _key_hash IS NULL OR length(_key_hash) != 64 OR _key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid key hash format';
  END IF;
  _key_hash := lower(_key_hash);

  _client_id := public.request_client_identifier();
  _key_bucket := left(_key_hash, 16);

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'register_user_client', 8, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many registration attempts';
  END IF;

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'register_user_hourly', 25, 3600) THEN
    RAISE EXCEPTION 'Rate limited: registration quota reached';
  END IF;

  IF _key_bucket <> ''
     AND NOT public.check_rate_limit(_key_bucket, 'register_user_keyhash', 3, 3600) THEN
    RAISE EXCEPTION 'Rate limited: key hash attempt quota reached';
  END IF;

  IF _username IS NULL THEN
    RAISE EXCEPTION 'Username is required';
  END IF;

  _username := lower(trim(_username));

  IF length(_username) < 3 OR length(_username) > 16 THEN
    RAISE EXCEPTION 'Username must be between 3 and 16 characters';
  END IF;

  IF _username !~ '^[a-z0-9_-]+$' THEN
    RAISE EXCEPTION 'Username can only contain lowercase letters, numbers, underscores, and hyphens';
  END IF;

  IF _username ~ '^[-_]' OR _username ~ '[-_]$' THEN
    RAISE EXCEPTION 'Username cannot start or end with an underscore or hyphen';
  END IF;

  IF _username ~ '[-_]{2,}' THEN
    RAISE EXCEPTION 'Username cannot contain consecutive special characters';
  END IF;

  IF _username ~ '^\d+$' THEN
    RAISE EXCEPTION 'Username cannot be only numbers';
  END IF;

  IF public.is_username_blocked(_username) THEN
    RAISE EXCEPTION 'This username is not allowed';
  END IF;

  IF EXISTS (SELECT 1 FROM public.users WHERE username = _username) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;

  INSERT INTO public.users (username, status, banner_color)
  VALUES (_username, 'online', COALESCE(_banner_color, '#5865F2'))
  RETURNING id INTO new_user_id;

  INSERT INTO public.user_auth (user_id, key_hash)
  VALUES (new_user_id, _key_hash);

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
  WHERE u.id = new_user_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.login_user(_key_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  _user_id uuid;
  _dummy_hash text := 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  _client_id text;
  _key_bucket text;
  _has_users_key_hash boolean := false;
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

  SELECT ua.user_id INTO _user_id
  FROM public.user_auth ua
  WHERE ua.key_hash = _key_hash
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'users'
      AND c.column_name = 'key_hash'
  )
  INTO _has_users_key_hash;

  IF _user_id IS NULL AND _has_users_key_hash THEN
    EXECUTE 'SELECT u.id FROM public.users u WHERE u.key_hash = $1 LIMIT 1'
      INTO _user_id
      USING _key_hash;

    IF _user_id IS NOT NULL THEN
      INSERT INTO public.user_auth (user_id, key_hash)
      VALUES (_user_id, _key_hash)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF _user_id IS NULL THEN
    PERFORM key_hash FROM public.user_auth WHERE key_hash = _dummy_hash LIMIT 1;
    RETURN NULL;
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
