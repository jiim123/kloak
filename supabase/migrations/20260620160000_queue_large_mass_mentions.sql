-- Queue @everyone/@here delivery so send_message stays fast on large servers.
--
-- send_message writes the chat message and enqueues one job per mass mention.
-- A service-role worker processes jobs in bounded batches and creates the
-- notification/read-count fan-out outside the user's request transaction.

CREATE TABLE IF NOT EXISTS public.mass_mention_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mention_type public.mention_type NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  last_recipient_id uuid,
  processed_count integer NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT mass_mention_jobs_type_check CHECK (mention_type IN ('everyone', 'here')),
  CONSTRAINT mass_mention_jobs_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS mass_mention_jobs_message_type_key
  ON public.mass_mention_jobs (message_id, mention_type);

CREATE INDEX IF NOT EXISTS idx_mass_mention_jobs_claim
  ON public.mass_mention_jobs (status, locked_until, created_at)
  WHERE status IN ('pending', 'processing');

ALTER TABLE public.mass_mention_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mass_mention_jobs_service_only" ON public.mass_mention_jobs;
CREATE POLICY "mass_mention_jobs_service_only"
  ON public.mass_mention_jobs
  FOR ALL
  USING (current_user = 'service_role')
  WITH CHECK (current_user = 'service_role');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mass_mention_jobs TO service_role;

CREATE OR REPLACE FUNCTION public.handle_message_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only persist explicit user mentions here. Server-wide mentions are queued
  -- by send_message and processed asynchronously.
  INSERT INTO public.mentions (message_id, user_id, mention_type)
  SELECT DISTINCT NEW.id, (m[1])::uuid, 'user'::mention_type
  FROM regexp_matches(NEW.content, '<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>', 'g') AS m
  WHERE (m[1])::uuid <> NEW.user_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DO $$
DECLARE
  trigger_record record;
BEGIN
  FOR trigger_record IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public'
      AND c.relname = 'messages'
      AND NOT t.tgisinternal
      AND p.proname IN ('handle_message_mentions', 'process_message_mentions', 'handle_new_mention_ping')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.messages', trigger_record.tgname);
  END LOOP;
END;
$$;

CREATE TRIGGER trg_handle_message_mentions
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_message_mentions();

CREATE OR REPLACE FUNCTION public.process_mass_mention_jobs(
  _batch_size integer DEFAULT 500,
  _max_jobs integer DEFAULT 5
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  job_record public.mass_mention_jobs%ROWTYPE;
  recipient_ids uuid[];
  recipient_count integer;
  total_recipient_count integer := 0;
  processed_job_count integer := 0;
  completed_job_count integer := 0;
  message_content text;
  channel_name text;
  sender_username text;
  notification_body text;
  notification_link text;
  online_cutoff timestamptz := now() - interval '5 minutes';
  effective_batch_size integer := GREATEST(1, LEAST(COALESCE(_batch_size, 500), 1000));
  effective_max_jobs integer := GREATEST(1, LEAST(COALESCE(_max_jobs, 5), 20));
BEGIN
  FOR job_record IN
    SELECT *
    FROM public.mass_mention_jobs
    WHERE status IN ('pending', 'processing')
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY created_at ASC
    LIMIT effective_max_jobs
    FOR UPDATE SKIP LOCKED
  LOOP
    processed_job_count := processed_job_count + 1;

    UPDATE public.mass_mention_jobs
    SET status = 'processing',
        attempts = attempts + 1,
        locked_until = now() + interval '2 minutes',
        updated_at = now(),
        last_error = NULL
    WHERE id = job_record.id;

    SELECT m.content, c.name, u.username,
           '/app?server=' || job_record.server_id || '&channel=' || job_record.channel_id || '&message=' || job_record.message_id
    INTO message_content, channel_name, sender_username, notification_link
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    JOIN public.users u ON u.id = m.user_id
    WHERE m.id = job_record.message_id;

    IF message_content IS NULL THEN
      UPDATE public.mass_mention_jobs
      SET status = 'completed',
          locked_until = NULL,
          completed_at = now(),
          updated_at = now()
      WHERE id = job_record.id;
      completed_job_count := completed_job_count + 1;
      CONTINUE;
    END IF;

    notification_body := sender_username || ' mentioned @' || job_record.mention_type::text || ' in #' || COALESCE(channel_name, 'channel');

    SELECT COALESCE(array_agg(candidate.user_id ORDER BY candidate.user_id), ARRAY[]::uuid[])
    INTO recipient_ids
    FROM (
      SELECT sm.user_id
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      JOIN public.channels c ON c.id = job_record.channel_id
      LEFT JOIN public.channel_members cm
        ON cm.channel_id = job_record.channel_id
       AND cm.user_id = sm.user_id
      LEFT JOIN public.channel_user_settings cus
        ON cus.channel_id = job_record.channel_id
       AND cus.user_id = sm.user_id
      WHERE sm.server_id = job_record.server_id
        AND sm.user_id <> job_record.sender_id
        AND COALESCE(sm.is_banned, false) = false
        AND (job_record.last_recipient_id IS NULL OR sm.user_id > job_record.last_recipient_id)
        AND (c.is_private = false OR cm.user_id IS NOT NULL)
        AND COALESCE(cus.notification_level, 'all') <> 'nothing'
        AND COALESCE(cus.is_muted, false) = false
        AND (cus.mute_until IS NULL OR cus.mute_until <= now())
        AND (
          job_record.mention_type = 'everyone'::public.mention_type
          OR (
            u.status <> 'offline'::public.user_status
            AND u.last_seen >= online_cutoff
          )
        )
      ORDER BY sm.user_id
      LIMIT effective_batch_size
    ) AS candidate;

    recipient_count := COALESCE(array_length(recipient_ids, 1), 0);

    IF recipient_count = 0 THEN
      UPDATE public.mass_mention_jobs
      SET status = 'completed',
          locked_until = NULL,
          completed_at = now(),
          updated_at = now()
      WHERE id = job_record.id;
      completed_job_count := completed_job_count + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.notifications (user_id, type, title, body, link)
    SELECT recipient_id,
           'mention'::public.notification_type,
           'You were mentioned',
           notification_body,
           notification_link
    FROM unnest(recipient_ids) AS recipient_id;

    INSERT INTO public.channel_reads (user_id, channel_id, mention_count)
    SELECT recipient_id, job_record.channel_id, 1
    FROM unnest(recipient_ids) AS recipient_id
    ON CONFLICT (user_id, channel_id)
    DO UPDATE SET mention_count = COALESCE(public.channel_reads.mention_count, 0) + 1;

    total_recipient_count := total_recipient_count + recipient_count;

    UPDATE public.mass_mention_jobs
    SET last_recipient_id = recipient_ids[recipient_count],
        processed_count = processed_count + recipient_count,
        status = CASE WHEN recipient_count < effective_batch_size THEN 'completed' ELSE 'pending' END,
        locked_until = NULL,
        completed_at = CASE WHEN recipient_count < effective_batch_size THEN now() ELSE completed_at END,
        updated_at = now()
    WHERE id = job_record.id;

    IF recipient_count < effective_batch_size THEN
      completed_job_count := completed_job_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'jobs_processed', processed_job_count,
    'jobs_completed', completed_job_count,
    'recipients_processed', total_recipient_count
  );
