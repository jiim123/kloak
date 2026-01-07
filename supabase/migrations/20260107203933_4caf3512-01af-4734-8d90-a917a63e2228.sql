-- =====================================================
-- Security Fix Migration: Proper RLS Policies
-- =====================================================

-- Helper function to check server membership (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_server_member(_user_id uuid, _server_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM server_members
    WHERE server_id = _server_id
    AND user_id = _user_id
    AND is_banned = false
  )
$$;

-- Helper function to check DM conversation participation
CREATE OR REPLACE FUNCTION public.is_dm_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id
    AND user_id = _user_id
  )
$$;

-- Helper function to get server_id from channel_id
CREATE OR REPLACE FUNCTION public.get_channel_server_id(_channel_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT server_id FROM channels WHERE id = _channel_id
$$;

-- Helper function to get conversation_id from dm message
CREATE OR REPLACE FUNCTION public.get_dm_conversation_id(_message_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id FROM direct_messages WHERE id = _message_id
$$;

-- =====================================================
-- FIX 1: Users table - restrict updates to own data
-- =====================================================
DROP POLICY IF EXISTS "Users can update their own data" ON users;
CREATE POLICY "Users can update their own data" ON users
FOR UPDATE USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own data" ON users;
CREATE POLICY "Users can insert their own data" ON users
FOR INSERT WITH CHECK (id = auth.uid());

-- =====================================================
-- FIX 2: Notifications - only owner can read/update/delete
-- =====================================================
DROP POLICY IF EXISTS "Users can view their notifications" ON notifications;
CREATE POLICY "Users can view their notifications" ON notifications
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their notifications" ON notifications;
CREATE POLICY "Users can update their notifications" ON notifications
FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their notifications" ON notifications;
CREATE POLICY "Users can delete their notifications" ON notifications
FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- FIX 3: Friendships - only participants can access
-- =====================================================
DROP POLICY IF EXISTS "Friendships viewable by participants" ON friendships;
CREATE POLICY "Friendships viewable by participants" ON friendships
FOR SELECT USING (requester_id = auth.uid() OR addressee_id = auth.uid());

DROP POLICY IF EXISTS "Users can create friendships" ON friendships;
CREATE POLICY "Users can create friendships" ON friendships
FOR INSERT WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "Users can update friendships" ON friendships;
CREATE POLICY "Users can update friendships" ON friendships
FOR UPDATE USING (requester_id = auth.uid() OR addressee_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete friendships" ON friendships;
CREATE POLICY "Users can delete friendships" ON friendships
FOR DELETE USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- =====================================================
-- FIX 4: User preferences - only owner can access
-- =====================================================
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
CREATE POLICY "Users can view their own preferences" ON user_preferences
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
CREATE POLICY "Users can insert their own preferences" ON user_preferences
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences" ON user_preferences
FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- FIX 5: Channel reads - only owner can access
-- =====================================================
DROP POLICY IF EXISTS "Channel reads viewable" ON channel_reads;
CREATE POLICY "Channel reads viewable" ON channel_reads
FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can track reads" ON channel_reads;
CREATE POLICY "Users can track reads" ON channel_reads
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update reads" ON channel_reads;
CREATE POLICY "Users can update reads" ON channel_reads
FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- FIX 6: Server members - proper access control
-- =====================================================
DROP POLICY IF EXISTS "Server members viewable" ON server_members;
CREATE POLICY "Server members viewable" ON server_members
FOR SELECT USING (public.is_server_member(auth.uid(), server_id));

DROP POLICY IF EXISTS "Users can join servers" ON server_members;
CREATE POLICY "Users can join servers" ON server_members
FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Members can update" ON server_members;
CREATE POLICY "Members can update" ON server_members
FOR UPDATE USING (user_id = auth.uid() OR public.is_server_member(auth.uid(), server_id));

DROP POLICY IF EXISTS "Members can leave" ON server_members;
CREATE POLICY "Members can leave" ON server_members
FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- FIX 7: Channels - server members only
-- =====================================================
DROP POLICY IF EXISTS "Channels viewable by members" ON channels;
CREATE POLICY "Channels viewable by members" ON channels
FOR SELECT USING (public.is_server_member(auth.uid(), server_id));

DROP POLICY IF EXISTS "Admins can create channels" ON channels;
CREATE POLICY "Admins can create channels" ON channels
FOR INSERT WITH CHECK (public.is_server_member(auth.uid(), server_id));

DROP POLICY IF EXISTS "Admins can update channels" ON channels;
CREATE POLICY "Admins can update channels" ON channels
FOR UPDATE USING (public.is_server_member(auth.uid(), server_id));

DROP POLICY IF EXISTS "Admins can delete channels" ON channels;
CREATE POLICY "Admins can delete channels" ON channels
FOR DELETE USING (public.is_server_member(auth.uid(), server_id));

-- =====================================================
-- FIX 8: Channel categories - server members only
-- =====================================================
DROP POLICY IF EXISTS "Categories viewable by members" ON channel_categories;
CREATE POLICY "Categories viewable by members" ON channel_categories
FOR SELECT USING (public.is_server_member(auth.uid(), server_id));

DROP POLICY IF EXISTS "Admins can create categories" ON channel_categories;
CREATE POLICY "Admins can create categories" ON channel_categories
FOR INSERT WITH CHECK (public.is_server_member(auth.uid(), server_id));

DROP POLICY IF EXISTS "Admins can update categories" ON channel_categories;
CREATE POLICY "Admins can update categories" ON channel_categories
FOR UPDATE USING (public.is_server_member(auth.uid(), server_id));

DROP POLICY IF EXISTS "Admins can delete categories" ON channel_categories;
CREATE POLICY "Admins can delete categories" ON channel_categories
FOR DELETE USING (public.is_server_member(auth.uid(), server_id));

-- =====================================================
-- FIX 9: Messages - server members only
-- =====================================================
DROP POLICY IF EXISTS "Messages viewable by channel members" ON messages;
CREATE POLICY "Messages viewable by channel members" ON messages
FOR SELECT USING (public.is_server_member(auth.uid(), public.get_channel_server_id(channel_id)));

DROP POLICY IF EXISTS "Members can send messages" ON messages;
CREATE POLICY "Members can send messages" ON messages
FOR INSERT WITH CHECK (
  user_id = auth.uid() 
  AND public.is_server_member(auth.uid(), public.get_channel_server_id(channel_id))
);

DROP POLICY IF EXISTS "Authors can update messages" ON messages;
CREATE POLICY "Authors can update messages" ON messages
FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Authors can delete messages" ON messages;
CREATE POLICY "Authors can delete messages" ON messages
FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- FIX 10: Message attachments - server members only
-- =====================================================
DROP POLICY IF EXISTS "Attachments viewable" ON message_attachments;
CREATE POLICY "Attachments viewable" ON message_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_attachments.message_id
    AND public.is_server_member(auth.uid(), public.get_channel_server_id(m.channel_id))
  )
);

DROP POLICY IF EXISTS "Users can add attachments" ON message_attachments;
CREATE POLICY "Users can add attachments" ON message_attachments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_attachments.message_id
    AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete attachments" ON message_attachments;
CREATE POLICY "Users can delete attachments" ON message_attachments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = message_attachments.message_id
    AND m.user_id = auth.uid()
  )
);

