-- Expand server bot triggers beyond chat messages and member joins.

CREATE OR REPLACE FUNCTION public.server_bot_supported_trigger_types()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ARRAY[
    'reaction_added',
    'member_joined',
    'message_created',
    'calendar_event_created',
    'calendar_event_updated',
    'calendar_event_deleted',
    'forum_topic_created',
    'forum_topic_updated',
    'forum_topic_deleted',
    'list_item_created',
    'list_item_updated',
    'list_item_deleted',
    'media_created',
    'media_updated',
    'media_deleted',
    'announcement_created',
    'announcement_updated',
    'announcement_deleted'
  ]::text[];
$function$;

CREATE OR REPLACE FUNCTION public.server_bot_supported_action_types()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT ARRAY[
    'send_channel_message',
    'delete_message',
    'add_reaction',
    'assign_role',
    'create_forum_topic',
    'create_list_item',
    'remove_role'
  ]::text[];
$function$;

ALTER TABLE public.server_bot_flows
  DROP CONSTRAINT IF EXISTS server_bot_flows_trigger_type_check;

ALTER TABLE public.server_bot_flows
  ADD CONSTRAINT server_bot_flows_trigger_type_check
  CHECK (trigger_type = ANY (public.server_bot_supported_trigger_types()));

ALTER TABLE public.server_bot_flows
  DROP CONSTRAINT IF EXISTS server_bot_flows_action_type_check;

ALTER TABLE public.server_bot_flows
  ADD CONSTRAINT server_bot_flows_action_type_check
  CHECK (action_type = ANY (public.server_bot_supported_action_types()));

ALTER TABLE public.server_bot_event_queue
  DROP CONSTRAINT IF EXISTS server_bot_event_queue_event_type_check;

ALTER TABLE public.server_bot_event_queue
  ADD CONSTRAINT server_bot_event_queue_event_type_check
  CHECK (event_type = ANY (public.server_bot_supported_trigger_types()));

