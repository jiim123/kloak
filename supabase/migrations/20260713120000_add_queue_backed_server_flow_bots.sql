-- Queue-backed server Flow bots MVP.
--
-- The user-facing chat/member write paths enqueue small event rows, run one
-- bounded inline processing pass for low latency, and leave the same queue
-- available for a service-role worker through process_server_bot_events.

CREATE TABLE IF NOT EXISTS public.server_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  bot_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'bot',
  is_enabled boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_bots_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 32),
  CONSTRAINT server_bots_server_bot_user_key UNIQUE (server_id, bot_user_id)
);

CREATE TABLE IF NOT EXISTS public.server_bot_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES public.server_bots(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Flow',
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
  CONSTRAINT server_bot_flows_cooldown_check CHECK (cooldown_seconds BETWEEN 0 AND 86400)
);

CREATE TABLE IF NOT EXISTS public.server_bot_event_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  event_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT server_bot_event_queue_event_type_check CHECK (event_type IN ('member_joined', 'message_created')),
  CONSTRAINT server_bot_event_queue_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  CONSTRAINT server_bot_event_queue_event_key_key UNIQUE (event_key)
);

CREATE TABLE IF NOT EXISTS public.server_bot_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.server_bot_event_queue(id) ON DELETE CASCADE,
  flow_id uuid NOT NULL REFERENCES public.server_bot_flows(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'completed',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT server_bot_action_log_event_flow_key UNIQUE (event_id, flow_id),
  CONSTRAINT server_bot_action_log_status_check CHECK (status IN ('completed', 'skipped', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_server_bots_server_enabled
  ON public.server_bots (server_id, is_enabled);

CREATE INDEX IF NOT EXISTS idx_server_bot_flows_match
  ON public.server_bot_flows (server_id, trigger_type, is_enabled, bot_id);

CREATE INDEX IF NOT EXISTS idx_server_bot_event_queue_claim
  ON public.server_bot_event_queue (status, locked_until, created_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.server_bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_bot_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_bot_event_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_bot_action_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "server_bots_service_only" ON public.server_bots;
CREATE POLICY "server_bots_service_only"
  ON public.server_bots
  FOR ALL
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

DROP POLICY IF EXISTS "server_bot_flows_service_only" ON public.server_bot_flows;
CREATE POLICY "server_bot_flows_service_only"
  ON public.server_bot_flows
  FOR ALL
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

DROP POLICY IF EXISTS "server_bot_event_queue_service_only" ON public.server_bot_event_queue;
CREATE POLICY "server_bot_event_queue_service_only"
  ON public.server_bot_event_queue
  FOR ALL
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

DROP POLICY IF EXISTS "server_bot_action_log_service_only" ON public.server_bot_action_log;
CREATE POLICY "server_bot_action_log_service_only"
  ON public.server_bot_action_log
  FOR ALL
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

CREATE OR REPLACE FUNCTION public.touch_server_bot_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.render_bot_template(_template text, _payload jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  rendered text := COALESCE(_template, '');
BEGIN
  rendered := replace(rendered, '{user}', COALESCE(_payload->>'user_mention', _payload->>'username', 'someone'));
  rendered := replace(rendered, '{username}', COALESCE(_payload->>'username', 'someone'));
  rendered := replace(rendered, '{server}', COALESCE(_payload->>'server_name', 'this server'));
  rendered := replace(rendered, '{channel}', COALESCE(_payload->>'channel_mention', _payload->>'channel_name', 'this channel'));
  rendered := replace(rendered, '$TriggeringUser', COALESCE(_payload->>'user_mention', _payload->>'username', 'someone'));
  RETURN left(trim(rendered), 2000);
END;
$function$;

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

CREATE OR REPLACE FUNCTION public.ensure_server_bot_membership(_bot_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  bot_record public.server_bots%ROWTYPE;
BEGIN
  SELECT * INTO bot_record
  FROM public.server_bots
  WHERE id = _bot_id;

  IF bot_record.id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.server_members (server_id, user_id, role, is_banned, is_muted)
  VALUES (bot_record.server_id, bot_record.bot_user_id, 'member'::public.server_role, false, false)
  ON CONFLICT (server_id, user_id) DO UPDATE
    SET is_banned = false,
        is_muted = false;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_server_bot_channel_permission(
  _bot_user_id uuid,
  _channel_id uuid,
  _permission public.permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  channel_server_id uuid;
  user_base_role public.server_role;
  user_custom_role_ids uuid[];
  everyone_role_id uuid;
  user_override_result boolean;
  channel_result boolean;
  role_result boolean;
BEGIN
  IF _bot_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = _bot_user_id AND u.is_bot = true
  ) THEN
    RETURN false;
  END IF;

  SELECT server_id INTO channel_server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF channel_server_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT sm.role INTO user_base_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _bot_user_id
    AND COALESCE(sm.is_banned, false) = false
    AND COALESCE(sm.is_muted, false) = false;

  IF user_base_role IS NULL THEN
    RETURN false;
  END IF;

  IF user_base_role = 'owner' THEN
    RETURN true;
  END IF;

  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[])
  INTO user_custom_role_ids
  FROM public.server_member_roles smr
  JOIN public.server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _bot_user_id
    AND sm.server_id = channel_server_id;

  SELECT id INTO everyone_role_id
  FROM public.server_roles
  WHERE server_id = channel_server_id
    AND name = '@everyone';

  SELECT cp.allowed INTO user_override_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id = _bot_user_id
    AND cp.role_id IS NULL
    AND cp.role_name IS NULL
  LIMIT 1;

  IF user_override_result IS NOT NULL THEN
    RETURN user_override_result;
  END IF;

  IF array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT CASE
      WHEN bool_or(cp.allowed = false) THEN false
      WHEN bool_or(cp.allowed = true) THEN true
      ELSE NULL
    END INTO channel_result
    FROM public.channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.user_id IS NULL
      AND cp.role_id = ANY(user_custom_role_ids);

    IF channel_result IS NOT NULL THEN
      RETURN channel_result;
    END IF;
  END IF;

  IF everyone_role_id IS NOT NULL THEN
    SELECT cp.allowed INTO channel_result
    FROM public.channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.user_id IS NULL
      AND cp.role_id = everyone_role_id
    LIMIT 1;

    IF channel_result IS NOT NULL THEN
      RETURN channel_result;
    END IF;
  END IF;

  SELECT cp.allowed INTO channel_result
  FROM public.channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id IS NULL
    AND cp.role_name = user_base_role
    AND cp.role_id IS NULL
  LIMIT 1;

  IF channel_result IS NOT NULL THEN
    RETURN channel_result;
  END IF;

  IF array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT CASE
      WHEN bool_or(rp.allowed = false) THEN false
      WHEN bool_or(rp.allowed = true) THEN true
      ELSE NULL
    END INTO role_result
    FROM public.role_permissions rp
    WHERE rp.server_id = channel_server_id
      AND rp.permission = _permission
      AND rp.role_id = ANY(user_custom_role_ids);

    IF role_result IS NOT NULL THEN
      RETURN role_result;
    END IF;
  END IF;

  IF everyone_role_id IS NOT NULL THEN
    SELECT rp.allowed INTO role_result
    FROM public.role_permissions rp
    WHERE rp.server_id = channel_server_id
      AND rp.permission = _permission
      AND rp.role_id = everyone_role_id
    LIMIT 1;

    IF role_result IS NOT NULL THEN
      RETURN role_result;
    END IF;
  END IF;

  SELECT rp.allowed INTO role_result
  FROM public.role_permissions rp
  WHERE rp.server_id = channel_server_id
    AND rp.permission = _permission
    AND rp.role_name = user_base_role
    AND rp.role_id IS NULL
  LIMIT 1;

  IF role_result IS NOT NULL THEN
    RETURN role_result;
  END IF;

  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'read_message_history' THEN RETURN true;
    WHEN 'send_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'attach_files' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'embed_links' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_external_emojis' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'mention_everyone' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mention_roles' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'pin_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_channels' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_threads' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'kick_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'ban_members' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mute_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'deafen_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'move_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_nicknames' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'change_nickname' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_roles' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_server' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_invites' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'create_instant_invite' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_webhooks' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'transfer_ownership' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_emojis' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'connect' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'speak' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_voice_activation' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'use_application_commands' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'view_tasks' THEN RETURN false;
    WHEN 'create_tasks' THEN RETURN false;
    WHEN 'edit_own_tasks' THEN RETURN false;
    WHEN 'edit_all_tasks' THEN RETURN false;
    WHEN 'assign_tasks' THEN RETURN false;
    WHEN 'change_task_status' THEN RETURN false;
    WHEN 'delete_tasks' THEN RETURN false;
    ELSE RETURN false;
  END CASE;
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

  IF clean_name = '' THEN
    RAISE EXCEPTION 'Bot name is required';
  END IF;

  clean_avatar_url := public.validate_server_bot_avatar_url(clean_avatar_url);

  IF NOT public.check_rate_limit(_user_id::text, 'create_server_bot', 10, 3600) THEN
    RAISE EXCEPTION 'Too many bot creation attempts. Please try again later.';
  END IF;

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

CREATE OR REPLACE FUNCTION public.delete_server_bot(_bot_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  bot_record public.server_bots%ROWTYPE;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT * INTO bot_record
  FROM public.server_bots
  WHERE id = _bot_id;

  IF bot_record.id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.check_user_server_permission(_user_id, bot_record.server_id, 'manage_webhooks'::public.permission_type) THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'delete_server_bot', 20, 3600) THEN
    RAISE EXCEPTION 'Too many bot delete attempts. Please try again later.';
  END IF;

  DELETE FROM public.server_members
  WHERE server_id = bot_record.server_id
    AND user_id = bot_record.bot_user_id;

  DELETE FROM public.server_bots
  WHERE id = bot_record.id;

  UPDATE public.users
  SET status = 'offline'::public.user_status,
      last_seen = now()
  WHERE id = bot_record.bot_user_id
    AND is_bot = true;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.upsert_server_bot_flow(
  _bot_id uuid,
  _user_id uuid,
  _flow_id uuid,
  _trigger_type text,
  _trigger_config jsonb,
  _action_type text,
  _action_config jsonb,
  _is_enabled boolean,
  _cooldown_seconds integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  bot_record public.server_bots%ROWTYPE;
  saved_flow_id uuid;
  action_channel_server_id uuid;
  action_channel_type public.channel_type;
  action_channel_is_private boolean;
  flow_count integer;
  safe_trigger_config jsonb := COALESCE(_trigger_config, '{}'::jsonb);
  safe_action_config jsonb := COALESCE(_action_config, '{}'::jsonb);
  content_match_type text;
  content_match_value text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT * INTO bot_record
  FROM public.server_bots
  WHERE id = _bot_id;

  IF bot_record.id IS NULL THEN
    RAISE EXCEPTION 'Bot not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, bot_record.server_id, 'manage_webhooks'::public.permission_type) THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  IF _trigger_type NOT IN ('member_joined', 'message_created') THEN
    RAISE EXCEPTION 'Unsupported trigger type';
  END IF;

  IF _action_type <> 'send_channel_message' THEN
    RAISE EXCEPTION 'Unsupported action type';
  END IF;

  IF NULLIF(safe_action_config->>'channel_id', '') IS NULL THEN
    RAISE EXCEPTION 'Action channel is required';
  END IF;

  IF NULLIF(trim(COALESCE(safe_action_config->>'content', '')), '') IS NULL THEN
    RAISE EXCEPTION 'Action message is required';
  END IF;

  SELECT c.server_id, c.type, COALESCE(c.is_private, false)
  INTO action_channel_server_id, action_channel_type, action_channel_is_private
  FROM public.channels c
  WHERE c.id = (safe_action_config->>'channel_id')::uuid
    AND c.type IN ('text'::public.channel_type, 'announcement'::public.channel_type);

  IF action_channel_server_id IS DISTINCT FROM bot_record.server_id THEN
    RAISE EXCEPTION 'Action channel must belong to the bot server';
  END IF;

  IF NOT public.check_user_permission(_user_id, (safe_action_config->>'channel_id')::uuid, 'view_channels'::public.permission_type)
     OR NOT public.check_user_permission(_user_id, (safe_action_config->>'channel_id')::uuid, 'send_messages'::public.permission_type) THEN
    RAISE EXCEPTION 'You do not have permission to use that action channel';
  END IF;

  IF action_channel_is_private = true
     AND NOT EXISTS (
       SELECT 1
       FROM public.channel_members cm
       WHERE cm.channel_id = (safe_action_config->>'channel_id')::uuid
         AND cm.user_id = _user_id
     ) THEN
    RAISE EXCEPTION 'You do not have permission to use that private action channel';
  END IF;

  IF action_channel_type = 'announcement'::public.channel_type
     AND NOT public.check_user_permission(_user_id, (safe_action_config->>'channel_id')::uuid, 'manage_messages'::public.permission_type) THEN
    RAISE EXCEPTION 'You do not have permission to post announcements with bots';
  END IF;

  IF _trigger_type = 'message_created' AND NULLIF(safe_trigger_config->>'channel_id', '') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id = (safe_trigger_config->>'channel_id')::uuid
        AND c.server_id = bot_record.server_id
        AND c.type IN ('text'::public.channel_type, 'announcement'::public.channel_type)
    ) THEN
      RAISE EXCEPTION 'Trigger channel must belong to the bot server';
    END IF;

    IF NOT public.check_user_permission(_user_id, (safe_trigger_config->>'channel_id')::uuid, 'view_channels'::public.permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to use that trigger channel';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.channels c
      WHERE c.id = (safe_trigger_config->>'channel_id')::uuid
        AND COALESCE(c.is_private, false) = true
    )
       AND NOT EXISTS (
         SELECT 1
         FROM public.channel_members cm
         WHERE cm.channel_id = (safe_trigger_config->>'channel_id')::uuid
           AND cm.user_id = _user_id
       ) THEN
      RAISE EXCEPTION 'You do not have permission to use that private trigger channel';
    END IF;
  END IF;

  content_match_type := COALESCE(NULLIF(safe_trigger_config->>'content_match_type', ''), 'any');
  content_match_value := NULLIF(trim(COALESCE(safe_trigger_config->>'content_match_value', '')), '');

  IF content_match_type NOT IN ('any', 'contains', 'exact') THEN
    RAISE EXCEPTION 'Unsupported content match type';
  END IF;

  IF content_match_type = 'any' THEN
    safe_trigger_config := safe_trigger_config - 'content_match_value';
  ELSIF content_match_value IS NULL THEN
    RAISE EXCEPTION 'Message match value is required';
  ELSE
    safe_trigger_config := jsonb_set(safe_trigger_config, '{content_match_value}', to_jsonb(left(content_match_value, 120)), true);
  END IF;

  safe_trigger_config := jsonb_set(safe_trigger_config, '{content_match_type}', to_jsonb(content_match_type), true);
  safe_action_config := jsonb_set(safe_action_config, '{content}', to_jsonb(left(trim(safe_action_config->>'content'), 2000)), true);

  PERFORM public.ensure_server_bot_membership(bot_record.id);

  INSERT INTO public.channel_members (channel_id, user_id, added_by)
  SELECT (safe_action_config->>'channel_id')::uuid, bot_record.bot_user_id, _user_id
  FROM public.channels c
  WHERE c.id = (safe_action_config->>'channel_id')::uuid
    AND c.is_private = true
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  IF _flow_id IS NULL THEN
    SELECT count(*) INTO flow_count
    FROM public.server_bot_flows
    WHERE bot_id = _bot_id;

    IF flow_count >= 25 THEN
      RAISE EXCEPTION 'This bot has reached the flow limit';
    END IF;

    INSERT INTO public.server_bot_flows (
      server_id, bot_id, trigger_type, trigger_config, action_type, action_config, is_enabled, cooldown_seconds
    )
    VALUES (
      bot_record.server_id,
      _bot_id,
      _trigger_type,
      safe_trigger_config,
      _action_type,
      safe_action_config,
      COALESCE(_is_enabled, true),
      GREATEST(0, LEAST(COALESCE(_cooldown_seconds, 10), 86400))
    )
    RETURNING id INTO saved_flow_id;
  ELSE
    UPDATE public.server_bot_flows
    SET trigger_type = _trigger_type,
        trigger_config = safe_trigger_config,
        action_type = _action_type,
        action_config = safe_action_config,
        is_enabled = COALESCE(_is_enabled, is_enabled),
        cooldown_seconds = GREATEST(0, LEAST(COALESCE(_cooldown_seconds, cooldown_seconds), 86400))
    WHERE id = _flow_id
      AND bot_id = _bot_id
    RETURNING id INTO saved_flow_id;
  END IF;

  RETURN (
    SELECT row_to_json(f)
    FROM public.server_bot_flows f
    WHERE f.id = saved_flow_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_server_bot_flow(_flow_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  flow_server_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO flow_server_id
  FROM public.server_bot_flows
  WHERE id = _flow_id;

  IF flow_server_id IS NULL THEN
    RETURN false;
  END IF;

  IF NOT public.check_user_server_permission(_user_id, flow_server_id, 'manage_webhooks'::public.permission_type) THEN
    RAISE EXCEPTION 'You do not have permission to manage bots';
  END IF;

  DELETE FROM public.server_bot_flows
  WHERE id = _flow_id;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  channel_record record;
  user_record record;
  server_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.is_bot = true) THEN
    RETURN NEW;
  END IF;

  SELECT c.id, c.server_id, c.name
  INTO channel_record
  FROM public.channels c
  WHERE c.id = NEW.channel_id
    AND c.type IN ('text'::public.channel_type, 'announcement'::public.channel_type);

  IF channel_record.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.server_bot_flows f
    JOIN public.server_bots b ON b.id = f.bot_id
    WHERE f.server_id = channel_record.server_id
      AND f.trigger_type = 'message_created'
      AND f.is_enabled = true
      AND b.is_enabled = true
      AND (
        NULLIF(f.trigger_config->>'channel_id', '') IS NULL
        OR f.trigger_config->>'channel_id' = NEW.channel_id::text
      )
      AND (
        NULLIF(f.trigger_config->>'role_id', '') IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.server_members sm
          JOIN public.server_member_roles smr ON smr.member_id = sm.id
          WHERE sm.server_id = channel_record.server_id
            AND sm.user_id = NEW.user_id
            AND smr.role_id = (f.trigger_config->>'role_id')::uuid
        )
      )
      AND (
        COALESCE(NULLIF(f.trigger_config->>'content_match_type', ''), 'any') = 'any'
        OR (
          COALESCE(NULLIF(f.trigger_config->>'content_match_type', ''), 'any') = 'contains'
          AND position(lower(trim(COALESCE(f.trigger_config->>'content_match_value', ''))) in lower(trim(COALESCE(NEW.content, '')))) > 0
        )
        OR (
          COALESCE(NULLIF(f.trigger_config->>'content_match_type', ''), 'any') = 'exact'
          AND lower(trim(COALESCE(f.trigger_config->>'content_match_value', ''))) = lower(trim(COALESCE(NEW.content, '')))
        )
      )
  ) THEN
    RETURN NEW;
  END IF;

  SELECT u.username, COALESCE(u.display_name, u.username) AS display_name
  INTO user_record
  FROM public.users u
  WHERE u.id = NEW.user_id;

  SELECT s.name INTO server_name
  FROM public.servers s
  WHERE s.id = channel_record.server_id;

  INSERT INTO public.server_bot_event_queue (server_id, event_type, event_key, payload)
  VALUES (
    channel_record.server_id,
    'message_created',
    'message:' || NEW.id::text,
    jsonb_build_object(
      'message_id', NEW.id,
      'channel_id', NEW.channel_id,
      'channel_name', channel_record.name,
      'channel_mention', '#' || channel_record.name,
      'user_id', NEW.user_id,
      'username', COALESCE(user_record.display_name, user_record.username, 'someone'),
      'user_mention', '<@' || NEW.user_id::text || '>',
      'server_id', channel_record.server_id,
      'server_name', COALESCE(server_name, 'this server'),
      'content', NEW.content,
      'content_normalized', lower(trim(NEW.content))
    )
  )
  ON CONFLICT (event_key) DO NOTHING;

  PERFORM pg_notify('server_bot_events', channel_record.server_id::text);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_member_joined()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  user_record record;
  server_name text;
BEGIN
  IF COALESCE(NEW.is_banned, false) = true THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.is_bot = true) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.server_bot_flows f
    JOIN public.server_bots b ON b.id = f.bot_id
    WHERE f.server_id = NEW.server_id
      AND f.trigger_type = 'member_joined'
      AND f.is_enabled = true
      AND b.is_enabled = true
  ) THEN
    RETURN NEW;
  END IF;

  SELECT u.username, COALESCE(u.display_name, u.username) AS display_name
  INTO user_record
  FROM public.users u
  WHERE u.id = NEW.user_id;

  SELECT s.name INTO server_name
  FROM public.servers s
  WHERE s.id = NEW.server_id;

  INSERT INTO public.server_bot_event_queue (server_id, event_type, event_key, payload)
  VALUES (
    NEW.server_id,
    'member_joined',
    'member_joined:' || NEW.server_id::text || ':' || NEW.user_id::text || ':' || NEW.id::text,
    jsonb_build_object(
      'member_id', NEW.id,
      'user_id', NEW.user_id,
      'username', COALESCE(user_record.display_name, user_record.username, 'someone'),
      'user_mention', '<@' || NEW.user_id::text || '>',
      'server_id', NEW.server_id,
      'server_name', COALESCE(server_name, 'this server')
    )
  )
  ON CONFLICT (event_key) DO NOTHING;

  PERFORM pg_notify('server_bot_events', NEW.server_id::text);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_server_bot_message_created ON public.messages;
CREATE TRIGGER trg_server_bot_message_created
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_server_bot_message_created();

DROP TRIGGER IF EXISTS trg_server_bot_member_joined ON public.server_members;
CREATE TRIGGER trg_server_bot_member_joined
AFTER INSERT ON public.server_members
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_server_bot_member_joined();

CREATE OR REPLACE FUNCTION public.process_server_bot_events(
  _max_events integer DEFAULT 25,
  _max_actions integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  event_record public.server_bot_event_queue%ROWTYPE;
  flow_record record;
  processed_events integer := 0;
  completed_events integer := 0;
  actions_completed integer := 0;
  action_limit integer := GREATEST(1, LEAST(COALESCE(_max_actions, 50), 200));
  event_limit integer := GREATEST(1, LEAST(COALESCE(_max_events, 25), 100));
  content_normalized text;
  match_type text;
  match_value text;
  rendered_content text;
  new_message_id uuid;
  action_channel record;
  claimed_flow_id uuid;
BEGIN
  FOR event_record IN
    SELECT *
    FROM public.server_bot_event_queue
    WHERE status IN ('pending', 'processing')
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY created_at ASC
    LIMIT event_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    processed_events := processed_events + 1;

    UPDATE public.server_bot_event_queue
    SET status = 'processing',
        attempts = attempts + 1,
        locked_until = now() + interval '2 minutes',
        updated_at = now(),
        last_error = NULL
    WHERE id = event_record.id;

    BEGIN
      content_normalized := lower(trim(COALESCE(event_record.payload->>'content', '')));

      FOR flow_record IN
        SELECT f.*, b.bot_user_id
        FROM public.server_bot_flows f
        JOIN public.server_bots b ON b.id = f.bot_id
        WHERE f.server_id = event_record.server_id
          AND f.trigger_type = event_record.event_type
          AND f.action_type = 'send_channel_message'
          AND f.is_enabled = true
          AND b.is_enabled = true
          AND (
            f.last_triggered_at IS NULL
            OR f.last_triggered_at <= now() - make_interval(secs => COALESCE(f.cooldown_seconds, 0))
          )
        ORDER BY f.created_at ASC
      LOOP
        EXIT WHEN actions_completed >= action_limit;

        IF EXISTS (
          SELECT 1 FROM public.server_bot_action_log l
          WHERE l.event_id = event_record.id
            AND l.flow_id = flow_record.id
        ) THEN
          CONTINUE;
        END IF;

        IF flow_record.trigger_type = 'message_created' THEN
          IF NULLIF(flow_record.trigger_config->>'channel_id', '') IS NOT NULL
             AND flow_record.trigger_config->>'channel_id' <> event_record.payload->>'channel_id' THEN
            CONTINUE;
          END IF;

          match_type := COALESCE(NULLIF(flow_record.trigger_config->>'content_match_type', ''), 'any');
          match_value := lower(trim(COALESCE(flow_record.trigger_config->>'content_match_value', '')));

          IF match_type = 'contains' AND (match_value = '' OR position(match_value in content_normalized) = 0) THEN
            CONTINUE;
          END IF;

          IF match_type = 'exact' AND (match_value = '' OR content_normalized <> match_value) THEN
            CONTINUE;
          END IF;
        END IF;

        IF NULLIF(flow_record.trigger_config->>'role_id', '') IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1
            FROM public.server_members sm
            JOIN public.server_member_roles smr ON smr.member_id = sm.id
            WHERE sm.server_id = event_record.server_id
              AND sm.user_id = (event_record.payload->>'user_id')::uuid
              AND smr.role_id = (flow_record.trigger_config->>'role_id')::uuid
          ) THEN
            CONTINUE;
          END IF;
        END IF;

        SELECT c.id, c.server_id, c.is_private, c.type
        INTO action_channel
        FROM public.channels c
        WHERE c.id = (flow_record.action_config->>'channel_id')::uuid
          AND c.server_id = event_record.server_id
          AND c.type IN ('text'::public.channel_type, 'announcement'::public.channel_type);

        IF action_channel.id IS NULL THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Action channel not found')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        IF action_channel.is_private = true AND NOT EXISTS (
          SELECT 1
          FROM public.channel_members cm
          WHERE cm.channel_id = action_channel.id
            AND cm.user_id = flow_record.bot_user_id
        ) THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot is not a member of the private channel')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM public.server_members sm
          WHERE sm.server_id = event_record.server_id
            AND sm.user_id = flow_record.bot_user_id
            AND COALESCE(sm.is_banned, false) = false
            AND COALESCE(sm.is_muted, false) = false
        ) THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot is not an active server member')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        rendered_content := public.render_bot_template(flow_record.action_config->>'content', event_record.payload);
        IF rendered_content = '' THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Rendered message was empty')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        IF NOT public.check_server_bot_channel_permission(
          flow_record.bot_user_id,
          action_channel.id,
          'send_messages'::public.permission_type
        ) THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot send messages in this channel')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        IF action_channel.type = 'announcement'::public.channel_type
           AND NOT public.check_server_bot_channel_permission(
             flow_record.bot_user_id,
             action_channel.id,
             'manage_messages'::public.permission_type
           ) THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot post announcements')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        IF rendered_content ~* '(^|[^A-Za-z0-9_])@(everyone|here)([^A-Za-z0-9_]|$)'
           AND NOT public.check_server_bot_channel_permission(
             flow_record.bot_user_id,
             action_channel.id,
             'mention_everyone'::public.permission_type
           ) THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot mention everyone or here')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        IF NOT public.check_mention_limit(rendered_content) THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Message has too many mentions')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        IF NOT public.check_message_rate_limit(flow_record.bot_user_id, action_channel.id) THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'skipped', 'Bot message rate limit reached')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        IF NOT public.check_no_duplicate_message(flow_record.bot_user_id, action_channel.id, rendered_content) THEN
          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'skipped', 'Duplicate bot message suppressed')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
          CONTINUE;
        END IF;

        claimed_flow_id := NULL;
        UPDATE public.server_bot_flows
        SET last_triggered_at = now()
        WHERE id = flow_record.id
          AND (
            last_triggered_at IS NULL
            OR last_triggered_at <= now() - make_interval(secs => COALESCE(cooldown_seconds, 0))
          )
        RETURNING id INTO claimed_flow_id;

        IF claimed_flow_id IS NULL THEN
          CONTINUE;
        END IF;

        INSERT INTO public.messages (channel_id, user_id, content, is_system_message)
        VALUES (action_channel.id, flow_record.bot_user_id, rendered_content, false)
        RETURNING id INTO new_message_id;

        INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, message_id, status)
        VALUES (event_record.id, flow_record.id, flow_record.action_type, new_message_id, 'completed')
        ON CONFLICT (event_id, flow_id) DO NOTHING;

        actions_completed := actions_completed + 1;
      END LOOP;

      UPDATE public.server_bot_event_queue
      SET status = 'completed',
          completed_at = now(),
          locked_until = NULL,
          updated_at = now()
      WHERE id = event_record.id;

      completed_events := completed_events + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.server_bot_event_queue
      SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
          locked_until = NULL,
          last_error = SQLERRM,
          updated_at = now()
      WHERE id = event_record.id;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'events_processed', processed_events,
    'events_completed', completed_events,
    'actions_completed', actions_completed
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.kick_server_bot_event_processing()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  BEGIN
    PERFORM public.process_server_bot_events(1, 5);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'server bot inline processing failed: %', SQLERRM;
  END;

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS trg_server_bot_event_queue_inline_process ON public.server_bot_event_queue;
CREATE TRIGGER trg_server_bot_event_queue_inline_process
AFTER INSERT ON public.server_bot_event_queue
FOR EACH STATEMENT
EXECUTE FUNCTION public.kick_server_bot_event_processing();

REVOKE EXECUTE ON FUNCTION public.touch_server_bot_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.render_bot_template(text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_server_bot_avatar_url(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_server_bot_membership(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_server_bot_channel_permission(uuid, uuid, public.permission_type) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_server_bots(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_server_bot(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_server_bot(uuid, uuid, text, boolean, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_server_bot(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.upsert_server_bot_flow(uuid, uuid, uuid, text, jsonb, text, jsonb, boolean, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_server_bot_flow(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_message_created() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_member_joined() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_server_bot_events(integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.kick_server_bot_event_processing() FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_bots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_bot_flows TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_bot_event_queue TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.server_bot_action_log TO service_role;

GRANT EXECUTE ON FUNCTION public.get_server_bots(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_server_bot(uuid, uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_server_bot(uuid, uuid, text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_server_bot(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_server_bot_flow(uuid, uuid, uuid, text, jsonb, text, jsonb, boolean, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_server_bot_flow(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_server_bot_events(integer, integer) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
