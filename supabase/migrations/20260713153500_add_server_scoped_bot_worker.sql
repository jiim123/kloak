-- Make server bot processing near-instant and fair under load.
--
-- Queue inserts now kick the Edge worker with the specific server_id, allowing
-- the worker to drain that server before falling back to global work. Cron uses
-- a fair server-rotating drain so one busy server cannot monopolize the queue.

CREATE INDEX IF NOT EXISTS idx_server_bot_event_queue_server_claim
  ON public.server_bot_event_queue (server_id, status, locked_until, created_at)
  WHERE status IN ('pending', 'processing');

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
            rendered_content := public.render_bot_template(flow_record.action_config->>'content', event_record.payload);
          END IF;

          IF flow_record.action_type = 'create_forum_topic' AND rendered_title = '' THEN
            INSERT INTO public.server_bot_action_log (event_id, flow_id, action_type, status, error)
            VALUES (event_record.id, flow_record.id, flow_record.action_type, 'failed', 'Rendered topic title was empty')
            ON CONFLICT (event_id, flow_id) DO NOTHING;
            CONTINUE;
          END IF;

          IF flow_record.action_type != 'create_forum_topic' AND rendered_content = '' THEN
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

REVOKE ALL ON FUNCTION public.process_server_bot_events_for_server(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_server_bot_events_for_server(uuid, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.process_server_bot_events_fair(
  _max_servers integer DEFAULT 25,
  _max_events_per_server integer DEFAULT 10,
  _max_actions_per_server integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  server_record record;
  safe_server_limit integer := GREATEST(1, LEAST(COALESCE(_max_servers, 25), 100));
  events_limit integer := GREATEST(1, LEAST(COALESCE(_max_events_per_server, 10), 100));
  actions_limit integer := GREATEST(1, LEAST(COALESCE(_max_actions_per_server, 50), 200));
  result jsonb;
  servers_processed integer := 0;
  events_processed integer := 0;
  events_completed integer := 0;
  actions_completed integer := 0;
BEGIN
  FOR server_record IN
    SELECT q.server_id, MIN(q.created_at) AS oldest_created_at
    FROM public.server_bot_event_queue q
    WHERE q.status IN ('pending', 'processing')
      AND (q.locked_until IS NULL OR q.locked_until < now())
    GROUP BY q.server_id
    ORDER BY oldest_created_at ASC
    LIMIT safe_server_limit
  LOOP
    result := public.process_server_bot_events_for_server(
      server_record.server_id,
      events_limit,
      actions_limit
    );

    servers_processed := servers_processed + 1;
    events_processed := events_processed + COALESCE((result->>'events_processed')::integer, 0);
    events_completed := events_completed + COALESCE((result->>'events_completed')::integer, 0);
    actions_completed := actions_completed + COALESCE((result->>'actions_completed')::integer, 0);
  END LOOP;

  RETURN jsonb_build_object(
    'servers_processed', servers_processed,
    'events_processed', events_processed,
    'events_completed', events_completed,
    'actions_completed', actions_completed
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.process_server_bot_events_fair(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_server_bot_events_fair(integer, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.kick_server_bot_event_processor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  worker_token text;
  worker_url text;
  request_id bigint;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT ds.decrypted_secret
  INTO worker_token
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'SERVER_BOT_WORKER_TOKEN'
  LIMIT 1;

  IF NULLIF(worker_token, '') IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT ds.decrypted_secret
  INTO worker_url
  FROM vault.decrypted_secrets ds
  WHERE ds.name = 'SERVER_BOT_WORKER_URL'
  LIMIT 1;

  worker_url := COALESCE(
    NULLIF(worker_url, ''),
    'https://foquucurnwpqcvgqukpz.supabase.co/functions/v1/process-server-bot-events'
  );

  SELECT net.http_post(
    url := worker_url,
    body := jsonb_build_object(
      'serverId', NEW.server_id,
      'maxEvents', 25,
      'maxActions', 100,
      'maxIterations', 8,
      'fairMaxServers', 5,
      'source', 'server_bot_event_queue'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-token', worker_token
    ),
    timeout_milliseconds := 2000
  )
  INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Do not let a failed async kick break the user action that queued the event.
  -- The cron fallback will process the event shortly.
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.kick_server_bot_event_processor() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_server_bot_event_queue_kick_worker ON public.server_bot_event_queue;
CREATE TRIGGER trg_server_bot_event_queue_kick_worker
AFTER INSERT ON public.server_bot_event_queue
FOR EACH ROW
EXECUTE FUNCTION public.kick_server_bot_event_processor();

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'process-server-bot-events'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'process-server-bot-events',
  '* * * * *',
  $$SELECT public.process_server_bot_events_fair(100, 10, 100);$$
);
