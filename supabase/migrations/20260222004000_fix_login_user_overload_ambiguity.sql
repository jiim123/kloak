-- Resolve PGRST203 ambiguity for RPC login_user:
-- Keep exactly one exposed signature: public.login_user(_key_hash text)

DO $$
DECLARE
  fn RECORD;
BEGIN
  -- Drop every one-arg login_user overload except the text variant.
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'login_user'
      AND p.pronargs = 1
      AND pg_get_function_identity_arguments(p.oid) <> '_key_hash text'
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s);',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

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
      CREATE OR REPLACE FUNCTION public.login_user(_key_hash text)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $function$
      DECLARE
        result json;
      BEGIN
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
        )
        INTO result
        FROM public.users u
        WHERE u.key_hash = _key_hash;

        IF result IS NULL THEN
          RETURN NULL;
        END IF;

        UPDATE public.users
        SET status = 'online',
            last_seen = now()
        WHERE key_hash = _key_hash;

        RETURN result;
      END;
      $function$;
    $sql$;
  ELSIF has_user_auth_table THEN
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION public.login_user(_key_hash text)
      RETURNS json
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = public
      AS $function$
      DECLARE
        result json;
      BEGIN
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
        )
        INTO result
        FROM public.users u
        JOIN public.user_auth ua ON ua.user_id = u.id
        WHERE ua.key_hash = _key_hash
        LIMIT 1;

        IF result IS NULL THEN
          RETURN NULL;
        END IF;

        UPDATE public.users
        SET status = 'online',
            last_seen = now()
        WHERE id IN (
          SELECT ua.user_id
          FROM public.user_auth ua
          WHERE ua.key_hash = _key_hash
          LIMIT 1
        );

        RETURN result;
      END;
      $function$;
    $sql$;
  ELSE
    RAISE EXCEPTION 'Neither public.users.key_hash nor public.user_auth exists. Cannot create login_user safely.';
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.login_user(text) TO anon, authenticated;
