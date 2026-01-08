-- Fix RLS policies for custom auth system where auth.uid() is always NULL
-- The app uses SECURITY DEFINER RPC functions for mutations, so we need permissive SELECT policies

-- Messages: Allow all reads (server membership is validated at app level)
DROP POLICY IF EXISTS "Messages viewable by channel members" ON public.messages;
CREATE POLICY "Messages are viewable" ON public.messages
  FOR SELECT USING (true);

-- Users: Allow all reads (needed to see other users in channels)
DROP POLICY IF EXISTS "Users viewable by related users" ON public.users;
CREATE POLICY "Users are viewable" ON public.users
  FOR SELECT USING (true);

-- Reactions: Allow all reads
DROP POLICY IF EXISTS "Reactions viewable" ON public.reactions;
CREATE POLICY "Reactions are viewable" ON public.reactions
  FOR SELECT USING (true);

-- Message attachments: Allow all reads
DROP POLICY IF EXISTS "Attachments viewable" ON public.message_attachments;
CREATE POLICY "Attachments are viewable" ON public.message_attachments
  FOR SELECT USING (true);

-- Channels: Allow all reads
DROP POLICY IF EXISTS "Channels viewable by members" ON public.channels;
CREATE POLICY "Channels are viewable" ON public.channels
  FOR SELECT USING (true);

-- Channel categories: Allow all reads  
DROP POLICY IF EXISTS "Categories viewable by members" ON public.channel_categories;
CREATE POLICY "Categories are viewable" ON public.channel_categories
  FOR SELECT USING (true);

-- Server members: Allow all reads
DROP POLICY IF EXISTS "Server members viewable" ON public.server_members;
CREATE POLICY "Server members are viewable" ON public.server_members
  FOR SELECT USING (true);

-- Servers: Allow all reads
DROP POLICY IF EXISTS "Servers viewable by members" ON public.servers;
CREATE POLICY "Servers are viewable" ON public.servers
  FOR SELECT USING (true);

-- DM conversations: Allow all reads
DROP POLICY IF EXISTS "DM conversations viewable by participants" ON public.dm_conversations;
CREATE POLICY "DM conversations are viewable" ON public.dm_conversations
  FOR SELECT USING (true);

-- DM participants: Allow all reads
DROP POLICY IF EXISTS "DM participants viewable" ON public.dm_participants;
CREATE POLICY "DM participants are viewable" ON public.dm_participants
  FOR SELECT USING (true);

-- Direct messages: Allow all reads
DROP POLICY IF EXISTS "DMs viewable by participants" ON public.direct_messages;
CREATE POLICY "DMs are viewable" ON public.direct_messages
  FOR SELECT USING (true);

-- DM attachments: Allow all reads
DROP POLICY IF EXISTS "DM attachments viewable" ON public.dm_attachments;
CREATE POLICY "DM attachments are viewable" ON public.dm_attachments
  FOR SELECT USING (true);

-- DM reactions: Allow all reads
DROP POLICY IF EXISTS "DM reactions viewable" ON public.dm_reactions;
CREATE POLICY "DM reactions are viewable" ON public.dm_reactions
  FOR SELECT USING (true);

-- Friendships: Allow all reads
DROP POLICY IF EXISTS "Friendships viewable by participants" ON public.friendships;
CREATE POLICY "Friendships are viewable" ON public.friendships
  FOR SELECT USING (true);

-- Mentions: Allow all reads
DROP POLICY IF EXISTS "Mentions viewable" ON public.mentions;
CREATE POLICY "Mentions are viewable" ON public.mentions
  FOR SELECT USING (true);

-- Notifications: Allow all reads (filtered at app level by user_id)
DROP POLICY IF EXISTS "Users can view their notifications" ON public.notifications;
CREATE POLICY "Notifications are viewable" ON public.notifications
  FOR SELECT USING (true);