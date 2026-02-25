-- Ensure notifications are emitted over Supabase Realtime.
-- Browser/Tauri popup notifications rely on postgres_changes for public.notifications.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF to_regclass('public.notifications') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'notifications'
       ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
    END IF;
  END IF;
END
$$;
