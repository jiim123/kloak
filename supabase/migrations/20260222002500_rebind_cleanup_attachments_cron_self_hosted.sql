-- Rebind cleanup cron job to self-hosted Supabase Functions endpoint.
-- IMPORTANT:
-- Replace `REPLACE_WITH_SELF_HOSTED_ANON_KEY` before applying this migration
-- if your cleanup-attachments function requires JWT verification.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  j RECORD;
BEGIN
  FOR j IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cleanup-expired-attachments'
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END
$$;

SELECT cron.schedule(
  'cleanup-expired-attachments',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'http://84.247.134.58:8000/functions/v1/cleanup-attachments',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer REPLACE_WITH_SELF_HOSTED_ANON_KEY'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
