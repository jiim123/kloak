-- Set REPLICA IDENTITY FULL on messages table for reliable realtime updates
ALTER TABLE public.messages REPLICA IDENTITY FULL;

-- Also set for other realtime tables
ALTER TABLE public.direct_messages REPLICA IDENTITY FULL;
ALTER TABLE public.reactions REPLICA IDENTITY FULL;
ALTER TABLE public.dm_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.users REPLICA IDENTITY FULL;
ALTER TABLE public.friendships REPLICA IDENTITY FULL;
ALTER TABLE public.server_members REPLICA IDENTITY FULL;