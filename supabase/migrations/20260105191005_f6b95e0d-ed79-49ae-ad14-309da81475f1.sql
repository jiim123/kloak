-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the cleanup function to run daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-expired-attachments',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://foquucurnwpqcvgqukpz.supabase.co/functions/v1/cleanup-attachments',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvcXV1Y3VybndwcWN2Z3F1a3B6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwOTUyMDYsImV4cCI6MjA4MTY3MTIwNn0.MX1wK26ZEx7zA9x-hY7hAaRXTh4RKX2upG4AGNBNIRk"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);