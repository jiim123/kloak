-- Process server bot events outside the source-row trigger transaction.
--
-- Inline processing runs while the message/task/forum trigger that queued the
-- event is still active. Actions like delete_message then try to mutate the
-- same row whose trigger is currently running, and actions that create task
-- rows can recursively enqueue/process more bot events before the original
-- transaction has settled. Keep the queue, but drain it from pg_cron instead.

DROP TRIGGER IF EXISTS trg_server_bot_event_queue_inline_process ON public.server_bot_event_queue;
DROP FUNCTION IF EXISTS public.kick_server_bot_event_processing();

CREATE EXTENSION IF NOT EXISTS pg_cron;

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
  $$SELECT public.process_server_bot_events(100, 200);$$
);

-- Drain anything that got stuck while inline processing was failing.
SELECT public.process_server_bot_events(100, 200);
