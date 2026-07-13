-- Temporarily limit server Action bots to two per server.

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
    RAISE EXCEPTION 'You do not have permission to manage action bots';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'create_server_bot', 10, 3600) THEN
    RAISE EXCEPTION 'Too many bot creation attempts. Please try again later.';
  END IF;

  IF clean_name = '' THEN
    RAISE EXCEPTION 'Action bot name is required';
  END IF;

  clean_avatar_url := public.validate_server_bot_avatar_url(clean_avatar_url);

  SELECT count(*) INTO bot_count
  FROM public.server_bots
  WHERE server_id = _server_id;

  IF bot_count >= 2 THEN
    RAISE EXCEPTION 'This server can have up to 2 action bots for now';
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

REVOKE EXECUTE ON FUNCTION public.create_server_bot(uuid, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_server_bot(uuid, uuid, text, text) TO anon, authenticated;
