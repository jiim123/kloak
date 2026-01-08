-- Update the trigger function to include message_id in the notification link
CREATE OR REPLACE FUNCTION public.trigger_mention_notification()
RETURNS TRIGGER AS $$
DECLARE
  channel_server_id uuid;
  channel_name text;
  channel_id uuid;
  sender_username text;
  message_id uuid;
BEGIN
  -- Get message_id
  message_id := NEW.message_id;
  
  -- Get channel info
  SELECT c.server_id, c.name, c.id INTO channel_server_id, channel_name, channel_id
  FROM channels c
  JOIN messages m ON m.channel_id = c.id
  WHERE m.id = NEW.message_id;
  
  -- Get sender username
  SELECT u.username INTO sender_username
  FROM messages m
  JOIN users u ON u.id = m.user_id
  WHERE m.id = NEW.message_id;
  
  -- Create notification for the mentioned user with full link including message_id
  PERFORM public.create_notification(
    NEW.user_id,
    'mention'::notification_type,
    'You were mentioned',
    sender_username || ' mentioned you in #' || COALESCE(channel_name, 'channel'),
    '/app?server=' || channel_server_id || '&channel=' || channel_id || '&message=' || message_id
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;