EXCEPTION WHEN OTHERS THEN
  IF job_record.id IS NOT NULL THEN
    UPDATE public.mass_mention_jobs
      SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'pending' END,
          locked_until = NULL,
          last_error = SQLERRM,
          updated_at = now()
      WHERE id = job_record.id;
  END IF;
  RETURN jsonb_build_object(
    'jobs_processed', processed_job_count,
    'jobs_completed', completed_job_count,
    'recipients_processed', total_recipient_count,
    'error', SQLERRM
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_mass_mention_jobs(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_mass_mention_jobs(integer, integer) TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job record;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'process-mass-mention-jobs'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'process-mass-mention-jobs',
  '* * * * *',
  $$SELECT public.process_mass_mention_jobs(500, 10);$$
);

CREATE OR REPLACE FUNCTION public.send_message(
  _user_id uuid,
  _channel_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  channel_is_read_only boolean;
  channel_slowmode_seconds integer;
  channel_block_links boolean;
  channel_allowed_domains text[];
  is_muted boolean;
  user_role server_role;
  new_message_id uuid;
  result json;
  sender_created_at timestamptz;
  recent_count_10s integer;
  recent_count_1m integer;
  normalized_content text;
  last_message_time timestamptz;
  time_since_last_message interval;
  has_url boolean;
  can_post_links boolean;
  allowed_domain text;
  domain_found boolean;
  mention_count integer;
  has_everyone_mention boolean;
  has_here_mention boolean;
  queued_types text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  normalized_content := trim(_content);

  IF normalized_content IS NULL OR length(normalized_content) = 0 THEN
    RAISE EXCEPTION 'Message content cannot be empty.';
  END IF;

  IF length(normalized_content) > 4000 THEN
    RAISE EXCEPTION 'Message content cannot exceed 4000 characters.';
  END IF;

  has_everyone_mention := normalized_content ~* '(^|[^[:alnum:]_])@everyone([^[:alnum:]_]|$)';
  has_here_mention := normalized_content ~* '(^|[^[:alnum:]_])@here([^[:alnum:]_]|$)';

  SELECT count(*) INTO mention_count
  FROM regexp_matches(normalized_content, '<@[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}>', 'gi');
  IF mention_count > 5 THEN
    RAISE EXCEPTION 'Too many mentions. Maximum 5 user mentions per message.';
  END IF;

  SELECT u.created_at INTO sender_created_at
  FROM public.users u WHERE u.id = _user_id;
  IF sender_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF sender_created_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Messaging is temporarily restricted for new accounts';
  END IF;

  IF NOT public.check_rate_limit(_user_id::text, 'send_message', 10, 5) THEN
    RAISE EXCEPTION 'You are sending messages too fast. Please slow down.';
  END IF;

  SELECT count(*) INTO recent_count_10s
  FROM public.messages m
  WHERE m.user_id = _user_id AND m.channel_id = _channel_id AND m.created_at > now() - interval '10 seconds';
  IF recent_count_10s >= 6 THEN
    RAISE EXCEPTION 'Rate limited: too many messages in this channel';
  END IF;

  SELECT count(*) INTO recent_count_1m
  FROM public.messages m
  WHERE m.user_id = _user_id AND m.created_at > now() - interval '1 minute';
  IF recent_count_1m >= 30 THEN
    RAISE EXCEPTION 'Rate limited: minute message quota reached';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.user_id = _user_id AND m.channel_id = _channel_id
      AND m.content = normalized_content AND m.created_at > now() - interval '15 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate message blocked';
  END IF;

  SELECT server_id, is_read_only, slowmode_seconds, block_links, allowed_link_domains
  INTO channel_server_id, channel_is_read_only, channel_slowmode_seconds, channel_block_links, channel_allowed_domains
  FROM public.channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT sm.is_muted, sm.role INTO is_muted, user_role
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;
  IF channel_is_read_only = true THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'This channel is read-only';
    END IF;
  END IF;

  IF (has_everyone_mention OR has_here_mention)
     AND NOT public.check_user_permission(_user_id, _channel_id, 'mention_everyone') THEN
    RAISE EXCEPTION 'You do not have permission to mention @everyone in this channel';
  END IF;

  IF channel_slowmode_seconds > 0 THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      SELECT m.created_at INTO last_message_time
      FROM public.messages m
      WHERE m.user_id = _user_id AND m.channel_id = _channel_id
      ORDER BY m.created_at DESC LIMIT 1;
      IF last_message_time IS NOT NULL THEN
        time_since_last_message := now() - last_message_time;
        IF time_since_last_message < make_interval(secs => channel_slowmode_seconds) THEN
          RAISE EXCEPTION 'Slowmode is active. Please wait % seconds before sending another message.',
            channel_slowmode_seconds - EXTRACT(EPOCH FROM time_since_last_message)::integer;
        END IF;
      END IF;
    END IF;
  END IF;

  IF channel_block_links = true THEN
    has_url := normalized_content ~* 'https?://|www\.|[a-z0-9-]+\.(com|net|org|io|dev|app|gg|me|co|tv|fm|xyz|ai|site|tech|online|store|blog|info|cc|biz)(/|\s|$)';
    IF has_url THEN
      can_post_links := public.check_user_permission(_user_id, _channel_id, 'manage_messages');
      IF NOT can_post_links THEN
        IF channel_allowed_domains IS NOT NULL AND array_length(channel_allowed_domains, 1) > 0 THEN
          domain_found := false;
          FOREACH allowed_domain IN ARRAY channel_allowed_domains LOOP
            IF normalized_content ~* ('(^|://|www\.)' || regexp_replace(allowed_domain, '\.', '\\.', 'g') || '(/|\s|$)') THEN
              domain_found := true;
              EXIT;
            END IF;
          END LOOP;
          IF NOT domain_found THEN
            RAISE EXCEPTION 'Links from this domain are not allowed in this channel. Only whitelisted domains are permitted.';
          END IF;
        ELSE
          RAISE EXCEPTION 'Links are not allowed in this channel';
        END IF;
      END IF;
    END IF;
  END IF;

  IF _reply_to_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.messages WHERE id = _reply_to_id AND channel_id = _channel_id
    ) THEN
      RAISE EXCEPTION 'Invalid reply reference.';
    END IF;
  END IF;

  PERFORM public.enforce_single_account_variant_spam(_user_id, _channel_id, channel_server_id, normalized_content);
  PERFORM public.enforce_server_raid_protection(_user_id, _channel_id, channel_server_id, normalized_content);

  INSERT INTO public.messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, normalized_content, _reply_to_id)
  RETURNING id INTO new_message_id;

  IF has_everyone_mention THEN
    INSERT INTO public.mass_mention_jobs (message_id, channel_id, server_id, sender_id, mention_type)
    VALUES (new_message_id, _channel_id, channel_server_id, _user_id, 'everyone'::public.mention_type)
    ON CONFLICT (message_id, mention_type) DO NOTHING;
    queued_types := array_append(queued_types, 'everyone');
  END IF;

  IF has_here_mention THEN
    INSERT INTO public.mass_mention_jobs (message_id, channel_id, server_id, sender_id, mention_type)
    VALUES (new_message_id, _channel_id, channel_server_id, _user_id, 'here'::public.mention_type)
    ON CONFLICT (message_id, mention_type) DO NOTHING;
    queued_types := array_append(queued_types, 'here');
  END IF;

  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'reply_to_id', m.reply_to_id,
    'is_pinned', m.is_pinned,
    'is_system_message', COALESCE(m.is_system_message, false),
    'embed_hidden', COALESCE(m.embed_hidden, false),
    'edited_at', m.edited_at,
    'created_at', m.created_at,
    'mass_mentions_queued', array_length(queued_types, 1) IS NOT NULL,
    'queued_mention_types', queued_types
  ) INTO result
  FROM public.messages m WHERE m.id = new_message_id;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_message(uuid, uuid, text, uuid) TO anon, authenticated, service_role;
