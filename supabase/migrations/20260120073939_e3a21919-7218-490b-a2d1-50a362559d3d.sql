-- Update the DM notification trigger to include conversation_id in the link
CREATE OR REPLACE FUNCTION public.trigger_dm_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  sender_username text;
  recipient_id uuid;
BEGIN
  -- Get sender username
  SELECT username INTO sender_username FROM users WHERE id = NEW.sender_id;
  
  -- Get recipient (the other participant in the conversation)
  SELECT user_id INTO recipient_id 
  FROM dm_participants 
  WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LIMIT 1;
  
  -- Create notification for recipient with conversation_id in link
  IF recipient_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      recipient_id,
      'dm',
      'New message from ' || sender_username,
      LEFT(NEW.content, 100),
      '/app?conversation=' || NEW.conversation_id::text
    );
  END IF;
  
  RETURN NEW;
END;
$function$;