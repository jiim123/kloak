-- Disable scheduled attachment retention cleanup.
-- Attachments should be retained unless explicitly deleted by users/admin flows.

DO $$
DECLARE
  j RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    FOR j IN
      SELECT jobid
      FROM cron.job
      WHERE jobname IN (
        'cleanup-expired-attachments',
        'cleanup-attachments',
        'attachments-cleanup'
      )
    LOOP
      PERFORM cron.unschedule(j.jobid);
    END LOOP;
  END IF;
END
$$;
