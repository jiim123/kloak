-- Ensure thread tables are in realtime publication
-- This migration ensures thread_messages is available for realtime subscriptions

-- Add to realtime publication if not already added
DO $$
BEGIN
  -- Check if thread_messages is already in the publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'thread_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_messages;
  END IF;

  -- Check if threads is already in the publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'threads'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.threads;
  END IF;

  -- Check if thread_reactions is already in the publication
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'thread_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.thread_reactions;
  END IF;
END $$;
