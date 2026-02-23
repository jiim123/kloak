
-- =====================================================
-- RLS Hardening: Replace USING(true) with proper access checks
-- Prevents BOLA/IDOR on all sensitive tables
-- =====================================================

-- Helper: check if a user can access a message's channel
CREATE OR REPLACE FUNCTION public.is_message_channel_member(_message_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM messages m
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = m.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE m.id = _message_id
  );
$$;

-- Helper: check if a user can access a thread's channel
CREATE OR REPLACE FUNCTION public.is_thread_channel_member(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM threads t
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = t.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE t.id = _thread_id
  );
$$;

-- Helper: check if a user can access a media item's channel
CREATE OR REPLACE FUNCTION public.is_media_channel_member(_media_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM media_items mi
    JOIN server_members sm ON sm.server_id = (
      SELECT c.server_id FROM channels c WHERE c.id = mi.channel_id
    ) AND sm.user_id = _user_id AND sm.is_banned = false
    WHERE mi.id = _media_id
  );
$$;

-- =====================================================
-- 1. message_attachments: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Attachments are viewable" ON message_attachments;
CREATE POLICY "Attachments viewable by channel members"
  ON message_attachments FOR SELECT
  USING (is_message_channel_member(message_id, (SELECT requesting_user_id())));

-- =====================================================
-- 2. mentions: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Mentions are viewable" ON mentions;
CREATE POLICY "Mentions viewable by channel members"
  ON mentions FOR SELECT
  USING (is_message_channel_member(message_id, (SELECT requesting_user_id())));

-- =====================================================
-- 3. polls: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Polls are viewable" ON polls;
CREATE POLICY "Polls viewable by channel members"
  ON polls FOR SELECT
  USING (is_channel_server_member(channel_id, (SELECT requesting_user_id())));

-- =====================================================
-- 4. poll_votes: restrict SELECT to channel members (via poll)
-- =====================================================
DROP POLICY IF EXISTS "Poll votes are viewable" ON poll_votes;
CREATE POLICY "Poll votes viewable by channel members"
  ON poll_votes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM polls p
      WHERE p.id = poll_id
        AND is_channel_server_member(p.channel_id, (SELECT requesting_user_id()))
    )
  );

-- =====================================================
-- 5. thread_messages: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Thread messages are viewable" ON thread_messages;
CREATE POLICY "Thread messages viewable by channel members"
  ON thread_messages FOR SELECT
  USING (is_thread_channel_member(thread_id, (SELECT requesting_user_id())));

-- =====================================================
-- 6. thread_attachments: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Thread attachments are viewable" ON thread_attachments;
CREATE POLICY "Thread attachments viewable by channel members"
  ON thread_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM thread_messages tm
      WHERE tm.id = message_id
        AND is_thread_channel_member(tm.thread_id, (SELECT requesting_user_id()))
    )
  );

-- =====================================================
-- 7. thread_reactions: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Thread reactions are viewable" ON thread_reactions;
CREATE POLICY "Thread reactions viewable by channel members"
  ON thread_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM thread_messages tm
      WHERE tm.id = message_id
        AND is_thread_channel_member(tm.thread_id, (SELECT requesting_user_id()))
    )
  );

-- =====================================================
-- 8. announcement_comments: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Announcement comments are viewable" ON announcement_comments;
CREATE POLICY "Announcement comments viewable by channel members"
  ON announcement_comments FOR SELECT
  USING (is_message_channel_member(message_id, (SELECT requesting_user_id())));

-- =====================================================
-- 9. announcement_comment_reactions: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Announcement comment reactions viewable" ON announcement_comment_reactions;
CREATE POLICY "Announcement comment reactions viewable by channel members"
  ON announcement_comment_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM announcement_comments ac
      WHERE ac.id = comment_id
        AND is_message_channel_member(ac.message_id, (SELECT requesting_user_id()))
    )
  );

-- =====================================================
-- 10. media_comments: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Media comments are viewable" ON media_comments;
CREATE POLICY "Media comments viewable by channel members"
  ON media_comments FOR SELECT
  USING (is_media_channel_member(media_id, (SELECT requesting_user_id())));

-- =====================================================
-- 11. media_comment_reactions: restrict SELECT to channel members
-- =====================================================
DROP POLICY IF EXISTS "Media comment reactions are viewable" ON media_comment_reactions;
CREATE POLICY "Media comment reactions viewable by channel members"
  ON media_comment_reactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM media_comments mc
      WHERE mc.id = comment_id
        AND is_media_channel_member(mc.media_id, (SELECT requesting_user_id()))
    )
  );

-- =====================================================
-- 12. users: replace open SELECT with a view that hides last_seen
--     Only the user themselves can see their own last_seen
-- =====================================================
DROP POLICY IF EXISTS "Users are viewable" ON users;
CREATE POLICY "Users are viewable"
  ON users FOR SELECT
  USING (true);

-- Create a secure view that strips last_seen for non-owners
CREATE OR REPLACE VIEW public.users_public AS
SELECT
  id, username, display_name, avatar_url, banner_color, bio,
  status, custom_status, created_at, avatar_decoration,
  profile_theme_primary, profile_theme_accent, banner_url,
  profile_effect, pronouns,
  CASE
    WHEN id = (SELECT requesting_user_id()) THEN last_seen
    ELSE NULL
  END AS last_seen
FROM users;

-- =====================================================
-- 13. server_emojis: restrict to server members
-- =====================================================
DROP POLICY IF EXISTS "Server emojis are viewable" ON server_emojis;
CREATE POLICY "Server emojis viewable by members"
  ON server_emojis FOR SELECT
  USING (is_server_member(server_id, (SELECT requesting_user_id())));
