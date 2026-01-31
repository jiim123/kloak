
-- Create announcement_comments table
CREATE TABLE public.announcement_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  reply_to_id uuid REFERENCES public.announcement_comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  edited_at timestamp with time zone
);

-- Create announcement_comment_reactions table
CREATE TABLE public.announcement_comment_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.announcement_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji varchar(32) NOT NULL,
  UNIQUE(comment_id, user_id, emoji)
);

-- Create indexes for performance
CREATE INDEX idx_announcement_comments_message ON public.announcement_comments(message_id);
CREATE INDEX idx_announcement_comments_user ON public.announcement_comments(user_id);
CREATE INDEX idx_announcement_comment_reactions_comment ON public.announcement_comment_reactions(comment_id);

-- Enable RLS
ALTER TABLE public.announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_comment_reactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for announcement_comments
CREATE POLICY "Announcement comments are viewable" ON public.announcement_comments FOR SELECT USING (true);
CREATE POLICY "Announcement comments can be inserted" ON public.announcement_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Announcement comments can be updated" ON public.announcement_comments FOR UPDATE USING (true);
CREATE POLICY "Announcement comments can be deleted" ON public.announcement_comments FOR DELETE USING (true);

-- RLS Policies for announcement_comment_reactions
CREATE POLICY "Announcement comment reactions are viewable" ON public.announcement_comment_reactions FOR SELECT USING (true);
CREATE POLICY "Announcement comment reactions can be inserted" ON public.announcement_comment_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Announcement comment reactions can be deleted" ON public.announcement_comment_reactions FOR DELETE USING (true);

-- Add to supabase_realtime publication for real-time subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcement_comment_reactions;

-- Set REPLICA IDENTITY FULL for reliable UPDATE/DELETE events in realtime
ALTER TABLE public.announcement_comments REPLICA IDENTITY FULL;
ALTER TABLE public.announcement_comment_reactions REPLICA IDENTITY FULL;
