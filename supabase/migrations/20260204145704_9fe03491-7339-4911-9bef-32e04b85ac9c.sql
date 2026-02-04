-- Enable full replica identity for filtered subscriptions
ALTER TABLE dm_participants REPLICA IDENTITY FULL;
ALTER TABLE dm_conversations REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE dm_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE dm_conversations;