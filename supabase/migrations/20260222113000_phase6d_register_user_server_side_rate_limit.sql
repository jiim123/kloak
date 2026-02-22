-- Phase 6D:
-- Enforce server-side rate limiting in register_user itself.
-- This keeps abuse controls effective even if callers bypass frontend controls.

DO $$
DECLARE
  has_users_key_hash boolean;
  has_user_auth_table boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'users'
      AND c.column_name = 'key_hash'
  )
  INTO has_users_key_hash;

  SELECT to_regclass('public.user_auth') IS NOT NULL
  INTO has_user_auth_table;

  IF has_users_key_hash THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.register_user(
        _username text,
        _key_hash text,
        _banner_color text DEFAULT '#5865F2'
      )
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $function$
      DECLARE
        new_user_id uuid;
        result json;
        _client_id text;
        _key_bucket text;
      BEGIN
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

        IF length(_username) < 3 OR length(_username) > 20 THEN
          RAISE EXCEPTION 'Username must be between 3 and 20 characters';
        END IF;

        IF _username !~ '^[a-z0-9_]+$' THEN
          RAISE EXCEPTION 'Username can only contain lowercase letters, numbers, and underscores';
        END IF;

        IF _username IN ('admin', 'administrator', 'moderator', 'user', 'system', 'root', 'support', 'help') THEN
          RAISE EXCEPTION 'This username is reserved';
        END IF;

        IF EXISTS (SELECT 1 FROM public.users WHERE username = _username) THEN
          RAISE EXCEPTION 'Username already taken';
        END IF;

        INSERT INTO public.users (username, key_hash, status, banner_color)
        VALUES (_username, _key_hash, 'online', COALESCE(_banner_color, '#5865F2'))
        RETURNING id INTO new_user_id;

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
      $function$;
    $sql$;
  ELSIF has_user_auth_table THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.register_user(
        _username text,
        _key_hash text,
        _banner_color text DEFAULT '#5865F2'
      )
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $function$
      DECLARE
        new_user_id uuid;
        result json;
        _client_id text;
        _key_bucket text;
      BEGIN
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

        IF length(_username) < 3 OR length(_username) > 20 THEN
          RAISE EXCEPTION 'Username must be between 3 and 20 characters';
        END IF;

        IF _username !~ '^[a-z0-9_]+$' THEN
          RAISE EXCEPTION 'Username can only contain lowercase letters, numbers, and underscores';
        END IF;

        IF _username IN ('admin', 'administrator', 'moderator', 'user', 'system', 'root', 'support', 'help') THEN
          RAISE EXCEPTION 'This username is reserved';
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
      $function$;
    $sql$;
  ELSE
    RAISE EXCEPTION 'Neither public.users.key_hash nor public.user_auth exists. Cannot create register_user safely.';
  END IF;
END
$$;

REVOKE EXECUTE ON FUNCTION public.register_user(text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_user(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_user(text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
