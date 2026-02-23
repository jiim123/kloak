-- Create enums for status types
CREATE TYPE public.user_status AS ENUM ('online', 'idle', 'dnd', 'offline');
CREATE TYPE public.friendship_status AS ENUM ('pending', 'accepted', 'blocked');
CREATE TYPE public.server_role AS ENUM ('owner', 'admin', 'moderator', 'member');
CREATE TYPE public.channel_type AS ENUM ('text', 'voice', 'announcement');
CREATE TYPE public.mention_type AS ENUM ('user', 'everyone', 'here', 'role');
CREATE TYPE public.notification_type AS ENUM ('mention', 'dm', 'friend_request', 'server_invite');

-- Users Table (custom auth via secret key)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(20) UNIQUE NOT NULL,
  key_hash CHAR(64) NOT NULL,
  display_name VARCHAR(32),
  avatar_url TEXT,
  banner_color CHAR(7) DEFAULT '#5865F2',
  bio TEXT,
  status user_status DEFAULT 'online',
  custom_status VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen TIMESTAMPTZ DEFAULT now()
);

-- Friendships Table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status friendship_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- Servers Table
CREATE TABLE public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  icon_url TEXT,
  banner_url TEXT,
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invite_code CHAR(8) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Server Members Table
CREATE TABLE public.server_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role server_role DEFAULT 'member',
  nickname VARCHAR(32),
  is_banned BOOLEAN DEFAULT false,
  is_muted BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(server_id, user_id)
);

-- Channel Categories Table
CREATE TABLE public.channel_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  position INTEGER DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Channels Table
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.channel_categories(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  topic TEXT,
  type channel_type DEFAULT 'text',
  position INTEGER DEFAULT 0,
  is_nsfw BOOLEAN DEFAULT false,
  slowmode_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages Table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Message Attachments Table
CREATE TABLE public.message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER
);

-- Reactions Table
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji VARCHAR(64) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

-- Mentions Table
CREATE TABLE public.mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  mention_type mention_type DEFAULT 'user'
);

-- DM Conversations Table
CREATE TABLE public.dm_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DM Participants Table
CREATE TABLE public.dm_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ,
  UNIQUE(conversation_id, user_id)
);

-- Direct Messages Table
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reply_to_id UUID REFERENCES public.direct_messages(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- DM Attachments Table
CREATE TABLE public.dm_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  width INTEGER,
  height INTEGER
);

-- DM Reactions Table
CREATE TABLE public.dm_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  emoji VARCHAR(64) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

-- Channel Reads Table
CREATE TABLE public.channel_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  last_read_at TIMESTAMPTZ,
  mention_count INTEGER DEFAULT 0,
  UNIQUE(channel_id, user_id)
);

