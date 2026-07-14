-- Add static/random message modes for send-channel-message action bots.

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
  action_channel_type public.channel_type;
  trigger_channel record;
  action_role_id uuid;
  action_role_name text;
  action_title text;
  action_content text;
  action_emoji text;
  action_message_mode text;
  action_reply_mode text;
  action_messages jsonb;
  trigger_emoji text;
  flow_count integer;
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

  IF _flow_id IS NULL THEN
    SELECT count(*) INTO flow_count
    FROM public.server_bot_flows
    WHERE bot_id = bot_record.id;

    IF flow_count >= 20 THEN
      RAISE EXCEPTION 'Action bots can have up to 20 actions';
    END IF;
  END IF;

  IF _trigger_type IS NULL OR NOT (_trigger_type = ANY (public.server_bot_supported_trigger_types())) THEN
    RAISE EXCEPTION 'Unsupported trigger type';
  END IF;

  IF _action_type IS NULL OR NOT (_action_type = ANY (public.server_bot_supported_action_types())) THEN
    RAISE EXCEPTION 'Unsupported action type';
  END IF;

  IF NOT public.server_bot_trigger_supports_action(_trigger_type, _action_type) THEN
    IF _action_type IN ('delete_message', 'add_reaction') THEN
      RAISE EXCEPTION 'This action requires a trigger with a source message';
    ELSIF _action_type IN ('assign_role', 'remove_role') THEN
      RAISE EXCEPTION 'This action requires a trigger with a member';
    ELSE
      RAISE EXCEPTION 'Choose a compatible trigger for this action';
    END IF;
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'upsert_server_bot_flow', 60, 3600) THEN
    RAISE EXCEPTION 'Too many flow updates. Please try again later.';
  END IF;

  IF _action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item') THEN
    SELECT c.id, c.type
    INTO action_channel_id, action_channel_type
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

    IF NOT FOUND OR action_role_name = '@everyone' THEN
      RAISE EXCEPTION 'Choose a valid role for the action';
    END IF;
  END IF;

  action_title := left(trim(COALESCE(safe_action_config->>'title', '')), 120);
  action_content := left(trim(COALESCE(safe_action_config->>'content', '')), 2000);
  action_emoji := left(trim(COALESCE(safe_action_config->>'emoji', '')), 64);
  action_message_mode := CASE
    WHEN _action_type = 'send_channel_message' AND safe_action_config->>'message_mode' = 'random' THEN 'random'
    ELSE 'static'
  END;
  action_reply_mode := CASE
    WHEN _action_type = 'send_channel_message' AND safe_action_config->>'reply_mode' = 'reply' THEN 'reply'
    ELSE 'normal'
  END;

  IF action_message_mode = 'random' THEN
    SELECT COALESCE(jsonb_agg(to_jsonb(message)), '[]'::jsonb)
    INTO action_messages
    FROM (
      SELECT left(trim(value), 2000) AS message
      FROM jsonb_array_elements_text(
        CASE
          WHEN jsonb_typeof(safe_action_config->'messages') = 'array' THEN safe_action_config->'messages'
          ELSE '[]'::jsonb
        END
      ) AS configured_messages(value)
      WHERE trim(value) <> ''
      LIMIT 25
    ) normalized_messages;
  ELSE
    action_messages := '[]'::jsonb;
  END IF;
  trigger_emoji := left(trim(COALESCE(safe_trigger_config->>'emoji', '')), 64);

  IF _action_type = 'create_forum_topic' AND action_title = '' THEN
    action_title := left(action_content, 120);
  END IF;

  IF _action_type = 'send_channel_message' AND action_message_mode = 'static' AND action_content = '' THEN
    RAISE EXCEPTION 'Action text is required';
  END IF;

  IF _action_type = 'send_channel_message' AND action_message_mode = 'random' AND jsonb_array_length(action_messages) = 0 THEN
    RAISE EXCEPTION 'At least one random message is required';
  END IF;

  IF _action_type = 'create_list_item' AND action_content = '' THEN
    RAISE EXCEPTION 'Action text is required';
  END IF;

  IF _action_type = 'create_forum_topic' AND action_title = '' THEN
    RAISE EXCEPTION 'Topic title is required';
  END IF;

  IF _action_type = 'add_reaction' AND action_emoji = '' THEN
    RAISE EXCEPTION 'Reaction emoji is required';
  END IF;

  safe_action_config := jsonb_build_object(
    'channel_id', CASE WHEN _action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item') THEN action_channel_id ELSE NULL END,
    'title', CASE WHEN _action_type = 'create_forum_topic' THEN action_title ELSE NULL END,
    'content', CASE WHEN _action_type IN ('send_channel_message', 'create_forum_topic', 'create_list_item') THEN action_content ELSE NULL END,
    'message_mode', CASE WHEN _action_type = 'send_channel_message' THEN action_message_mode ELSE NULL END,
    'reply_mode', CASE WHEN _action_type = 'send_channel_message' THEN action_reply_mode ELSE NULL END,
    'messages', CASE WHEN _action_type = 'send_channel_message' AND action_message_mode = 'random' THEN action_messages ELSE NULL END,
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
      RAISE EXCEPTION 'Action not found';
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

CREATE OR REPLACE FUNCTION public.process_server_bot_events_for_server(
  _server_id uuid,
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
  rendered_title text;
  message_template text;
  random_message_mode boolean := false;
  reply_to_message_id uuid;
  source_message record;
  action_channel record;
  target_member record;
  claimed_flow_id uuid;
  new_message_id uuid;
  new_task_id uuid;
  next_task_position integer;
  action_limit_reached boolean;
BEGIN
  IF _server_id IS NULL THEN
    RETURN jsonb_build_object('events_processed', 0, 'events_completed', 0, 'actions_completed', 0);
  END IF;
  FOR event_record IN
    SELECT *
    FROM public.server_bot_event_queue
    WHERE server_id = _server_id
      AND status IN ('pending', 'processing')
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
      action_limit_reached := false;

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
        IF actions_completed >= action_limit THEN
          action_limit_reached := true;
          EXIT;
        END IF;

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

          IF flow_record.action_type = 'create_forum_topic' THEN
            rendered_title := public.render_bot_template(
              COALESCE(NULLIF(flow_record.action_config->>'title', ''), flow_record.action_config->>'content'),
              event_record.payload
            );
            rendered_content := public.render_bot_template(COALESCE(flow_record.action_config->>'content', ''), event_record.payload);
          ELSE
            rendered_title := NULL;
            IF flow_record.action_type = 'send_channel_message' AND flow_record.action_config->>'message_mode' = 'random' THEN
              random_message_mode := true;
              SELECT candidate.rendered
              INTO rendered_content
              FROM (
                SELECT public.render_bot_template(value, event_record.payload) AS rendered
                FROM jsonb_array_elements_text(
                  CASE
                    WHEN jsonb_typeof(flow_record.action_config->'messages') = 'array' THEN flow_record.action_config->'messages'
                    ELSE '[]'::jsonb
                  END
                ) AS configured_messages(value)
                WHERE trim(value) <> ''
                ORDER BY random()
              ) candidate
              WHERE candidate.rendered <> ''
              LIMIT 1;
              rendered_content := COALESCE(rendered_content, '');
            ELSE
              random_message_mode := false;
              rendered_content := public.render_bot_template(flow_record.action_config->>'content', event_record.payload);
            END IF;
          END IF;

          IF flow_record.action_type = 'create_forum_topic' AND rendered_title = '' THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Rendered topic title was empty')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF flow_record.action_type != 'create_forum_topic' AND rendered_content = '' THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (
              event_record.id,
              flow_record.id,
              flow_record.action_type,
              'failed',
              'Rendered content was empty'
            )
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

          IF random_message_mode = false AND NOT public.check_no_duplicate_message(flow_record.bot_user_id, action_channel.id, rendered_content) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'skipped', 'Duplicate bot message suppressed')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          reply_to_message_id := NULL;
          IF flow_record.action_config->>'reply_mode' = 'reply' THEN
            SELECT m.id
            INTO reply_to_message_id
            FROM public.messages m
            WHERE m.id = NULLIF(event_record.payload->>'message_id', '')::uuid
              AND m.channel_id = action_channel.id;
          END IF;

          INSERT INTO public.messages (channel_id, user_id, content, reply_to_id, is_system_message)
          VALUES (action_channel.id, flow_record.bot_user_id, rendered_content, reply_to_message_id, false)
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

          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'completed')
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

          IF NOT EXISTS (
            SELECT 1
            FROM public.users u
            JOIN public.server_members sm
              ON sm.user_id = u.id
             AND sm.server_id = event_record.server_id
            WHERE u.id = flow_record.bot_user_id
              AND u.is_bot = true
              AND COALESCE(sm.is_banned, false) = false
              AND COALESCE(sm.is_muted, false) = false
          ) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Bot cannot manage roles')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF NOT EXISTS (
            SELECT 1
            FROM public.server_roles sr
            WHERE sr.id = (flow_record.action_config->>'role_id')::uuid
              AND sr.server_id = event_record.server_id
              AND sr.name <> '@everyone'
          ) THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Action role not found')
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
          VALUES (
            action_channel.id,
            flow_record.bot_user_id,
            left(
              CASE
                WHEN rendered_content <> '' THEN left(rendered_title, 120) || E'\n\n' || rendered_content
                ELSE left(rendered_title, 500)
              END,
              2000
            ),
            false
          )
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

          SELECT COALESCE(MAX(t.task_position), -1) + 1
          INTO next_task_position
          FROM public.tasks t
          WHERE t.channel_id = action_channel.id
            AND t.category_id IS NULL;

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
            next_task_position
          )
          RETURNING id INTO new_task_id;

          INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status)
          VALUES (event_record.id, flow_record.id, flow_record.action_type, 'completed')
          ON CONFLICT (event_id, flow_id) DO NOTHING;
        END IF;

        actions_completed := actions_completed + 1;
      END LOOP;

      IF action_limit_reached THEN
        UPDATE public.server_bot_event_queue
        SET status = 'pending',
            locked_until = NULL,
            updated_at = now()
        WHERE id = event_record.id;
      ELSE
        UPDATE public.server_bot_event_queue
        SET status = 'completed',
            completed_at = now(),
            locked_until = NULL,
            updated_at = now()
        WHERE id = event_record.id;

        completed_events := completed_events + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.server_bot_event_queue
      SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
          locked_until = NULL,
          last_error = SQLERRM,
          updated_at = now()
      WHERE id = event_record.id;
    END;

    IF action_limit_reached THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'events_processed', processed_events,
    'events_completed', completed_events,
    'actions_completed', actions_completed
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_ban_spammer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  channel_server_id uuid;
  target_owner_id uuid;
  sender_role public.server_role;
  sender_is_bot boolean := false;
  similar_spam_count integer := 0;
  recent_burst_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF COALESCE(NEW.is_system_message, false) = true THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(u.is_bot, false)
  INTO sender_is_bot
  FROM public.users u
  WHERE u.id = NEW.user_id;

  IF sender_is_bot = true THEN
    RETURN NEW;
  END IF;

  SELECT c.server_id, s.owner_id
  INTO channel_server_id, target_owner_id
  FROM public.channels c
  JOIN public.servers s ON s.id = c.server_id
  WHERE c.id = NEW.channel_id;

  IF channel_server_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id = target_owner_id THEN
    RETURN NEW;
  END IF;

  SELECT sm.role
  INTO sender_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = NEW.user_id
    AND COALESCE(sm.is_banned, false) = false;

  IF sender_role IS NULL OR sender_role <> 'member' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::integer
  INTO similar_spam_count
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  WHERE m.user_id = NEW.user_id
    AND c.server_id = channel_server_id
    AND COALESCE(m.is_system_message, false) = false
    AND m.created_at >= now() - interval '12 seconds'
    AND public.are_messages_similar_for_raid(m.content, NEW.content);

  IF similar_spam_count >= 3 THEN
    SELECT COALESCE(array_agg(m.id), ARRAY[]::uuid[])
    INTO recent_burst_ids
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    WHERE m.user_id = NEW.user_id
      AND c.server_id = channel_server_id
      AND COALESCE(m.is_system_message, false) = false
      AND m.created_at >= now() - interval '2 minutes'
      AND public.are_messages_similar_for_raid(m.content, NEW.content);

    PERFORM set_config('app.moderation_bypass', 'ban', true);

    UPDATE public.server_members
    SET is_banned = true
    WHERE server_id = channel_server_id
      AND user_id = NEW.user_id
      AND role = 'member'
      AND COALESCE(is_banned, false) = false;

    IF array_length(recent_burst_ids, 1) IS NOT NULL THEN
      DELETE FROM public.messages
      WHERE id = ANY(recent_burst_ids);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_single_account_variant_spam(
  _user_id uuid,
  _channel_id uuid,
  _server_id uuid,
  _content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  actor_role public.server_role;
  actor_is_bot boolean := false;
  similar_spam_count integer := 0;
  purge_message_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT COALESCE(u.is_bot, false)
  INTO actor_is_bot
  FROM public.users u
  WHERE u.id = _user_id;

  IF actor_is_bot = true THEN
    RETURN;
  END IF;

  SELECT sm.role
  INTO actor_role
  FROM public.server_members sm
  WHERE sm.server_id = _server_id
    AND sm.user_id = _user_id
    AND COALESCE(sm.is_banned, false) = false;

  IF actor_role IS NULL OR actor_role <> 'member' THEN
    RETURN;
  END IF;

  SELECT COUNT(*)::integer,
         COALESCE(array_agg(m.id), ARRAY[]::uuid[])
  INTO similar_spam_count, purge_message_ids
  FROM public.messages m
  JOIN public.channels c ON c.id = m.channel_id
  WHERE m.user_id = _user_id
    AND c.server_id = _server_id
    AND COALESCE(m.is_system_message, false) = false
    AND m.created_at >= now() - interval '12 seconds'
    AND public.are_messages_similar_for_raid(m.content, _content);

  IF similar_spam_count < 2 THEN
    RETURN;
  END IF;

  PERFORM set_config('app.moderation_bypass', 'ban', true);

  UPDATE public.server_members
  SET is_banned = true
  WHERE server_id = _server_id
    AND user_id = _user_id
    AND role = 'member'
    AND COALESCE(is_banned, false) = false;

  IF array_length(purge_message_ids, 1) IS NOT NULL THEN
    DELETE FROM public.messages
    WHERE id = ANY(purge_message_ids);
  END IF;

  RAISE EXCEPTION 'Spam protection triggered: near-duplicate spam blocked and account banned';
END;
$function$;

REVOKE ALL ON FUNCTION public.auto_ban_spammer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_single_account_variant_spam(uuid, uuid, uuid, text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.ensure_server_bot_membership(_bot_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  bot_record public.server_bots%ROWTYPE;
  previous_bypass text;
BEGIN
  SELECT * INTO bot_record
  FROM public.server_bots
  WHERE id = _bot_id;

  IF bot_record.id IS NULL THEN
    RETURN false;
  END IF;

  previous_bypass := current_setting('app.moderation_bypass', true);

  INSERT INTO public.server_members (server_id, user_id, role, is_banned, is_muted)
  VALUES (bot_record.server_id, bot_record.bot_user_id, 'member'::public.server_role, false, false)
  ON CONFLICT (server_id, user_id) DO NOTHING;

  PERFORM set_config('app.moderation_bypass', 'ban', true);
  UPDATE public.server_members sm
  SET is_banned = false
  WHERE sm.server_id = bot_record.server_id
    AND sm.user_id = bot_record.bot_user_id
    AND COALESCE(sm.is_banned, false) = true;

  PERFORM set_config('app.moderation_bypass', 'mute', true);
  UPDATE public.server_members sm
  SET is_muted = false
  WHERE sm.server_id = bot_record.server_id
    AND sm.user_id = bot_record.bot_user_id
    AND COALESCE(sm.is_muted, false) = true;

  PERFORM set_config('app.moderation_bypass', COALESCE(previous_bypass, ''), true);

  RETURN EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = bot_record.server_id
      AND sm.user_id = bot_record.bot_user_id
      AND COALESCE(sm.is_banned, false) = false
      AND COALESCE(sm.is_muted, false) = false
  );
END;
$function$;
REVOKE ALL ON FUNCTION public.ensure_server_bot_membership(uuid) FROM PUBLIC;
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
  server_record record;
  server_result jsonb;
  event_limit integer := GREATEST(1, LEAST(COALESCE(_max_events, 25), 100));
  action_limit integer := GREATEST(1, LEAST(COALESCE(_max_actions, 50), 200));
  remaining_events integer := event_limit;
  remaining_actions integer := action_limit;
  processed_events integer := 0;
  completed_events integer := 0;
  actions_completed integer := 0;
  server_processed integer;
  server_completed integer;
  server_actions integer;
BEGIN
  FOR server_record IN
    SELECT q.server_id, min(q.created_at) AS first_event_at
    FROM public.server_bot_event_queue q
    WHERE q.status IN ('pending', 'processing')
      AND (q.locked_until IS NULL OR q.locked_until < now())
    GROUP BY q.server_id
    ORDER BY min(q.created_at) ASC
  LOOP
    EXIT WHEN remaining_events <= 0 OR remaining_actions <= 0;

    server_result := public.process_server_bot_events_for_server(
      server_record.server_id,
      remaining_events,
      remaining_actions
    );

    server_processed := COALESCE((server_result->>'events_processed')::integer, 0);
    server_completed := COALESCE((server_result->>'events_completed')::integer, 0);
    server_actions := COALESCE((server_result->>'actions_completed')::integer, 0);

    processed_events := processed_events + server_processed;
    completed_events := completed_events + server_completed;
    actions_completed := actions_completed + server_actions;
    remaining_events := GREATEST(0, remaining_events - server_processed);
    remaining_actions := GREATEST(0, remaining_actions - server_actions);
  END LOOP;

  RETURN jsonb_build_object(
    'events_processed', processed_events,
    'events_completed', completed_events,
    'actions_completed', actions_completed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_server_bot_events(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_server_bot_events(integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.upsert_server_bot_flow(uuid, uuid, uuid, text, jsonb, text, jsonb, boolean, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_server_bot_flow(uuid, uuid, uuid, text, jsonb, text, jsonb, boolean, integer) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.process_server_bot_events_for_server(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_server_bot_events_for_server(uuid, integer, integer) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;