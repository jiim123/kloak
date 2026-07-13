-- Near-instant server bot processing:
-- Queue inserts asynchronously kick the existing process-server-bot-events Edge
-- Function via pg_net. The one-minute cron job remains as a fallback.
--
-- Required Supabase secrets:
--   1. Edge Function env: SERVER_BOT_WORKER_TOKEN
--   2. Vault secret:      SERVER_BOT_WORKER_TOKEN
--      The two values must match.
--
-- Optional Vault secret:
--   SERVER_BOT_WORKER_URL
--   Defaults to this project's function URL if omitted.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

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
      'maxEvents', 25,
      'maxActions', 100,
      'maxIterations', 4,
      'source', 'server_bot_event_queue'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-token', worker_token
    ),
    timeout_milliseconds := 1000
  )
  INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Do not let a failed async kick break the user action that queued the event.
  -- The cron fallback will process the event within the next minute.
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.kick_server_bot_event_processor() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_server_bot_event_queue_kick_worker ON public.server_bot_event_queue;
CREATE TRIGGER trg_server_bot_event_queue_kick_worker
AFTER INSERT ON public.server_bot_event_queue
FOR EACH ROW
EXECUTE FUNCTION public.kick_server_bot_event_processor();
