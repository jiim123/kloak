-- Allow server flow bots to have editable profile names and avatars.

DROP FUNCTION IF EXISTS public.create_server_bot(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.update_server_bot(uuid, uuid, text, boolean);

CREATE OR REPLACE FUNCTION public.validate_server_bot_avatar_url(_avatar_url text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  clean_avatar_url text := NULLIF(trim(COALESCE(_avatar_url, '')), '');
  headers json;
  request_host text;
  legacy_avatar_prefix text;
  bunny_avatar_prefix text := 'https://kloakcdn.b-cdn.net/avatars/';
BEGIN
  IF clean_avatar_url IS NULL THEN
    RETURN NULL;
  END IF;

  IF char_length(clean_avatar_url) > 2048
     OR clean_avatar_url !~* '^https?://[^[:space:]]+$'
     OR clean_avatar_url !~ '^[ -~]+$' THEN
    RAISE EXCEPTION 'Avatar URL must be a valid http(s) URL';
  END IF;

  BEGIN
    headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    headers := '{}'::json;
  END;

  request_host := lower(NULLIF(trim(COALESCE(headers->>'x-forwarded-host', headers->>'host')), ''));
  legacy_avatar_prefix := CASE
    WHEN request_host IS NULL THEN NULL
    ELSE 'https://' || request_host || '/storage/v1/object/public/avatars/'
  END;

  IF strpos(lower(clean_avatar_url), bunny_avatar_prefix) <> 1
     AND (legacy_avatar_prefix IS NULL OR strpos(lower(clean_avatar_url), legacy_avatar_prefix) <> 1) THEN
    RAISE EXCEPTION 'Invalid bot avatar URL';
  END IF;

  RETURN clean_avatar_url;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_server_bots(_server_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_webhooks'::public.permission_type) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', b.id,
          'server_id', b.server_id,
          'bot_user_id', b.bot_user_id,
          'name', b.name,
          'icon', b.icon,
          'avatar_url', u.avatar_url,
          'is_enabled', b.is_enabled,
          'is_default', b.is_default,
          'created_by', b.created_by,
          'created_at', b.created_at,
          'updated_at', b.updated_at,
          'flows', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', f.id,
                  'server_id', f.server_id,
                  'bot_id', f.bot_id,
                  'name', f.name,
                  'trigger_type', f.trigger_type,
                  'trigger_config', f.trigger_config,
                  'action_type', f.action_type,
                  'action_config', f.action_config,
                  'is_enabled', f.is_enabled,
                  'cooldown_seconds', f.cooldown_seconds,
                  'last_triggered_at', f.last_triggered_at,
                  'created_at', f.created_at,
                  'updated_at', f.updated_at
                )
                ORDER BY f.created_at ASC
              )
              FROM public.server_bot_flows f
              WHERE f.bot_id = b.id
            ),
            '[]'::json
          )
        )
        ORDER BY b.created_at ASC
      )
      FROM public.server_bots b
      JOIN public.users u ON u.id = b.bot_user_id
      WHERE b.server_id = _server_id
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_server_bot(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _avatar_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  clean_name text := left(trim(COALESCE(_name, '')), 32);
  clean_avatar_url text := NULLIF(trim(COALESCE(_avatar_url, '')), '');
  bot_count integer;
  new_bot_user_id uuid := gen_random_uuid();
  new_bot_id uuid;
  candidate_username text;
  attempt integer := 0;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_webhooks'::public.permission_type) THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'create_server_bot', 10, 3600) THEN
    RAISE EXCEPTION 'Too many bot creation attempts. Please try again later.';
  END IF;

  IF clean_name = '' THEN
    RAISE EXCEPTION 'Bot name is required';
  END IF;

  clean_avatar_url := public.validate_server_bot_avatar_url(clean_avatar_url);

  SELECT count(*) INTO bot_count
  FROM public.server_bots
  WHERE server_id = _server_id;

  IF bot_count >= 10 THEN
    RAISE EXCEPTION 'This server has reached the bot limit';
  END IF;

  LOOP
    candidate_username := 'bot_' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.users WHERE username = candidate_username);
    attempt := attempt + 1;
    IF attempt > 8 THEN
      RAISE EXCEPTION 'Could not allocate bot username';
    END IF;
  END LOOP;

  INSERT INTO public.users (id, username, display_name, avatar_url, status, last_seen, is_bot)
  VALUES (new_bot_user_id, candidate_username, clean_name, clean_avatar_url, 'online'::public.user_status, now(), true);

  INSERT INTO public.server_members (server_id, user_id, role, is_banned, is_muted)
  VALUES (_server_id, new_bot_user_id, 'member'::public.server_role, false, false)
  ON CONFLICT (server_id, user_id) DO NOTHING;

  INSERT INTO public.server_bots (server_id, bot_user_id, name, created_by)
  VALUES (_server_id, new_bot_user_id, clean_name, _user_id)
  RETURNING id INTO new_bot_id;

  RETURN (
    SELECT json_build_object(
      'id', b.id,
      'server_id', b.server_id,
      'bot_user_id', b.bot_user_id,
      'name', b.name,
      'icon', b.icon,
      'avatar_url', u.avatar_url,
      'is_enabled', b.is_enabled,
      'is_default', b.is_default,
      'created_by', b.created_by,
      'created_at', b.created_at,
      'updated_at', b.updated_at,
      'flows', '[]'::json
    )
    FROM public.server_bots b
    JOIN public.users u ON u.id = b.bot_user_id
    WHERE b.id = new_bot_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_server_bot(
  _bot_id uuid,
  _user_id uuid,
  _name text DEFAULT NULL,
  _is_enabled boolean DEFAULT NULL,
  _avatar_url text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  bot_server_id uuid;
  clean_name text;
  clean_avatar_url text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO bot_server_id
  FROM public.server_bots
  WHERE id = _bot_id;

  IF bot_server_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.check_user_server_permission(_user_id, bot_server_id, 'manage_webhooks'::public.permission_type) THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  clean_name := NULLIF(left(trim(COALESCE(_name, '')), 32), '');
  clean_avatar_url := NULLIF(trim(COALESCE(_avatar_url, '')), '');

  clean_avatar_url := public.validate_server_bot_avatar_url(clean_avatar_url);

  UPDATE public.server_bots
  SET name = COALESCE(clean_name, name),
      is_enabled = COALESCE(_is_enabled, is_enabled)
  WHERE id = _bot_id;

  UPDATE public.users u
  SET display_name = COALESCE(clean_name, u.display_name),
      avatar_url = COALESCE(clean_avatar_url, u.avatar_url)
  FROM public.server_bots b
  WHERE b.id = _bot_id
    AND u.id = b.bot_user_id;

  RETURN true;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_bots(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_server_bot_avatar_url(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_server_bot(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_server_bot(uuid, uuid, text, boolean, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_server_bots(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_server_bot(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_server_bot(uuid, uuid, text, boolean, text) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
