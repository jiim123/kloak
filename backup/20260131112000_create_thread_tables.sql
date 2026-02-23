-- Create thread tables for forum channels

-- Threads Table
-- Each thread is created from a message in a channel
CREATE TABLE IF NOT EXISTS public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  message_id uuid NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Thread Messages Table
-- Messages within a thread (replies to the thread)
CREATE TABLE IF NOT EXISTS public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  reply_to_id uuid REFERENCES public.thread_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Thread Reactions Table
-- Reactions on thread messages
CREATE TABLE IF NOT EXISTS public.thread_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji varchar(64) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

-- Thread Attachments Table (if needed)
CREATE TABLE IF NOT EXISTS public.thread_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  width integer,
  height integer
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_threads_channel_id ON public.threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_threads_message_id ON public.threads(message_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_by ON public.threads(created_by);
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id ON public.thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_user_id ON public.thread_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at ON public.thread_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_thread_reactions_message_id ON public.thread_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_thread_reactions_user_id ON public.thread_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_attachments_message_id ON public.thread_attachments(message_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for custom auth system)
DROP POLICY IF EXISTS "Threads are viewable" ON public.threads;
CREATE POLICY "Threads are viewable" ON public.threads
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Threads can be inserted" ON public.threads;
CREATE POLICY "Threads can be inserted" ON public.threads
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Threads can be updated" ON public.threads;
CREATE POLICY "Threads can be updated" ON public.threads
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Threads can be deleted" ON public.threads;
CREATE POLICY "Threads can be deleted" ON public.threads
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Thread messages are viewable" ON public.thread_messages;
CREATE POLICY "Thread messages are viewable" ON public.thread_messages
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Thread messages can be inserted" ON public.thread_messages;
CREATE POLICY "Thread messages can be inserted" ON public.thread_messages
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Thread messages can be updated" ON public.thread_messages;
CREATE POLICY "Thread messages can be updated" ON public.thread_messages
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Thread messages can be deleted" ON public.thread_messages;
CREATE POLICY "Thread messages can be deleted" ON public.thread_messages
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Thread reactions are viewable" ON public.thread_reactions;
CREATE POLICY "Thread reactions are viewable" ON public.thread_reactions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Thread reactions can be inserted" ON public.thread_reactions;
CREATE POLICY "Thread reactions can be inserted" ON public.thread_reactions
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Thread reactions can be deleted" ON public.thread_reactions;
CREATE POLICY "Thread reactions can be deleted" ON public.thread_reactions
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Thread attachments are viewable" ON public.thread_attachments;
CREATE POLICY "Thread attachments are viewable" ON public.thread_attachments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Thread attachments can be inserted" ON public.thread_attachments;
CREATE POLICY "Thread attachments can be inserted" ON public.thread_attachments
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Thread attachments can be deleted" ON public.thread_attachments;
CREATE POLICY "Thread attachments can be deleted" ON public.thread_attachments
  FOR DELETE USING (true);

-- Enable realtime for thread tables
ALTER TABLE public.threads REPLICA IDENTITY FULL;
ALTER TABLE public.thread_messages REPLICA IDENTITY FULL;
ALTER TABLE public.thread_reactions REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.threads;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.thread_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.thread_reactions;