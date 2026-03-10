-- Defense-in-depth: even if EXECUTE grants drift, block direct anon/authenticated
-- calls to register_user and keep registration on trusted server-side paths only.

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

  _client_id := public.request_client_identifier();
  _key_bucket := left(lower(COALESCE(_key_hash, '')), 16);

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

  IF _key_hash IS NULL OR length(_key_hash) != 64 OR _key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    RAISE EXCEPTION 'Invalid key hash format';
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
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
  FROM public.users u
  WHERE u.id = new_user_id;

  RETURN result;
END;
$$;

DO $$
BEGIN
  IF to_regprocedure('public.register_user(text,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.register_user(text,text,text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.register_user(text,text,text) TO service_role';
  END IF;

  IF to_regprocedure('public.register_user(text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.register_user(text,text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.register_user(text,text) TO service_role';
  END IF;
END $$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END $$;
