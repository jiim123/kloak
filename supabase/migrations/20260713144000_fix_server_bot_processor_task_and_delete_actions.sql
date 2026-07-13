-- Fix two processor-side action failures found in server bot debug logs:
-- 1. create_list_item used an unqualified task_position reference that conflicted
--    with the PL/pgSQL variable name.
-- 2. delete_message inserted an action log FK to the source message after the
--    message had already been deleted.

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
  next_task_position integer;
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

REVOKE ALL ON FUNCTION public.process_server_bot_events(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_server_bot_events(integer, integer) TO service_role;
