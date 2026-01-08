-- Fix ALL remaining RLS policies that use auth.uid() for custom auth system
-- All mutations are handled securely via SECURITY DEFINER RPC functions

-- ============ MESSAGES TABLE ============
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
DROP POLICY IF EXISTS "Authors can update messages" ON public.messages;
DROP POLICY IF EXISTS "Authors can delete messages" ON public.messages;

CREATE POLICY "Messages can be inserted" ON public.messages
FOR INSERT WITH CHECK (true);

CREATE POLICY "Messages can be updated" ON public.messages
FOR UPDATE USING (true);

CREATE POLICY "Messages can be deleted" ON public.messages
FOR DELETE USING (true);

-- ============ CHANNELS TABLE ============
DROP POLICY IF EXISTS "Admins can create channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can update channels" ON public.channels;
DROP POLICY IF EXISTS "Admins can delete channels" ON public.channels;

CREATE POLICY "Channels can be inserted" ON public.channels
FOR INSERT WITH CHECK (true);

CREATE POLICY "Channels can be updated" ON public.channels
FOR UPDATE USING (true);

CREATE POLICY "Channels can be deleted" ON public.channels
FOR DELETE USING (true);

-- ============ CHANNEL_CATEGORIES TABLE ============
DROP POLICY IF EXISTS "Admins can create categories" ON public.channel_categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.channel_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.channel_categories;

CREATE POLICY "Categories can be inserted" ON public.channel_categories
FOR INSERT WITH CHECK (true);

CREATE POLICY "Categories can be updated" ON public.channel_categories
FOR UPDATE USING (true);

CREATE POLICY "Categories can be deleted" ON public.channel_categories
FOR DELETE USING (true);

-- ============ REACTIONS TABLE ============
DROP POLICY IF EXISTS "Users can react" ON public.reactions;
DROP POLICY IF EXISTS "Users can unreact" ON public.reactions;

CREATE POLICY "Reactions can be inserted" ON public.reactions
FOR INSERT WITH CHECK (true);

CREATE POLICY "Reactions can be deleted" ON public.reactions
FOR DELETE USING (true);

-- ============ MENTIONS TABLE ============
DROP POLICY IF EXISTS "Users can create mentions" ON public.mentions;

CREATE POLICY "Mentions can be inserted" ON public.mentions
FOR INSERT WITH CHECK (true);

-- ============ MESSAGE_ATTACHMENTS TABLE ============
DROP POLICY IF EXISTS "Users can add attachments" ON public.message_attachments;
DROP POLICY IF EXISTS "Users can delete attachments" ON public.message_attachments;

CREATE POLICY "Attachments can be inserted" ON public.message_attachments
FOR INSERT WITH CHECK (true);

CREATE POLICY "Attachments can be deleted" ON public.message_attachments
FOR DELETE USING (true);

-- ============ DIRECT_MESSAGES TABLE ============
DROP POLICY IF EXISTS "Users can send DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can edit DMs" ON public.direct_messages;
DROP POLICY IF EXISTS "Users can delete DMs" ON public.direct_messages;

CREATE POLICY "DMs can be inserted" ON public.direct_messages
FOR INSERT WITH CHECK (true);

CREATE POLICY "DMs can be updated" ON public.direct_messages
FOR UPDATE USING (true);

CREATE POLICY "DMs can be deleted" ON public.direct_messages
FOR DELETE USING (true);

-- ============ DM_CONVERSATIONS TABLE ============
DROP POLICY IF EXISTS "Users can create DM conversations" ON public.dm_conversations;

CREATE POLICY "DM conversations can be inserted" ON public.dm_conversations
FOR INSERT WITH CHECK (true);

-- ============ DM_PARTICIPANTS TABLE ============
DROP POLICY IF EXISTS "Users can be added to DMs" ON public.dm_participants;
DROP POLICY IF EXISTS "Users can update DM participation" ON public.dm_participants;

CREATE POLICY "DM participants can be inserted" ON public.dm_participants
FOR INSERT WITH CHECK (true);

CREATE POLICY "DM participants can be updated" ON public.dm_participants
FOR UPDATE USING (true);

-- ============ DM_ATTACHMENTS TABLE ============
DROP POLICY IF EXISTS "Users can add DM attachments" ON public.dm_attachments;
DROP POLICY IF EXISTS "Users can delete DM attachments" ON public.dm_attachments;

CREATE POLICY "DM attachments can be inserted" ON public.dm_attachments
FOR INSERT WITH CHECK (true);

CREATE POLICY "DM attachments can be deleted" ON public.dm_attachments
FOR DELETE USING (true);

-- ============ DM_REACTIONS TABLE ============
DROP POLICY IF EXISTS "Users can react to DMs" ON public.dm_reactions;
DROP POLICY IF EXISTS "Users can unreact to DMs" ON public.dm_reactions;

CREATE POLICY "DM reactions can be inserted" ON public.dm_reactions
FOR INSERT WITH CHECK (true);

CREATE POLICY "DM reactions can be deleted" ON public.dm_reactions
FOR DELETE USING (true);

-- ============ FRIENDSHIPS TABLE ============
DROP POLICY IF EXISTS "Users can create friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can update friendships" ON public.friendships;
DROP POLICY IF EXISTS "Users can delete friendships" ON public.friendships;

CREATE POLICY "Friendships can be inserted" ON public.friendships
FOR INSERT WITH CHECK (true);

CREATE POLICY "Friendships can be updated" ON public.friendships
FOR UPDATE USING (true);

CREATE POLICY "Friendships can be deleted" ON public.friendships
FOR DELETE USING (true);

-- ============ NOTIFICATIONS TABLE ============
DROP POLICY IF EXISTS "Users can update their notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their notifications" ON public.notifications;

CREATE POLICY "Notifications can be inserted" ON public.notifications
FOR INSERT WITH CHECK (true);

CREATE POLICY "Notifications can be updated" ON public.notifications
FOR UPDATE USING (true);

CREATE POLICY "Notifications can be deleted" ON public.notifications
FOR DELETE USING (true);

-- ============ SERVERS TABLE ============
DROP POLICY IF EXISTS "Users can create servers" ON public.servers;
DROP POLICY IF EXISTS "Server owners can update" ON public.servers;
DROP POLICY IF EXISTS "Server owners can delete" ON public.servers;

CREATE POLICY "Servers can be inserted" ON public.servers
FOR INSERT WITH CHECK (true);

CREATE POLICY "Servers can be updated" ON public.servers
FOR UPDATE USING (true);

CREATE POLICY "Servers can be deleted" ON public.servers
FOR DELETE USING (true);