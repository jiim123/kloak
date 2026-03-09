
-- Ensure pg_cron is available (already enabled from previous setup)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup of stale rate limit records every 6 hours
SELECT cron.schedule(
  'cleanup-rate-limits',
  '0 */6 * * *',
  $$DELETE FROM public.registration_rate_limits WHERE last_attempt_at < now() - interval '48 hours'$$
);
