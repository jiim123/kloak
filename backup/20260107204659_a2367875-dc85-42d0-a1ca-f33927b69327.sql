-- Fix: notifications_public_insert
-- Drop the overly permissive INSERT policy
DROP POLICY IF EXISTS "System can create notifications" ON notifications;

-- Create a helper function to create notifications (SECURITY DEFINER allows trigger to bypass RLS)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type notification_type,
  _title text,
  _body text DEFAULT NULL,
  _link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (_user_id, _type, _title, _body, _link)
  RETURNING id INTO notification_id;
  RETURN notification_id;
END;
$$;

-- Create trigger function for mention notifications
CREATE OR REPLACE FUNCTION public.trigger_mention_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  channel_name text;
  sender_username text;
BEGIN
  -- Get channel info
  SELECT c.server_id, c.name INTO channel_server_id, channel_name
  FROM channels c
  JOIN messages m ON m.channel_id = c.id
  WHERE m.id = NEW.message_id;
  
  -- Get sender username
  SELECT u.username INTO sender_username
  FROM messages m
  JOIN users u ON u.id = m.user_id
  WHERE m.id = NEW.message_id;
  
  -- Create notification for the mentioned user
  PERFORM public.create_notification(
    NEW.user_id,
    'mention'::notification_type,
    'You were mentioned',
    sender_username || ' mentioned you in #' || COALESCE(channel_name, 'channel'),
    '/app'
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for mentions
DROP TRIGGER IF EXISTS mention_notification_trigger ON mentions;
CREATE TRIGGER mention_notification_trigger
AFTER INSERT ON mentions
FOR EACH ROW
EXECUTE FUNCTION public.trigger_mention_notification();

-- Create trigger function for friend request notifications
CREATE OR REPLACE FUNCTION public.trigger_friendship_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requester_username text;
BEGIN
  -- Only trigger on new pending friend requests
  IF NEW.status = 'pending' THEN
    -- Get requester username
    SELECT username INTO requester_username
    FROM users WHERE id = NEW.requester_id;
    
    -- Notify the addressee about the friend request
    PERFORM public.create_notification(
      NEW.addressee_id,
      'friend_request'::notification_type,
      'Friend Request',
      requester_username || ' sent you a friend request',
      '/app'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for friend requests
DROP TRIGGER IF EXISTS friendship_notification_trigger ON friendships;
CREATE TRIGGER friendship_notification_trigger
AFTER INSERT ON friendships
FOR EACH ROW
EXECUTE FUNCTION public.trigger_friendship_notification();

-- Create trigger function for DM notifications
CREATE OR REPLACE FUNCTION public.trigger_dm_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_username text;
  recipient_id uuid;
BEGIN
  -- Get sender username
  SELECT username INTO sender_username
  FROM users WHERE id = NEW.sender_id;
  
  -- Find the other participant(s) in the conversation
  FOR recipient_id IN
    SELECT user_id FROM dm_participants
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id
  LOOP
    PERFORM public.create_notification(
      recipient_id,
      'dm'::notification_type,
      'New Message',
      sender_username || ' sent you a message',
      '/app'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for direct messages
DROP TRIGGER IF EXISTS dm_notification_trigger ON direct_messages;
CREATE TRIGGER dm_notification_trigger
AFTER INSERT ON direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.trigger_dm_notification();