-- Notifications Table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_users_username ON public.users(username);
CREATE INDEX idx_users_key_hash ON public.users(key_hash);
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_servers_invite_code ON public.servers(invite_code);
CREATE INDEX idx_server_members_server ON public.server_members(server_id);
CREATE INDEX idx_server_members_user ON public.server_members(user_id);
CREATE INDEX idx_channels_server ON public.channels(server_id);
CREATE INDEX idx_channels_category ON public.channels(category_id);
CREATE INDEX idx_messages_channel ON public.messages(channel_id);
CREATE INDEX idx_messages_user ON public.messages(user_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_reactions_message ON public.reactions(message_id);
CREATE INDEX idx_mentions_message ON public.mentions(message_id);
CREATE INDEX idx_mentions_user ON public.mentions(user_id);
CREATE INDEX idx_dm_participants_conversation ON public.dm_participants(conversation_id);
CREATE INDEX idx_dm_participants_user ON public.dm_participants(user_id);
CREATE INDEX idx_direct_messages_conversation ON public.direct_messages(conversation_id);
CREATE INDEX idx_direct_messages_created_at ON public.direct_messages(created_at DESC);
CREATE INDEX idx_channel_reads_channel ON public.channel_reads(channel_id);
CREATE INDEX idx_channel_reads_user ON public.channel_reads(user_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE is_read = false;

-- Full-text search index on messages
CREATE INDEX idx_messages_content_search ON public.messages USING gin(to_tsvector('english', content));
CREATE INDEX idx_direct_messages_content_search ON public.direct_messages USING gin(to_tsvector('english', content));

-- Enable Row Level Security on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- MVP Permissive policies (public read/write for now - will be tightened later)
-- Users policies
CREATE POLICY "Users are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can insert their own data" ON public.users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their own data" ON public.users FOR UPDATE USING (true);

-- Friendships policies
CREATE POLICY "Friendships viewable by participants" ON public.friendships FOR SELECT USING (true);
CREATE POLICY "Users can create friendships" ON public.friendships FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update friendships" ON public.friendships FOR UPDATE USING (true);
CREATE POLICY "Users can delete friendships" ON public.friendships FOR DELETE USING (true);

-- Servers policies
CREATE POLICY "Servers are viewable by everyone" ON public.servers FOR SELECT USING (true);
CREATE POLICY "Users can create servers" ON public.servers FOR INSERT WITH CHECK (true);
CREATE POLICY "Server owners can update" ON public.servers FOR UPDATE USING (true);
CREATE POLICY "Server owners can delete" ON public.servers FOR DELETE USING (true);

-- Server Members policies
CREATE POLICY "Server members viewable" ON public.server_members FOR SELECT USING (true);
CREATE POLICY "Users can join servers" ON public.server_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Members can update" ON public.server_members FOR UPDATE USING (true);
CREATE POLICY "Members can leave" ON public.server_members FOR DELETE USING (true);

-- Channel Categories policies
CREATE POLICY "Categories viewable by members" ON public.channel_categories FOR SELECT USING (true);
CREATE POLICY "Admins can create categories" ON public.channel_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update categories" ON public.channel_categories FOR UPDATE USING (true);
CREATE POLICY "Admins can delete categories" ON public.channel_categories FOR DELETE USING (true);

-- Channels policies
CREATE POLICY "Channels viewable by members" ON public.channels FOR SELECT USING (true);
CREATE POLICY "Admins can create channels" ON public.channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update channels" ON public.channels FOR UPDATE USING (true);
CREATE POLICY "Admins can delete channels" ON public.channels FOR DELETE USING (true);

-- Messages policies
CREATE POLICY "Messages viewable by channel members" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Members can send messages" ON public.messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Authors can update messages" ON public.messages FOR UPDATE USING (true);
CREATE POLICY "Authors can delete messages" ON public.messages FOR DELETE USING (true);

-- Message Attachments policies
CREATE POLICY "Attachments viewable" ON public.message_attachments FOR SELECT USING (true);
CREATE POLICY "Users can add attachments" ON public.message_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete attachments" ON public.message_attachments FOR DELETE USING (true);

-- Reactions policies
CREATE POLICY "Reactions viewable" ON public.reactions FOR SELECT USING (true);
CREATE POLICY "Users can react" ON public.reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can unreact" ON public.reactions FOR DELETE USING (true);

-- Mentions policies
CREATE POLICY "Mentions viewable" ON public.mentions FOR SELECT USING (true);
CREATE POLICY "Users can create mentions" ON public.mentions FOR INSERT WITH CHECK (true);

-- DM Conversations policies
CREATE POLICY "DM conversations viewable by participants" ON public.dm_conversations FOR SELECT USING (true);
CREATE POLICY "Users can create DM conversations" ON public.dm_conversations FOR INSERT WITH CHECK (true);

-- DM Participants policies
CREATE POLICY "DM participants viewable" ON public.dm_participants FOR SELECT USING (true);
CREATE POLICY "Users can be added to DMs" ON public.dm_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update DM participation" ON public.dm_participants FOR UPDATE USING (true);

-- Direct Messages policies
CREATE POLICY "DMs viewable by participants" ON public.direct_messages FOR SELECT USING (true);
CREATE POLICY "Users can send DMs" ON public.direct_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can edit DMs" ON public.direct_messages FOR UPDATE USING (true);
CREATE POLICY "Users can delete DMs" ON public.direct_messages FOR DELETE USING (true);

-- DM Attachments policies
CREATE POLICY "DM attachments viewable" ON public.dm_attachments FOR SELECT USING (true);
CREATE POLICY "Users can add DM attachments" ON public.dm_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can delete DM attachments" ON public.dm_attachments FOR DELETE USING (true);

-- DM Reactions policies
CREATE POLICY "DM reactions viewable" ON public.dm_reactions FOR SELECT USING (true);
CREATE POLICY "Users can react to DMs" ON public.dm_reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can unreact to DMs" ON public.dm_reactions FOR DELETE USING (true);

-- Channel Reads policies
CREATE POLICY "Channel reads viewable" ON public.channel_reads FOR SELECT USING (true);
CREATE POLICY "Users can track reads" ON public.channel_reads FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update reads" ON public.channel_reads FOR UPDATE USING (true);

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON public.notifications FOR SELECT USING (true);
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their notifications" ON public.notifications FOR UPDATE USING (true);
CREATE POLICY "Users can delete their notifications" ON public.notifications FOR DELETE USING (true);

-- Enable Realtime for specified tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- Helper function to generate invite codes (no ambiguous chars: 0, O, 1, I, L)
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS CHAR(8)
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Full-text search function for messages
CREATE OR REPLACE FUNCTION public.search_messages(
  search_query TEXT,
  server_filter UUID DEFAULT NULL,
  channel_filter UUID DEFAULT NULL,
  user_filter UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  message_id UUID,
  channel_id UUID,
  user_id UUID,
  content TEXT,
  created_at TIMESTAMPTZ,
  rank REAL
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
  ORDER BY rank DESC, m.created_at DESC
  LIMIT result_limit;
END;
$$;

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('server-icons', 'server-icons', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true);

-- Storage policies for public read access
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Users can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
CREATE POLICY "Users can delete avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars');

CREATE POLICY "Server icons are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'server-icons');
CREATE POLICY "Users can upload server icons" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'server-icons');
CREATE POLICY "Users can update server icons" ON storage.objects FOR UPDATE USING (bucket_id = 'server-icons');
CREATE POLICY "Users can delete server icons" ON storage.objects FOR DELETE USING (bucket_id = 'server-icons');

CREATE POLICY "Attachments are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'attachments');
CREATE POLICY "Users can upload attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'attachments');
CREATE POLICY "Users can delete attachments" ON storage.objects FOR DELETE USING (bucket_id = 'attachments');