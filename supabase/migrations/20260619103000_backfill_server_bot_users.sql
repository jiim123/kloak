-- Upgrade existing server_bots installs from the first bot migration so each
-- bot has a real bot user identity for member-list display and message authorship.

ALTER TABLE public.server_bots
ADD COLUMN IF NOT EXISTS bot_user_id uuid REFERENCES public.users(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_server_bots_bot_user_id
ON public.server_bots(bot_user_id)
WHERE bot_user_id IS NOT NULL;

DO $$
DECLARE
  _bot record;
  _bot_user_id uuid;
  _bot_username text;
BEGIN
  FOR _bot IN
    SELECT id, name
    FROM public.server_bots
    WHERE bot_user_id IS NULL
  LOOP
    _bot_user_id := gen_random_uuid();
    _bot_username := 'bot_' || left(replace(_bot_user_id::text, '-', ''), 12);

    INSERT INTO public.users (
      id,
      username,
      display_name,
      banner_color,
      status,
      custom_status,
      bio,
      is_bot,
      last_seen
    )
    VALUES (
      _bot_user_id,
      _bot_username,
      left(trim(COALESCE(_bot.name, 'Bot')), 32),
      '#F0C94A',
      'online'::public.user_status,
      'Bot',
      'Automated server bot',
      true,
      now()
    );

    UPDATE public.server_bots
    SET bot_user_id = _bot_user_id
    WHERE id = _bot.id;
  END LOOP;
END
$$;

ALTER TABLE public.server_bots
ALTER COLUMN bot_user_id SET NOT NULL;

CREATE OR REPLACE FUNCTION public.ensure_server_bot_membership(_bot_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bot public.server_bots%ROWTYPE;
  _member_id uuid;
  _everyone_role_id uuid;
BEGIN
  SELECT * INTO _bot
  FROM public.server_bots
  WHERE id = _bot_id;

  IF _bot.id IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;

  IF NOT _bot.is_enabled THEN
    DELETE FROM public.server_members
    WHERE server_id = _bot.server_id
      AND user_id = _bot.bot_user_id;
    RETURN NULL;
  END IF;

  UPDATE public.users
  SET is_bot = true,
      display_name = _bot.name,
      status = 'online'::public.user_status,
      custom_status = COALESCE(NULLIF(custom_status, ''), 'Bot'),
      last_seen = now()
  WHERE id = _bot.bot_user_id;

  INSERT INTO public.server_members (
    server_id,
    user_id,
    role,
    nickname,
    is_banned,
    is_muted,
    join_source
  )
  VALUES (
    _bot.server_id,
    _bot.bot_user_id,
    'member',
    NULL,
    false,
    false,
    'bot'
  )
  ON CONFLICT (server_id, user_id)
  DO UPDATE SET
    is_banned = false,
    is_muted = false,
    role = CASE
      WHEN public.server_members.role = 'owner' THEN public.server_members.role
      ELSE 'member'::public.server_role
    END,
    join_source = 'bot'
  RETURNING id INTO _member_id;

  SELECT id INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = _bot.server_id
    AND name = '@everyone'
  LIMIT 1;

  IF _member_id IS NOT NULL AND _everyone_role_id IS NOT NULL THEN
    INSERT INTO public.server_member_roles (member_id, role_id)
    VALUES (_member_id, _everyone_role_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN _member_id;
END;
$$;

SELECT public.ensure_server_bot_membership(id)
FROM public.server_bots
WHERE is_enabled = true;

CREATE OR REPLACE FUNCTION public.get_server_bots(_server_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'server_id', b.server_id,
      'bot_user_id', b.bot_user_id,
      'name', b.name,
      'icon', b.icon,
      'is_enabled', b.is_enabled,
      'is_default', b.is_default,
      'created_by', b.created_by,
      'created_at', b.created_at,
      'updated_at', b.updated_at,
      'flows', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
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
      ), '[]'::jsonb)
    )
    ORDER BY b.created_at ASC
  ), '[]'::jsonb)
  INTO _result
  FROM public.server_bots b
  WHERE b.server_id = _server_id;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_server_bot(_server_id uuid, _user_id uuid, _name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bot public.server_bots%ROWTYPE;
  _clean_name text;
  _bot_count integer;
  _bot_user_id uuid := gen_random_uuid();
  _bot_username text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'create_server_bot', 10, 3600) THEN
    RAISE EXCEPTION 'Rate limited: too many bot creation attempts';
  END IF;

  _clean_name := left(trim(COALESCE(_name, '')), 32);
  IF char_length(_clean_name) < 1 THEN
    RAISE EXCEPTION 'Bot name is required';
  END IF;

  SELECT count(*) INTO _bot_count FROM public.server_bots WHERE server_id = _server_id;
  IF _bot_count >= 10 THEN
    RAISE EXCEPTION 'This server has reached the bot limit';
  END IF;

  _bot_username := 'bot_' || left(replace(_bot_user_id::text, '-', ''), 12);

  INSERT INTO public.users (
    id,
    username,
    display_name,
    banner_color,
    status,
    custom_status,
    bio,
    is_bot,
    last_seen
  )
  VALUES (
    _bot_user_id,
    _bot_username,
    _clean_name,
    '#F0C94A',
    'online'::public.user_status,
    'Bot',
    'Automated server bot',
    true,
    now()
  );

  INSERT INTO public.server_bots (server_id, bot_user_id, name, created_by)
  VALUES (_server_id, _bot_user_id, _clean_name, _user_id)
  RETURNING * INTO _bot;

  PERFORM public.ensure_server_bot_membership(_bot.id);

  RETURN jsonb_build_object(
    'id', _bot.id,
    'server_id', _bot.server_id,
    'bot_user_id', _bot.bot_user_id,
    'name', _bot.name,
    'icon', _bot.icon,
    'is_enabled', _bot.is_enabled,
    'is_default', _bot.is_default,
    'created_by', _bot.created_by,
    'created_at', _bot.created_at,
    'updated_at', _bot.updated_at,
    'flows', '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_server_bot(
  _bot_id uuid,
  _user_id uuid,
  _name text DEFAULT NULL,
  _is_enabled boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bot public.server_bots%ROWTYPE;
  _clean_name text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT * INTO _bot FROM public.server_bots WHERE id = _bot_id;
  IF _bot.id IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _bot.server_id, 'manage_server') THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  _clean_name := CASE WHEN _name IS NULL THEN _bot.name ELSE left(trim(_name), 32) END;
  IF char_length(_clean_name) < 1 THEN
    RAISE EXCEPTION 'Bot name is required';
  END IF;

  UPDATE public.server_bots
  SET
    name = _clean_name,
    is_enabled = COALESCE(_is_enabled, is_enabled)
  WHERE id = _bot_id
  RETURNING * INTO _bot;

  UPDATE public.users
  SET display_name = _bot.name,
      last_seen = now(),
      status = CASE WHEN _bot.is_enabled THEN 'online'::public.user_status ELSE status END
  WHERE id = _bot.bot_user_id
    AND is_bot = true;

  PERFORM public.ensure_server_bot_membership(_bot.id);

  RETURN jsonb_build_object(
    'id', _bot.id,
    'server_id', _bot.server_id,
    'bot_user_id', _bot.bot_user_id,
    'name', _bot.name,
    'icon', _bot.icon,
    'is_enabled', _bot.is_enabled,
    'is_default', _bot.is_default,
    'created_by', _bot.created_by,
    'created_at', _bot.created_at,
    'updated_at', _bot.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.run_server_bot_flows(_server_id uuid, _trigger_type text, _context jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _flow record;
  _channel_id uuid;
  _content text;
  _actor_user_id uuid;
BEGIN
  IF _server_id IS NULL OR _trigger_type NOT IN ('member_joined', 'message_created') THEN
    RETURN;
  END IF;

  FOR _flow IN
    SELECT f.*, b.is_enabled AS bot_enabled, b.bot_user_id
    FROM public.server_bot_flows f
    JOIN public.server_bots b ON b.id = f.bot_id
    WHERE f.server_id = _server_id
      AND f.trigger_type = _trigger_type
      AND f.is_enabled = true
      AND b.is_enabled = true
      AND (
        f.last_triggered_at IS NULL
        OR f.last_triggered_at <= now() - make_interval(secs => f.cooldown_seconds)
      )
    ORDER BY f.created_at ASC
    LIMIT 25
  LOOP
    IF _flow.action_type = 'send_channel_message' THEN
      _channel_id := NULLIF(_flow.action_config->>'channel_id', '')::uuid;
      _content := public.render_bot_template(_flow.action_config->>'content', _context);
      _actor_user_id := _flow.bot_user_id;

      IF _channel_id IS NOT NULL
        AND _actor_user_id IS NOT NULL
        AND char_length(trim(_content)) BETWEEN 1 AND 500
        AND EXISTS (
          SELECT 1
          FROM public.channels c
          WHERE c.id = _channel_id
            AND c.server_id = _server_id
            AND c.type IN ('text', 'announcement')
        )
      THEN
        INSERT INTO public.messages (channel_id, user_id, content, is_system_message)
        VALUES (_channel_id, _actor_user_id, _content, false);

        UPDATE public.server_bot_flows
        SET last_triggered_at = now()
        WHERE id = _flow.id;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ensure_server_bot_membership(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_server_bot_flows(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_server_bot_flows(uuid, text, jsonb) TO service_role;
