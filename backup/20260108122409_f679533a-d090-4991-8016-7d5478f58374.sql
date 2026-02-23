-- Enable REPLICA IDENTITY FULL on tables that need realtime updates
-- This ensures complete row data is available for UPDATE and DELETE events

ALTER TABLE public.channels REPLICA IDENTITY FULL;
ALTER TABLE public.channel_categories REPLICA IDENTITY FULL;
ALTER TABLE public.servers REPLICA IDENTITY FULL;

-- Add channels and channel_categories to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_categories;