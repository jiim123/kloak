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
