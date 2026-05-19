-- Add lightweight server bots with flow-style triggers and actions.
-- Mutations are RPC-only and bind _user_id to the request identity.

CREATE TABLE IF NOT EXISTS public.server_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  bot_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'helmet',
  is_enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_bots_name_length CHECK (char_length(trim(name)) BETWEEN 1 AND 32)
);

CREATE TABLE IF NOT EXISTS public.server_bot_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.server_bots(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'New flow',
  trigger_type text NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  action_type text NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enabled boolean NOT NULL DEFAULT true,
  cooldown_seconds integer NOT NULL DEFAULT 10,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_bot_flows_trigger_type_check CHECK (trigger_type IN ('member_joined', 'message_created')),
  CONSTRAINT server_bot_flows_action_type_check CHECK (action_type IN ('send_channel_message')),
  CONSTRAINT server_bot_flows_cooldown_check CHECK (cooldown_seconds BETWEEN 0 AND 3600)
);

CREATE INDEX IF NOT EXISTS idx_server_bots_server_id ON public.server_bots(server_id);
CREATE INDEX IF NOT EXISTS idx_server_bot_flows_bot_id ON public.server_bot_flows(bot_id);
CREATE INDEX IF NOT EXISTS idx_server_bot_flows_server_trigger ON public.server_bot_flows(server_id, trigger_type)
  WHERE is_enabled = true;

ALTER TABLE public.server_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_bots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.server_bot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_bot_flows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Server managers can view bots" ON public.server_bots;
CREATE POLICY "Server managers can view bots"
ON public.server_bots
FOR SELECT
USING (
  public.check_user_server_permission(public.requesting_user_id(), server_id, 'manage_server')
);

DROP POLICY IF EXISTS "Server managers can view bot flows" ON public.server_bot_flows;
CREATE POLICY "Server managers can view bot flows"
ON public.server_bot_flows
FOR SELECT
USING (
  public.check_user_server_permission(public.requesting_user_id(), server_id, 'manage_server')
);

REVOKE ALL ON TABLE public.server_bots FROM PUBLIC;
REVOKE ALL ON TABLE public.server_bot_flows FROM PUBLIC;
GRANT SELECT ON TABLE public.server_bots TO anon, authenticated, service_role;
GRANT SELECT ON TABLE public.server_bot_flows TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.touch_server_bot_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_server_bots_updated_at ON public.server_bots;
CREATE TRIGGER trg_touch_server_bots_updated_at
BEFORE UPDATE ON public.server_bots
FOR EACH ROW
EXECUTE FUNCTION public.touch_server_bot_updated_at();

DROP TRIGGER IF EXISTS trg_touch_server_bot_flows_updated_at ON public.server_bot_flows;
CREATE TRIGGER trg_touch_server_bot_flows_updated_at
BEFORE UPDATE ON public.server_bot_flows
FOR EACH ROW
EXECUTE FUNCTION public.touch_server_bot_updated_at();

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