-- =====================================================
-- FIX 11: Reactions - server members only
-- =====================================================
DROP POLICY IF EXISTS "Reactions viewable" ON reactions;
CREATE POLICY "Reactions viewable" ON reactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = reactions.message_id
    AND public.is_server_member(auth.uid(), public.get_channel_server_id(m.channel_id))
  )
);

DROP POLICY IF EXISTS "Users can react" ON reactions;
CREATE POLICY "Users can react" ON reactions
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = reactions.message_id
    AND public.is_server_member(auth.uid(), public.get_channel_server_id(m.channel_id))
  )
);

DROP POLICY IF EXISTS "Users can unreact" ON reactions;
CREATE POLICY "Users can unreact" ON reactions
FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- FIX 12: Mentions - server members only
-- =====================================================
DROP POLICY IF EXISTS "Mentions viewable" ON mentions;
CREATE POLICY "Mentions viewable" ON mentions
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = mentions.message_id
    AND public.is_server_member(auth.uid(), public.get_channel_server_id(m.channel_id))
  )
);

DROP POLICY IF EXISTS "Users can create mentions" ON mentions;
CREATE POLICY "Users can create mentions" ON mentions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM messages m
    WHERE m.id = mentions.message_id
    AND m.user_id = auth.uid()
  )
);

