-- This is a consolidated script to apply all forum-related migrations
-- Run this if you need to apply the migrations manually

-- Step 1: Add 'forum' to channel_type enum
ALTER TYPE public.channel_type ADD VALUE IF NOT EXISTS 'forum';

-- Step 2: Create thread tables
CREATE TABLE IF NOT EXISTS public.threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  message_id uuid NOT NULL UNIQUE REFERENCES public.messages(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  reply_to_id uuid REFERENCES public.thread_messages(id) ON DELETE SET NULL,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.thread_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.thread_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji varchar(64) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_threads_channel_id ON public.threads(channel_id);
CREATE INDEX IF NOT EXISTS idx_threads_message_id ON public.threads(message_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_by ON public.threads(created_by);
CREATE INDEX IF NOT EXISTS idx_thread_messages_thread_id ON public.thread_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_user_id ON public.thread_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_messages_created_at ON public.thread_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_thread_reactions_message_id ON public.thread_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_thread_reactions_user_id ON public.thread_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_thread_attachments_message_id ON public.thread_attachments(message_id);

-- Enable RLS
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Threads are viewable" ON public.threads;
CREATE POLICY "Threads are viewable" ON public.threads FOR SELECT USING (true);
DROP POLICY IF EXISTS "Threads can be inserted" ON public.threads;
CREATE POLICY "Threads can be inserted" ON public.threads FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Threads can be updated" ON public.threads;
CREATE POLICY "Threads can be updated" ON public.threads FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Threads can be deleted" ON public.threads;
CREATE POLICY "Threads can be deleted" ON public.threads FOR DELETE USING (true);

DROP POLICY IF EXISTS "Thread messages are viewable" ON public.thread_messages;
CREATE POLICY "Thread messages are viewable" ON public.thread_messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Thread messages can be inserted" ON public.thread_messages;
CREATE POLICY "Thread messages can be inserted" ON public.thread_messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Thread messages can be updated" ON public.thread_messages;
CREATE POLICY "Thread messages can be updated" ON public.thread_messages FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Thread messages can be deleted" ON public.thread_messages;
CREATE POLICY "Thread messages can be deleted" ON public.thread_messages FOR DELETE USING (true);

DROP POLICY IF EXISTS "Thread reactions are viewable" ON public.thread_reactions;
CREATE POLICY "Thread reactions are viewable" ON public.thread_reactions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Thread reactions can be inserted" ON public.thread_reactions;
CREATE POLICY "Thread reactions can be inserted" ON public.thread_reactions FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Thread reactions can be deleted" ON public.thread_reactions;
CREATE POLICY "Thread reactions can be deleted" ON public.thread_reactions FOR DELETE USING (true);

DROP POLICY IF EXISTS "Thread attachments are viewable" ON public.thread_attachments;
CREATE POLICY "Thread attachments are viewable" ON public.thread_attachments FOR SELECT USING (true);
DROP POLICY IF EXISTS "Thread attachments can be inserted" ON public.thread_attachments;
CREATE POLICY "Thread attachments can be inserted" ON public.thread_attachments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Thread attachments can be deleted" ON public.thread_attachments;
CREATE POLICY "Thread attachments can be deleted" ON public.thread_attachments FOR DELETE USING (true);

-- Enable realtime
ALTER TABLE public.threads REPLICA IDENTITY FULL;
ALTER TABLE public.thread_messages REPLICA IDENTITY FULL;
ALTER TABLE public.thread_reactions REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.threads;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.thread_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE IF NOT EXISTS public.thread_reactions;

-- Step 3: Create thread functions
CREATE OR REPLACE FUNCTION public.create_thread(
  _message_id uuid,
  _user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_channel_id uuid;
  message_user_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  new_thread_id uuid;
BEGIN
  SELECT channel_id, user_id INTO message_channel_id, message_user_id
  FROM messages
  WHERE id = _message_id;

  IF message_channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF message_user_id != _user_id THEN
    SELECT server_id INTO channel_server_id
    FROM channels
    WHERE id = message_channel_id;

    SELECT sm.is_muted INTO is_muted
    FROM server_members sm
    WHERE sm.server_id = channel_server_id
      AND sm.user_id = _user_id
      AND sm.is_banned = false;

    IF is_muted IS NULL THEN
      RAISE EXCEPTION 'Not a member of this server';
    END IF;
  END IF;

  SELECT id INTO new_thread_id
  FROM threads
  WHERE message_id = _message_id;

  IF new_thread_id IS NOT NULL THEN
    RETURN new_thread_id;
  END IF;

  INSERT INTO threads (channel_id, message_id, created_by)
  VALUES (message_channel_id, _message_id, _user_id)
  RETURNING id INTO new_thread_id;

  RETURN new_thread_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_thread_message(
  _thread_id uuid,
  _user_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_channel_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  new_message_id uuid;
  result json;
BEGIN
  SELECT channel_id INTO thread_channel_id
  FROM threads
  WHERE id = _thread_id;

  IF thread_channel_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = thread_channel_id;

  SELECT sm.is_muted INTO is_muted
  FROM server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  INSERT INTO thread_messages (thread_id, user_id, content, reply_to_id)
  VALUES (_thread_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT json_build_object(
    'id', tm.id,
    'thread_id', tm.thread_id,
    'user_id', tm.user_id,
    'content', tm.content,
    'reply_to_id', tm.reply_to_id,
    'edited_at', tm.edited_at,
    'created_at', tm.created_at
  ) INTO result
  FROM thread_messages tm
  WHERE tm.id = new_message_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_thread_messages(
  _thread_id uuid,
  _limit integer DEFAULT 50,
  _before text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH ordered_messages AS (
    SELECT tm.*
    FROM thread_messages tm
    WHERE tm.thread_id = _thread_id
      AND (_before IS NULL OR tm.created_at < _before::timestamptz)
    ORDER BY tm.created_at DESC
    LIMIT _limit
  )
  SELECT json_agg(
    json_build_object(
      'id', om.id,
      'thread_id', om.thread_id,
      'user_id', om.user_id,
      'content', om.content,
      'reply_to_id', om.reply_to_id,
      'edited_at', om.edited_at,
      'created_at', om.created_at,
      'user', (
        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'avatar_decoration', u.avatar_decoration,
          'profile_effect', u.profile_effect,
          'banner_color', u.banner_color,
          'banner_url', u.banner_url,
          'profile_theme_primary', u.profile_theme_primary,
          'profile_theme_accent', u.profile_theme_accent,
          'bio', u.bio,
          'status', u.status,
          'custom_status', u.custom_status
        )
        FROM users u
        WHERE u.id = om.user_id
      )
    )
    ORDER BY om.created_at ASC
  ) INTO result
  FROM ordered_messages om;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_thread_message_count(
  _message_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_id_val uuid;
  message_count integer;
BEGIN
  SELECT id INTO thread_id_val
  FROM threads
  WHERE message_id = _message_id;

  IF thread_id_val IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*) INTO message_count
  FROM thread_messages
  WHERE thread_id = thread_id_val;

  RETURN message_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_thread_info(
  _message_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'channel_id', t.channel_id,
    'message_id', t.message_id,
    'created_by', t.created_by,
    'created_at', t.created_at,
    'message_count', (
      SELECT COUNT(*)
      FROM thread_messages
      WHERE thread_id = t.id
    )
  ) INTO result
  FROM threads t
  WHERE t.message_id = _message_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_thread_by_message_id(
  _message_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(t) INTO result
  FROM threads t
  WHERE t.message_id = _message_id;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_thread(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_thread_message(uuid, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_messages(uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_message_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_by_message_id(uuid) TO anon, authenticated;
