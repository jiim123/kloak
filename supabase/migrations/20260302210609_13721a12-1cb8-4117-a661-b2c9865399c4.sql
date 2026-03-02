-- Add server_members to the realtime publication so kick/ban events are broadcast
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_members;