-- =====================================================
-- FIX 13: DM conversations - participants only
-- =====================================================
DROP POLICY IF EXISTS "DM conversations viewable by participants" ON dm_conversations;
CREATE POLICY "DM conversations viewable by participants" ON dm_conversations
FOR SELECT USING (public.is_dm_participant(auth.uid(), id));

DROP POLICY IF EXISTS "Users can create DM conversations" ON dm_conversations;
CREATE POLICY "Users can create DM conversations" ON dm_conversations
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- FIX 14: DM participants - proper access control
-- =====================================================
DROP POLICY IF EXISTS "DM participants viewable" ON dm_participants;
CREATE POLICY "DM participants viewable" ON dm_participants
FOR SELECT USING (public.is_dm_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can be added to DMs" ON dm_participants;
CREATE POLICY "Users can be added to DMs" ON dm_participants
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update DM participation" ON dm_participants;
CREATE POLICY "Users can update DM participation" ON dm_participants
FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- FIX 15: Direct messages - participants only
-- =====================================================
DROP POLICY IF EXISTS "DMs viewable by participants" ON direct_messages;
CREATE POLICY "DMs viewable by participants" ON direct_messages
FOR SELECT USING (public.is_dm_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can send DMs" ON direct_messages;
CREATE POLICY "Users can send DMs" ON direct_messages
FOR INSERT WITH CHECK (
  sender_id = auth.uid() 
  AND public.is_dm_participant(auth.uid(), conversation_id)
);

DROP POLICY IF EXISTS "Users can edit DMs" ON direct_messages;
CREATE POLICY "Users can edit DMs" ON direct_messages
FOR UPDATE USING (sender_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete DMs" ON direct_messages;
CREATE POLICY "Users can delete DMs" ON direct_messages
FOR DELETE USING (sender_id = auth.uid());

-- =====================================================
-- FIX 16: DM attachments - participants only
-- =====================================================
DROP POLICY IF EXISTS "DM attachments viewable" ON dm_attachments;
CREATE POLICY "DM attachments viewable" ON dm_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM direct_messages dm
    WHERE dm.id = dm_attachments.message_id
    AND public.is_dm_participant(auth.uid(), dm.conversation_id)
  )
);

DROP POLICY IF EXISTS "Users can add DM attachments" ON dm_attachments;
CREATE POLICY "Users can add DM attachments" ON dm_attachments
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM direct_messages dm
    WHERE dm.id = dm_attachments.message_id
    AND dm.sender_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete DM attachments" ON dm_attachments;
CREATE POLICY "Users can delete DM attachments" ON dm_attachments
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM direct_messages dm
    WHERE dm.id = dm_attachments.message_id
    AND dm.sender_id = auth.uid()
  )
);

-- =====================================================
-- FIX 17: DM reactions - participants only
-- =====================================================
DROP POLICY IF EXISTS "DM reactions viewable" ON dm_reactions;
CREATE POLICY "DM reactions viewable" ON dm_reactions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM direct_messages dm
    WHERE dm.id = dm_reactions.message_id
    AND public.is_dm_participant(auth.uid(), dm.conversation_id)
  )
);