CREATE OR REPLACE FUNCTION public.delete_server_bot(_bot_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _server_id uuid;
  _bot_user_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id, bot_user_id INTO _server_id, _bot_user_id FROM public.server_bots WHERE id = _bot_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  DELETE FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = _bot_user_id
    AND EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = _bot_user_id
        AND COALESCE(u.is_bot, false) = true
    );

  DELETE FROM public.server_bots WHERE id = _bot_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_server_bot_flow(
  _bot_id uuid,
  _user_id uuid,
  _flow_id uuid DEFAULT NULL,
  _trigger_type text DEFAULT 'member_joined',
  _trigger_config jsonb DEFAULT '{}'::jsonb,
  _action_type text DEFAULT 'send_channel_message',
  _action_config jsonb DEFAULT '{}'::jsonb,
  _is_enabled boolean DEFAULT true,
  _cooldown_seconds integer DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _bot public.server_bots%ROWTYPE;
  _flow public.server_bot_flows%ROWTYPE;
  _channel_id uuid;
  _content text;
  _cooldown integer;
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

  IF _trigger_type NOT IN ('member_joined', 'message_created') THEN
    RAISE EXCEPTION 'Unsupported trigger type';
  END IF;

  IF _action_type <> 'send_channel_message' THEN
    RAISE EXCEPTION 'Unsupported action type';
  END IF;

  _channel_id := NULLIF(_action_config->>'channel_id', '')::uuid;
  _content := trim(COALESCE(_action_config->>'content', ''));
  _cooldown := LEAST(GREATEST(COALESCE(_cooldown_seconds, 10), 0), 3600);

  IF _channel_id IS NULL THEN
    RAISE EXCEPTION 'Action channel is required';
  END IF;

  IF char_length(_content) < 1 OR char_length(_content) > 500 THEN
    RAISE EXCEPTION 'Action message must be 1-500 characters';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.channels c
    WHERE c.id = _channel_id
      AND c.server_id = _bot.server_id
      AND c.type IN ('text', 'announcement')
  ) THEN
    RAISE EXCEPTION 'Action channel must be a text channel in this server';
  END IF;

  IF _flow_id IS NULL THEN
    INSERT INTO public.server_bot_flows (
      server_id,
      bot_id,
      name,
      trigger_type,
      trigger_config,
      action_type,
      action_config,
      is_enabled,
      cooldown_seconds
    )
    VALUES (
      _bot.server_id,
      _bot.id,
      'New flow',
      _trigger_type,
      COALESCE(_trigger_config, '{}'::jsonb),
      _action_type,
      jsonb_build_object('channel_id', _channel_id::text, 'content', _content),
      COALESCE(_is_enabled, true),
      _cooldown
    )
    RETURNING * INTO _flow;
  ELSE
    UPDATE public.server_bot_flows
    SET
      trigger_type = _trigger_type,
      trigger_config = COALESCE(_trigger_config, '{}'::jsonb),
      action_type = _action_type,
      action_config = jsonb_build_object('channel_id', _channel_id::text, 'content', _content),
      is_enabled = COALESCE(_is_enabled, is_enabled),
      cooldown_seconds = _cooldown
    WHERE id = _flow_id
      AND bot_id = _bot.id
      AND server_id = _bot.server_id
    RETURNING * INTO _flow;

    IF _flow.id IS NULL THEN
      RAISE EXCEPTION 'Flow not found';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'id', _flow.id,
    'server_id', _flow.server_id,
    'bot_id', _flow.bot_id,
    'name', _flow.name,
    'trigger_type', _flow.trigger_type,
    'trigger_config', _flow.trigger_config,
    'action_type', _flow.action_type,
    'action_config', _flow.action_config,
    'is_enabled', _flow.is_enabled,
    'cooldown_seconds', _flow.cooldown_seconds,
    'last_triggered_at', _flow.last_triggered_at,
    'created_at', _flow.created_at,
    'updated_at', _flow.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_server_bot_flow(_flow_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _server_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id FROM public.server_bot_flows WHERE id = _flow_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Flow not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  DELETE FROM public.server_bot_flows WHERE id = _flow_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.render_bot_template(_template text, _context jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  _rendered text := COALESCE(_template, '');
BEGIN
  _rendered := replace(_rendered, '{user}', COALESCE(_context->>'user_mention', 'someone'));
  _rendered := replace(_rendered, '{channel}', COALESCE(_context->>'channel_mention', 'this channel'));
  _rendered := replace(_rendered, '{server}', COALESCE(_context->>'server_name', 'the server'));
  _rendered := left(_rendered, 500);
  RETURN _rendered;
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

CREATE OR REPLACE FUNCTION public.handle_server_bot_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _server_name text;
BEGIN
  IF TG_OP = 'INSERT'
    AND COALESCE(NEW.is_banned, false) = false
    AND NOT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = NEW.user_id
        AND COALESCE(u.is_bot, false) = true
    )
  THEN
    SELECT name INTO _server_name FROM public.servers WHERE id = NEW.server_id;
    PERFORM public.run_server_bot_flows(
      NEW.server_id,
      'member_joined',
      jsonb_build_object(
        'actor_user_id', NEW.user_id,
        'user_mention', '<@' || NEW.user_id::text || '>',
        'server_name', COALESCE(_server_name, 'the server')
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_server_bot_member_joined ON public.server_members;
CREATE TRIGGER trg_server_bot_member_joined
AFTER INSERT ON public.server_members
FOR EACH ROW
EXECUTE FUNCTION public.handle_server_bot_member_joined();

CREATE OR REPLACE FUNCTION public.handle_server_bot_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _server_id uuid;
  _server_name text;
BEGIN
  IF COALESCE(NEW.is_system_message, false) = true
    OR EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = NEW.user_id
        AND COALESCE(u.is_bot, false) = true
    )
  THEN
    RETURN NEW;
  END IF;

  SELECT c.server_id, s.name
    INTO _server_id, _server_name
  FROM public.channels c
  JOIN public.servers s ON s.id = c.server_id
  WHERE c.id = NEW.channel_id;

  IF _server_id IS NOT NULL THEN
    PERFORM public.run_server_bot_flows(
      _server_id,
      'message_created',
      jsonb_build_object(
        'actor_user_id', NEW.user_id,
        'user_mention', '<@' || NEW.user_id::text || '>',
        'channel_mention', '<#' || NEW.channel_id::text || '>',
        'server_name', COALESCE(_server_name, 'the server'),
        'message_content', left(NEW.content, 500)
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_server_bot_message_created ON public.messages;
CREATE TRIGGER trg_server_bot_message_created
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_server_bot_message_created();

-- Existing ban/kick cleanup purges messages when server_members rows are deleted.
-- Disabled/deleted bots should disappear from member lists without erasing their prior bot-authored messages.
CREATE OR REPLACE FUNCTION public.purge_banned_user_messages()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _server_id uuid;
  _user_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_banned = true AND OLD.is_banned = false THEN
      _server_id := NEW.server_id;
      _user_id := NEW.user_id;
    ELSE
      RETURN NEW;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    _server_id := OLD.server_id;
    _user_id := OLD.user_id;
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = _user_id
      AND COALESCE(u.is_bot, false) = true
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  DELETE FROM public.messages
  WHERE user_id = _user_id
    AND channel_id IN (
      SELECT id FROM public.channels WHERE server_id = _server_id
    );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid;
  _online_cutoff timestamptz;
  _can_manage_invites boolean := false;
BEGIN
  _caller := public.requesting_user_id();
  _online_cutoff := now() - interval '5 minutes';

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  _can_manage_invites := public.check_user_server_permission(_caller, _server_id, 'manage_invites');

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN sm.join_invite_code ELSE NULL END,
          'user', json_build_object(
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
            'last_seen', u.last_seen,
            'is_bot', u.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'icon', sr.icon,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND COALESCE(sm.is_banned, false) = false
        AND (
          COALESCE(u.is_bot, false) = true
          OR sm.user_id = _caller
          OR (
            (u.last_seen IS NOT NULL AND u.last_seen >= _online_cutoff)
            OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') <> 'offline')
          )
        )
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_server_members_offline_page_secure(
  _server_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 100,
  _cursor_joined_at timestamptz DEFAULT NULL,
  _cursor_member_id uuid DEFAULT NULL,
  _include_count boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _safe_limit integer;
  _online_cutoff timestamptz;
  _offline_count integer := NULL;
  _members json := '[]'::json;
  _has_more boolean := false;
  _next_cursor_joined_at timestamptz := NULL;
  _next_cursor_member_id uuid := NULL;
  _can_manage_invites boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN json_build_object(
      'members', '[]'::json,
      'has_more', false,
      'next_cursor_joined_at', NULL,
      'next_cursor_member_id', NULL,
      'offline_count', 0
    );
  END IF;

  _can_manage_invites := public.check_user_server_permission(_user_id, _server_id, 'manage_invites');
  _safe_limit := LEAST(GREATEST(COALESCE(_limit, 100), 1), 200);
  _online_cutoff := now() - interval '5 minutes';

  WITH offline_base AS (
    SELECT
      sm.id,
      sm.server_id,
      sm.user_id,
      sm.role,
      sm.nickname,
      sm.is_banned,
      sm.is_muted,
      sm.joined_at,
      sm.join_source,
      sm.join_invite_code,
      u.id AS user_public_id,
      u.username,
      u.display_name,
      u.avatar_url,
      u.banner_url,
      u.avatar_decoration,
      u.profile_effect,
      u.banner_color,
      u.profile_theme_primary,
      u.profile_theme_accent,
      u.bio,
      u.status,
      u.custom_status,
      u.created_at AS user_created_at,
      u.last_seen,
      u.is_bot
    FROM public.server_members sm
    JOIN public.users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id
      AND COALESCE(sm.is_banned, false) = false
      AND COALESCE(u.is_bot, false) = false
      AND (
        (u.last_seen IS NOT NULL AND u.last_seen < _online_cutoff)
        OR (u.last_seen IS NULL AND COALESCE(u.status::text, 'offline') = 'offline')
      )
  ),
  page_source AS (
    SELECT *
    FROM offline_base b
    WHERE (
      _cursor_joined_at IS NULL
      OR (b.joined_at, b.id) < (
        _cursor_joined_at,
        COALESCE(_cursor_member_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
      )
    )
    ORDER BY b.joined_at DESC, b.id DESC
    LIMIT (_safe_limit + 1)
  ),
  page_rows AS (
    SELECT *
    FROM page_source
    ORDER BY joined_at DESC, id DESC
    LIMIT _safe_limit
  ),
  page_json AS (
    SELECT COALESCE(
      json_agg(
        json_build_object(
          'id', pr.id,
          'server_id', pr.server_id,
          'user_id', pr.user_id,
          'role', pr.role,
          'nickname', pr.nickname,
          'is_banned', pr.is_banned,
          'is_muted', pr.is_muted,
          'joined_at', pr.joined_at,
          'join_source', pr.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN pr.join_invite_code ELSE NULL END,
          'user', json_build_object(
            'id', pr.user_public_id,
            'username', pr.username,
            'display_name', pr.display_name,
            'avatar_url', pr.avatar_url,
            'banner_url', pr.banner_url,
            'avatar_decoration', pr.avatar_decoration,
            'profile_effect', pr.profile_effect,
            'banner_color', pr.banner_color,
            'profile_theme_primary', pr.profile_theme_primary,
            'profile_theme_accent', pr.profile_theme_accent,
            'bio', pr.bio,
            'status', pr.status,
            'custom_status', pr.custom_status,
            'created_at', pr.user_created_at,
            'last_seen', pr.last_seen,
            'is_bot', pr.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'icon', sr.icon,
                  'position', sr.position
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = pr.id
            ),
            '[]'::json
          )
        )
      ),
      '[]'::json
    ) AS members
    FROM page_rows pr
  ),
  cursor_row AS (
    SELECT joined_at, id
    FROM page_rows
    ORDER BY joined_at ASC, id ASC
    LIMIT 1
  )
  SELECT
    pj.members,
    EXISTS(SELECT 1 FROM page_source OFFSET _safe_limit),
    cr.joined_at,
    cr.id
  INTO _members, _has_more, _next_cursor_joined_at, _next_cursor_member_id
  FROM page_json pj
  LEFT JOIN cursor_row cr ON true;

  IF _include_count THEN
    SELECT count(*) INTO _offline_count FROM offline_base;
  END IF;

  RETURN json_build_object(
    'members', COALESCE(_members, '[]'::json),
    'has_more', COALESCE(_has_more, false),
    'next_cursor_joined_at', _next_cursor_joined_at,
    'next_cursor_member_id', _next_cursor_member_id,
    'offline_count', _offline_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_server_bots(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_server_bot(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_server_bot(uuid, uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_server_bot(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_server_bot_flow(uuid, uuid, uuid, text, jsonb, text, jsonb, boolean, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_server_bot_flow(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.run_server_bot_flows(uuid, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_server_bot_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_server_bot_membership(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.render_bot_template(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_server_bot_member_joined() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_server_bot_message_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_banned_user_messages() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_server_bots(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_server_bot(uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_server_bot(uuid, uuid, text, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_server_bot(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_server_bot_flow(uuid, uuid, uuid, text, jsonb, text, jsonb, boolean, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_server_bot_flow(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.run_server_bot_flows(uuid, text, jsonb) TO service_role;