CREATE OR REPLACE FUNCTION public.server_bot_has_enabled_flow(_server_id uuid, _event_type text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.server_bot_flows f
    JOIN public.server_bots b ON b.id = f.bot_id
    WHERE f.server_id = _server_id
      AND f.trigger_type = _event_type
      AND f.is_enabled = true
      AND b.is_enabled = true
  );
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_event(
  _server_id uuid,
  _event_type text,
  _event_key text,
  _payload jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF _server_id IS NULL OR _event_type IS NULL OR _event_key IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.server_bot_has_enabled_flow(_server_id, _event_type) THEN
    RETURN;
  END IF;

  INSERT INTO public.server_bot_event_queue (server_id, event_type, event_key, payload)
  VALUES (_server_id, _event_type, _event_key, COALESCE(_payload, '{}'::jsonb))
  ON CONFLICT (event_key) DO NOTHING;

  PERFORM pg_notify('server_bot_events', _server_id::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.server_bot_event_user_payload(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  user_record record;
BEGIN
  IF _user_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT u.username, COALESCE(u.display_name, u.username) AS display_name
  INTO user_record
  FROM public.users u
  WHERE u.id = _user_id;

  RETURN jsonb_build_object(
    'user_id', _user_id,
    'username', COALESCE(user_record.display_name, user_record.username, 'someone'),
    'user_mention', '<@' || _user_id::text || '>'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.server_bot_event_channel_payload(_channel_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  channel_record record;
  server_name text;
BEGIN
  SELECT c.id, c.server_id, c.name, c.type
  INTO channel_record
  FROM public.channels c
  WHERE c.id = _channel_id;

  IF channel_record.id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT s.name INTO server_name
  FROM public.servers s
  WHERE s.id = channel_record.server_id;

  RETURN jsonb_build_object(
    'server_id', channel_record.server_id,
    'server_name', COALESCE(server_name, 'this server'),
    'channel_id', channel_record.id,
    'channel_name', channel_record.name,
    'channel_mention', '<#' || channel_record.id::text || '>',
    'channel_type', channel_record.type::text
  );
END;
$function$;

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
  rendered := replace(rendered, '{item}', COALESCE(_payload->>'item_title', _payload->>'content', 'an item'));
  rendered := replace(rendered, '{emoji}', COALESCE(_payload->>'emoji', 'a reaction'));
  rendered := replace(rendered, '$TriggeringUser', COALESCE(_payload->>'user_mention', _payload->>'username', 'someone'));
  RETURN left(trim(rendered), 2000);
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
  flow_record public.server_bot_flows%ROWTYPE;
  safe_trigger_config jsonb := COALESCE(_trigger_config, '{}'::jsonb);
  safe_action_config jsonb := COALESCE(_action_config, '{}'::jsonb);
  action_channel_id uuid;
  action_channel_server_id uuid;
  action_channel_type public.channel_type;
  trigger_channel record;
  action_role_id uuid;
  action_role_name text;
  action_content text;
  action_emoji text;
  trigger_emoji text;
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
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF _trigger_type IS NULL OR NOT (_trigger_type = ANY (public.server_bot_supported_trigger_types())) THEN
    RAISE EXCEPTION 'Unsupported trigger type';
  END IF;

  IF _action_type IS NULL OR NOT (_action_type = ANY (public.server_bot_supported_action_types())) THEN
    RAISE EXCEPTION 'Unsupported action type';
  END IF;

  IF _action_type IN ('delete_message', 'add_reaction')
     AND _trigger_type NOT IN (
       'reaction_added',
       'message_created',
       'forum_topic_created',
       'forum_topic_updated',
       'forum_topic_deleted',
       'announcement_created',
       'announcement_updated',
       'announcement_deleted'
     ) THEN
    RAISE EXCEPTION 'This action requires a trigger with a source message';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'upsert_server_bot_flow', 60, 3600) THEN
    RAISE EXCEPTION 'Too many flow updates. Please try again later.';
  END IF;

  IF _action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item') THEN
    SELECT c.id, c.server_id, c.type
    INTO action_channel_id, action_channel_server_id, action_channel_type
    FROM public.channels c
    WHERE c.id = NULLIF(safe_action_config->>'channel_id', '')::uuid
      AND c.server_id = bot_record.server_id
      AND (
        (_action_type = 'send_channel_message' AND c.type IN ('text'::public.channel_type, 'announcement'::public.channel_type))
        OR (_action_type = 'create_forum_topic' AND c.type = 'forum'::public.channel_type)
        OR (_action_type = 'create_list_item' AND c.type = 'tasks'::public.channel_type)
      );

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a compatible channel for the action';
    END IF;

    IF action_channel_type = 'announcement'::public.channel_type
       AND NOT public.check_user_permission(_user_id, action_channel_id, 'manage_messages'::public.permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to post announcements with bots';
    END IF;
  END IF;

  IF NULLIF(safe_trigger_config->>'channel_id', '') IS NOT NULL THEN
    SELECT c.id, c.server_id
    INTO trigger_channel
    FROM public.channels c
    WHERE c.id = (safe_trigger_config->>'channel_id')::uuid
      AND c.server_id = bot_record.server_id;

    IF trigger_channel.id IS NULL THEN
      RAISE EXCEPTION 'Trigger channel not found';
    END IF;
  END IF;

  IF NULLIF(safe_trigger_config->>'role_id', '') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.server_roles sr
       WHERE sr.id = (safe_trigger_config->>'role_id')::uuid
         AND sr.server_id = bot_record.server_id
     ) THEN
    RAISE EXCEPTION 'Trigger role not found';
  END IF;

  IF _action_type IN ('assign_role', 'remove_role') THEN
    SELECT sr.id, sr.name
    INTO action_role_id, action_role_name
    FROM public.server_roles sr
    WHERE sr.id = NULLIF(safe_action_config->>'role_id', '')::uuid
      AND sr.server_id = bot_record.server_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Choose a valid role for the action';
    END IF;

    IF action_role_name = '@everyone' THEN
      RAISE EXCEPTION 'Choose a valid role for the action';
    END IF;
  END IF;

  action_content := left(trim(COALESCE(safe_action_config->>'content', '')), 2000);
  action_emoji := left(trim(COALESCE(safe_action_config->>'emoji', '')), 64);
  trigger_emoji := left(trim(COALESCE(safe_trigger_config->>'emoji', '')), 64);

  IF _action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item') AND action_content = '' THEN
    RAISE EXCEPTION 'Action text is required';
  END IF;

  IF _action_type = 'add_reaction' AND action_emoji = '' THEN
    RAISE EXCEPTION 'Reaction emoji is required';
  END IF;

  safe_action_config := jsonb_build_object(
    'channel_id', CASE WHEN _action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item') THEN action_channel_id ELSE NULL END,
    'content', CASE WHEN _action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item') THEN action_content ELSE NULL END,
    'emoji', CASE WHEN _action_type = 'add_reaction' THEN action_emoji ELSE NULL END,
    'role_id', CASE WHEN _action_type IN ('assign_role', 'remove_role') THEN action_role_id ELSE NULL END
  );

  safe_trigger_config := jsonb_build_object(
    'channel_id', NULLIF(safe_trigger_config->>'channel_id', ''),
    'role_id', NULLIF(safe_trigger_config->>'role_id', ''),
    'content_match_type', CASE
      WHEN _trigger_type = 'message_created'
       AND COALESCE(safe_trigger_config->>'content_match_type', 'any') IN ('any', 'contains', 'exact')
      THEN COALESCE(safe_trigger_config->>'content_match_type', 'any')
      ELSE 'any'
    END,
    'content_match_value', CASE
      WHEN _trigger_type = 'message_created'
      THEN left(trim(COALESCE(safe_trigger_config->>'content_match_value', '')), 120)
      ELSE NULL
    END,
    'emoji', CASE WHEN _trigger_type = 'reaction_added' AND trigger_emoji <> '' THEN trigger_emoji ELSE NULL END
  );

  PERFORM public.ensure_server_bot_membership(bot_record.id);

  IF _flow_id IS NOT NULL THEN
    SELECT * INTO flow_record
    FROM public.server_bot_flows
    WHERE id = _flow_id
      AND bot_id = bot_record.id;

    IF flow_record.id IS NULL THEN
      RAISE EXCEPTION 'Flow not found';
    END IF;

    UPDATE public.server_bot_flows
    SET trigger_type = _trigger_type,
        trigger_config = safe_trigger_config,
        action_type = _action_type,
        action_config = safe_action_config,
        is_enabled = COALESCE(_is_enabled, true),
        cooldown_seconds = GREATEST(0, LEAST(COALESCE(_cooldown_seconds, 10), 86400))
    WHERE id = _flow_id
    RETURNING * INTO flow_record;
  ELSE
    INSERT INTO public.server_bot_flows (
      server_id, bot_id, trigger_type, trigger_config, action_type, action_config, is_enabled, cooldown_seconds
    )
    VALUES (
      bot_record.server_id,
      bot_record.id,
      _trigger_type,
      safe_trigger_config,
      _action_type,
      safe_action_config,
      COALESCE(_is_enabled, true),
      GREATEST(0, LEAST(COALESCE(_cooldown_seconds, 10), 86400))
    )
    RETURNING * INTO flow_record;
  END IF;

  RETURN to_json(flow_record);
END;
$function$;

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
  source_message record;
  action_channel record;
  target_member record;
  claimed_flow_id uuid;
  new_message_id uuid;
  new_task_id uuid;
  task_position integer;
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

        IF NULLIF(flow_record.trigger_config->>'channel_id', '') IS NOT NULL
           AND flow_record.trigger_config->>'channel_id' <> event_record.payload->>'channel_id' THEN
          CONTINUE;
        END IF;

        IF flow_record.trigger_type = 'message_created' THEN
          match_type := COALESCE(NULLIF(flow_record.trigger_config->>'content_match_type', ''), 'any');
          match_value := lower(trim(COALESCE(flow_record.trigger_config->>'content_match_value', '')));

          IF match_type = 'contains' AND (match_value = '' OR position(match_value in content_normalized) = 0) THEN
            CONTINUE;
          END IF;

          IF match_type = 'exact' AND (match_value = '' OR content_normalized <> match_value) THEN
            CONTINUE;
          END IF;
        END IF;

        IF flow_record.trigger_type = 'reaction_added'
           AND NULLIF(flow_record.trigger_config->>'emoji', '') IS NOT NULL
           AND flow_record.trigger_config->>'emoji' <> event_record.payload->>'emoji' THEN
          CONTINUE;
        END IF;

        IF NULLIF(flow_record.trigger_config->>'role_id', '') IS NOT NULL THEN
          IF NULLIF(event_record.payload->>'user_id', '') IS NULL OR NOT EXISTS (
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

        IF flow_record.action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item') THEN
          SELECT c.id, c.server_id, c.is_private, c.type
          INTO action_channel
          FROM public.channels c
          WHERE c.id = (flow_record.action_config->>'channel_id')::uuid
            AND c.server_id = event_record.server_id
            AND (
              (flow_record.action_type = 'send_channel_message' AND c.type IN ('text'::public.channel_type, 'announcement'::public.channel_type))
              OR (flow_record.action_type = 'create_forum_topic' AND c.type = 'forum'::public.channel_type)
              OR (flow_record.action_type = 'create_list_item' AND c.type = 'tasks'::public.channel_type)
            );

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

          rendered_content := public.render_bot_template(flow_record.action_config->>'content', event_record.payload);
          IF rendered_content = '' THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Rendered content was empty')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;
        END IF;

        IF flow_record.action_type = 'send_channel_message' THEN
          IF NOT public.check_server_bot_channel_permission(flow_record.bot_user_id, action_channel.id, 'send_messages'::public.permission_type) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot send messages in this channel')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF action_channel.type = 'announcement'::public.channel_type
             AND NOT public.check_server_bot_channel_permission(flow_record.bot_user_id, action_channel.id, 'manage_messages'::public.permission_type) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot post announcements')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF rendered_content ~* '(^|[^A-Za-z0-9_])@(everyone|here)([^A-Za-z0-9_]|$)'
             AND NOT public.check_server_bot_channel_permission(flow_record.bot_user_id, action_channel.id, 'mention_everyone'::public.permission_type) THEN
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

          INSERT INTO public.messages (channel_id, user_id, content, is_system_message)
          VALUES (action_channel.id, flow_record.bot_user_id, rendered_content, false)
          RETURNING id INTO new_message_id;

          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, message_id, status)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, new_message_id, 'completed')
          ON CONFLICT (event_id, flow_id) DO NOTHING;

        ELSIF flow_record.action_type = 'delete_message' THEN
          SELECT m.id, m.channel_id, c.server_id, c.is_private
          INTO source_message
          FROM public.messages m
          JOIN public.channels c ON c.id = m.channel_id
          WHERE m.id = NULLIF(event_record.payload->>'message_id', '')::uuid
            AND c.server_id = event_record.server_id;

          IF source_message.id IS NULL THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Source message not found')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF NOT public.check_server_bot_channel_permission(flow_record.bot_user_id, source_message.channel_id, 'manage_messages'::public.permission_type) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot delete messages in this channel')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          DELETE FROM public.messages
          WHERE id = source_message.id;

          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, message_id, status)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, source_message.id, 'completed')
          ON CONFLICT (event_id, flow_id) DO NOTHING;

        ELSIF flow_record.action_type = 'add_reaction' THEN
          SELECT m.id, m.channel_id, c.server_id
          INTO source_message
          FROM public.messages m
          JOIN public.channels c ON c.id = m.channel_id
          WHERE m.id = NULLIF(event_record.payload->>'message_id', '')::uuid
            AND c.server_id = event_record.server_id;

          IF source_message.id IS NULL THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Source message not found')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF NOT public.check_server_bot_channel_permission(flow_record.bot_user_id, source_message.channel_id, 'add_reactions'::public.permission_type) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot add reactions in this channel')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          INSERT INTO public.reactions (message_id, user_id, emoji, channel_id)
          VALUES (source_message.id, flow_record.bot_user_id, flow_record.action_config->>'emoji', source_message.channel_id)
          ON CONFLICT DO NOTHING;

          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, message_id, status)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, source_message.id, 'completed')
          ON CONFLICT (event_id, flow_id) DO NOTHING;

        ELSIF flow_record.action_type IN ('assign_role', 'remove_role') THEN
          SELECT sm.id, sm.user_id
          INTO target_member
          FROM public.server_members sm
          WHERE sm.server_id = event_record.server_id
            AND sm.user_id = NULLIF(event_record.payload->>'user_id', '')::uuid
            AND COALESCE(sm.is_banned, false) = false;

          IF target_member.id IS NULL THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Triggering member not found')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF NOT public.check_user_server_permission(flow_record.bot_user_id, event_record.server_id, 'manage_roles'::public.permission_type) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot manage roles')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF flow_record.action_type = 'assign_role' THEN
            INSERT INTO public.server_member_roles (member_id, role_id)
            VALUES (target_member.id, (flow_record.action_config->>'role_id')::uuid)
            ON CONFLICT (member_id, role_id) DO NOTHING;
          ELSE
            DELETE FROM public.server_member_roles
            WHERE member_id = target_member.id
              AND role_id = (flow_record.action_config->>'role_id')::uuid;
          END IF;

          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'completed')
          ON CONFLICT (event_id, flow_id) DO NOTHING;

        ELSIF flow_record.action_type = 'create_forum_topic' THEN
          IF NOT public.check_server_bot_channel_permission(flow_record.bot_user_id, action_channel.id, 'send_messages'::public.permission_type) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot create topics in this channel')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          INSERT INTO public.messages (channel_id, user_id, content, is_system_message)
          VALUES (action_channel.id, flow_record.bot_user_id, left(rendered_content, 500), false)
          RETURNING id INTO new_message_id;

          INSERT INTO public.threads (channel_id, message_id, created_by)
          VALUES (action_channel.id, new_message_id, flow_record.bot_user_id);

          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, message_id, status)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, new_message_id, 'completed')
          ON CONFLICT (event_id, flow_id) DO NOTHING;

        ELSIF flow_record.action_type = 'create_list_item' THEN
          IF NOT public.check_server_bot_channel_permission(flow_record.bot_user_id, action_channel.id, 'create_tasks'::public.permission_type) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot create list items in this channel')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          SELECT COALESCE(MAX(task_position), -1) + 1
          INTO task_position
          FROM public.tasks
          WHERE channel_id = action_channel.id
            AND category_id IS NULL;

          INSERT INTO public.tasks (
            channel_id,
            server_id,
            created_by,
            title,
            description,
            priority,
            task_position
          )
          VALUES (
            action_channel.id,
            event_record.server_id,
            flow_record.bot_user_id,
            left(rendered_content, 120),
            NULL,
            'medium'::public.task_priority,
            task_position
          )
          RETURNING id INTO new_task_id;

          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'completed')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
        END IF;

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

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  channel_record record;
BEGIN
  IF COALESCE(NEW.is_system_message, false) = true THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.is_bot = true) THEN
    RETURN NEW;
  END IF;

  SELECT c.id, c.server_id, c.name, c.type
  INTO channel_record
  FROM public.channels c
  WHERE c.id = NEW.channel_id;

  IF channel_record.type = 'announcement'::public.channel_type THEN
    PERFORM public.enqueue_server_bot_event(
      channel_record.server_id,
      'announcement_created',
      'announcement_created:' || NEW.id::text,
      public.server_bot_event_channel_payload(NEW.channel_id)
        || public.server_bot_event_user_payload(NEW.user_id)
        || jsonb_build_object('message_id', NEW.id, 'item_id', NEW.id, 'item_title', left(NEW.content, 120), 'content', NEW.content)
    );
    RETURN NEW;
  END IF;

  IF channel_record.type != 'text'::public.channel_type THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_server_bot_event(
    channel_record.server_id,
    'message_created',
    'message:' || NEW.id::text,
    public.server_bot_event_channel_payload(NEW.channel_id)
      || public.server_bot_event_user_payload(NEW.user_id)
      || jsonb_build_object('message_id', NEW.id, 'content', NEW.content, 'content_normalized', lower(trim(NEW.content)))
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_message_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  row_record record;
  event_type text;
  source_message public.messages%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN
    source_message := OLD;
  ELSE
    source_message := NEW;
  END IF;

  SELECT c.server_id, c.type
  INTO row_record
  FROM public.channels c
  WHERE c.id = source_message.channel_id;

  IF row_record.type = 'announcement'::public.channel_type THEN
    event_type := CASE WHEN TG_OP = 'UPDATE' THEN 'announcement_updated' ELSE 'announcement_deleted' END;
  ELSIF EXISTS (SELECT 1 FROM public.threads t WHERE t.message_id = source_message.id) THEN
    event_type := CASE WHEN TG_OP = 'UPDATE' THEN 'forum_topic_updated' ELSE 'forum_topic_deleted' END;
  ELSE
    RETURN source_message;
  END IF;

  PERFORM public.enqueue_server_bot_event(
    row_record.server_id,
    event_type,
    event_type || ':' || source_message.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(source_message.channel_id)
      || public.server_bot_event_user_payload(source_message.user_id)
      || jsonb_build_object('message_id', source_message.id, 'item_id', source_message.id, 'item_title', left(source_message.content, 120), 'content', source_message.content)
  );

  RETURN source_message;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_reaction_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  message_record public.messages%ROWTYPE;
  channel_record record;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users u WHERE u.id = NEW.user_id AND u.is_bot = true) THEN
    RETURN NEW;
  END IF;

  SELECT * INTO message_record
  FROM public.messages
  WHERE id = NEW.message_id;

  SELECT c.server_id, c.type
  INTO channel_record
  FROM public.channels c
  WHERE c.id = COALESCE(NEW.channel_id, message_record.channel_id);

  IF channel_record.type != 'text'::public.channel_type THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_server_bot_event(
    channel_record.server_id,
    'reaction_added',
    'reaction_added:' || NEW.id::text,
    public.server_bot_event_channel_payload(COALESCE(NEW.channel_id, message_record.channel_id))
      || public.server_bot_event_user_payload(NEW.user_id)
      || jsonb_build_object('reaction_id', NEW.id, 'message_id', NEW.message_id, 'emoji', NEW.emoji, 'content', message_record.content)
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_calendar_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.calendar_events%ROWTYPE;
  event_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
  ELSE
    item := NEW;
  END IF;

  event_type := CASE TG_OP
    WHEN 'INSERT' THEN 'calendar_event_created'
    WHEN 'UPDATE' THEN 'calendar_event_updated'
    ELSE 'calendar_event_deleted'
  END;

  PERFORM public.enqueue_server_bot_event(
    item.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(item.created_by)
      || jsonb_build_object('item_id', item.id, 'item_title', item.title)
  );

  RETURN item;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_forum_topic_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.threads%ROWTYPE;
  message_record public.messages%ROWTYPE;
  channel_record record;
  event_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
    event_type := 'forum_topic_deleted';
  ELSE
    item := NEW;
    event_type := 'forum_topic_created';
  END IF;

  SELECT * INTO message_record
  FROM public.messages
  WHERE id = item.message_id;

  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = item.created_by AND u.is_bot = true) THEN
    RETURN item;
  END IF;

  SELECT c.server_id, c.type
  INTO channel_record
  FROM public.channels c
  WHERE c.id = item.channel_id;

  IF channel_record.type != 'forum'::public.channel_type THEN
    RETURN item;
  END IF;

  PERFORM public.enqueue_server_bot_event(
    channel_record.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(item.created_by)
      || jsonb_build_object('thread_id', item.id, 'message_id', item.message_id, 'item_id', item.id, 'item_title', left(COALESCE(message_record.content, 'Forum topic'), 120), 'content', message_record.content)
  );

  RETURN item;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_task_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.tasks%ROWTYPE;
  event_type text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
  ELSE
    item := NEW;
  END IF;

  event_type := CASE TG_OP
    WHEN 'INSERT' THEN 'list_item_created'
    WHEN 'UPDATE' THEN 'list_item_updated'
    ELSE 'list_item_deleted'
  END;

  IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = item.created_by AND u.is_bot = true) THEN
    RETURN item;
  END IF;

  PERFORM public.enqueue_server_bot_event(
    item.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(item.created_by)
      || jsonb_build_object('item_id', item.id, 'item_title', item.title, 'content', item.description)
  );

  RETURN item;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_media_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  item public.media_items%ROWTYPE;
  event_type text;
  channel_record record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    item := OLD;
  ELSE
    item := NEW;
  END IF;

  event_type := CASE TG_OP
    WHEN 'INSERT' THEN 'media_created'
    WHEN 'UPDATE' THEN 'media_updated'
    ELSE 'media_deleted'
  END;

  SELECT c.server_id
  INTO channel_record
  FROM public.channels c
  WHERE c.id = item.channel_id;

  PERFORM public.enqueue_server_bot_event(
    channel_record.server_id,
    event_type,
    event_type || ':' || item.id::text || ':' || txid_current()::text,
    public.server_bot_event_channel_payload(item.channel_id)
      || public.server_bot_event_user_payload(item.user_id)
      || jsonb_build_object('item_id', item.id, 'item_title', COALESCE(item.title, item.media_type, 'Media'), 'content', item.description, 'media_type', item.media_type)
  );

  RETURN item;