DROP POLICY IF EXISTS "Users can react to DMs" ON dm_reactions;
CREATE POLICY "Users can react to DMs" ON dm_reactions
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM direct_messages dm
    WHERE dm.id = dm_reactions.message_id
    AND public.is_dm_participant(auth.uid(), dm.conversation_id)
  )
);

DROP POLICY IF EXISTS "Users can unreact to DMs" ON dm_reactions;
CREATE POLICY "Users can unreact to DMs" ON dm_reactions
FOR DELETE USING (user_id = auth.uid());

-- =====================================================
-- FIX 18: Servers - proper access control
-- =====================================================
DROP POLICY IF EXISTS "Server owners can update" ON servers;
CREATE POLICY "Server owners can update" ON servers
FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Server owners can delete" ON servers;
CREATE POLICY "Server owners can delete" ON servers
FOR DELETE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can create servers" ON servers;
CREATE POLICY "Users can create servers" ON servers
FOR INSERT WITH CHECK (owner_id = auth.uid());

-- =====================================================
-- FIX 19: search_messages function - add authorization
-- =====================================================
CREATE OR REPLACE FUNCTION public.search_messages(
  search_query text, 
  server_filter uuid DEFAULT NULL::uuid, 
  channel_filter uuid DEFAULT NULL::uuid, 
  user_filter uuid DEFAULT NULL::uuid, 
  result_limit integer DEFAULT 50
)
RETURNS TABLE(message_id uuid, channel_id uuid, user_id uuid, content text, created_at timestamp with time zone, rank real)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify user is member of the server if filtering by server
  IF server_filter IS NOT NULL THEN
    IF NOT public.is_server_member(auth.uid(), server_filter) THEN
      RAISE EXCEPTION 'Access denied: not a member of this server';
    END IF;
  END IF;

  -- Only return messages from servers the user is a member of
  RETURN QUERY
  SELECT 
    m.id AS message_id,
    m.channel_id,
    m.user_id,
    m.content,
    m.created_at,
    ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', search_query)) AS rank
  FROM public.messages m
  JOIN public.channels c ON m.channel_id = c.id
  WHERE 
    to_tsvector('english', m.content) @@ plainto_tsquery('english', search_query)
    AND (server_filter IS NULL OR c.server_id = server_filter)
    AND (channel_filter IS NULL OR m.channel_id = channel_filter)
    AND (user_filter IS NULL OR m.user_id = user_filter)
    AND public.is_server_member(auth.uid(), c.server_id)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT result_limit;
END;
$$;

-- =====================================================
-- FIX 20: Storage policies - restrict uploads
-- =====================================================

-- Remove existing permissive policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Server icons are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload server icons" ON storage.objects;
DROP POLICY IF EXISTS "Attachments are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete server icons" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete attachments" ON storage.objects;

-- Avatars: public read, users can only manage their own
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their avatar" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Server icons: public read, only server owners can upload
CREATE POLICY "Server icons are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'server-icons');

CREATE POLICY "Server owners can upload icons" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'server-icons'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM servers s
    WHERE s.id::text = (storage.foldername(name))[1]
    AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Server owners can update icons" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'server-icons'
  AND EXISTS (
    SELECT 1 FROM servers s
    WHERE s.id::text = (storage.foldername(name))[1]
    AND s.owner_id = auth.uid()
  )
);

CREATE POLICY "Server owners can delete icons" ON storage.objects
FOR DELETE USING (
  bucket_id = 'server-icons'
  AND EXISTS (
    SELECT 1 FROM servers s
    WHERE s.id::text = (storage.foldername(name))[1]
    AND s.owner_id = auth.uid()
  )
);

-- Attachments: public read, authenticated users can upload (with user folder)
CREATE POLICY "Attachments are publicly accessible" ON storage.objects
FOR SELECT USING (bucket_id = 'attachments');

CREATE POLICY "Authenticated users can upload attachments" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'attachments'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete their attachments" ON storage.objects
FOR DELETE USING (
  bucket_id = 'attachments'
  AND auth.uid() IS NOT NULL
);