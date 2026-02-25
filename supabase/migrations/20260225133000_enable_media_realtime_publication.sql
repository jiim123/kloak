-- Ensure media channel updates are emitted over Supabase Realtime.
-- This does not change RLS or RPC permissions; it only publishes existing tables.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) THEN
    IF to_regclass('public.media_items') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'media_items'
       ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.media_items';
    END IF;

    IF to_regclass('public.media_comments') IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM pg_publication_tables
         WHERE pubname = 'supabase_realtime'
           AND schemaname = 'public'
           AND tablename = 'media_comments'
       ) THEN
      EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.media_comments';
    END IF;
  END IF;
END
$$;
