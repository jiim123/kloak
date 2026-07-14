-- Delete-message bot flows are moderation guardrails, so they need to run at
-- message insert time instead of depending only on the async bot worker.

CREATE OR REPLACE FUNCTION public.enqueue_server_bot_message_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  channel_record record;
  event_payload jsonb;
  queued_event_id uuid;
  delete_flow record;
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

  IF channel_record.id IS NULL THEN
    RETURN NEW;
  END IF;

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

  event_payload :=
    public.server_bot_event_channel_payload(NEW.channel_id)
    || public.server_bot_event_user_payload(NEW.user_id)
    || jsonb_build_object('message_id', NEW.id, 'content', NEW.content, 'content_normalized', lower(trim(NEW.content)));

  PERFORM public.enqueue_server_bot_event(
    channel_record.server_id,
    'message_created',
    'message:' || NEW.id::text,
    event_payload
  );

  SELECT q.id
  INTO queued_event_id
  FROM public.server_bot_event_queue q
  WHERE q.event_key = 'message:' || NEW.id::text
  LIMIT 1;

  FOR delete_flow IN
    SELECT f.id AS flow_id, f.trigger_config, b.bot_user_id
    FROM public.server_bot_flows f
    JOIN public.server_bots b ON b.id = f.bot_id
    WHERE f.server_id = channel_record.server_id
      AND f.trigger_type = 'message_created'
      AND f.action_type = 'delete_message'
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
  LOOP
    IF NOT public.check_server_bot_channel_permission(delete_flow.bot_user_id, NEW.channel_id, 'manage_messages'::public.permission_type) THEN
      IF queued_event_id IS NOT NULL THEN
        INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
        VALUES (queued_event_id, delete_flow.flow_id, 'delete_message', 'failed', 'Bot cannot delete messages in this channel')
        ON CONFLICT (event_id, flow_id) DO NOTHING;
      END IF;
      CONTINUE;
    END IF;

    DELETE FROM public.messages
    WHERE id = NEW.id;

    IF queued_event_id IS NOT NULL THEN
      INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status)
      VALUES (queued_event_id, delete_flow.flow_id, 'delete_message', 'completed')
      ON CONFLICT (event_id, flow_id) DO NOTHING;
    END IF;

    EXIT;
  END LOOP;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.enqueue_server_bot_message_created() FROM PUBLIC;