END;
$function$;

DROP TRIGGER IF EXISTS trg_server_bot_message_updated ON public.messages;
CREATE TRIGGER trg_server_bot_message_updated
AFTER UPDATE ON public.messages
FOR EACH ROW
WHEN (OLD.content IS DISTINCT FROM NEW.content)
EXECUTE FUNCTION public.enqueue_server_bot_message_changed();

DROP TRIGGER IF EXISTS trg_server_bot_message_deleted ON public.messages;
CREATE TRIGGER trg_server_bot_message_deleted
AFTER DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_server_bot_message_changed();

DROP TRIGGER IF EXISTS trg_server_bot_reaction_added ON public.reactions;
CREATE TRIGGER trg_server_bot_reaction_added
AFTER INSERT ON public.reactions
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_server_bot_reaction_added();

DROP TRIGGER IF EXISTS trg_server_bot_calendar_event_changed ON public.calendar_events;
CREATE TRIGGER trg_server_bot_calendar_event_changed
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_server_bot_calendar_event();

DROP TRIGGER IF EXISTS trg_server_bot_forum_topic_created ON public.threads;
CREATE TRIGGER trg_server_bot_forum_topic_created
AFTER INSERT OR DELETE ON public.threads
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_server_bot_forum_topic_changed();

DROP TRIGGER IF EXISTS trg_server_bot_task_item_changed ON public.tasks;
CREATE TRIGGER trg_server_bot_task_item_changed
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_server_bot_task_item();

DROP TRIGGER IF EXISTS trg_server_bot_media_item_changed ON public.media_items;
CREATE TRIGGER trg_server_bot_media_item_changed
AFTER INSERT OR UPDATE OR DELETE ON public.media_items
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_server_bot_media_item();

REVOKE EXECUTE ON FUNCTION public.server_bot_supported_trigger_types() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.server_bot_supported_action_types() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.server_bot_has_enabled_flow(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_event(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.server_bot_event_user_payload(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.server_bot_event_channel_payload(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_message_changed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_reaction_added() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_calendar_event() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_forum_topic_changed() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_task_item() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_media_item() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.upsert_server_bot_flow(uuid, uuid, uuid, text, jsonb, text, jsonb, boolean, integer) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
