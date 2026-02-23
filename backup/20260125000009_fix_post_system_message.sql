-- Fix post_system_message to properly set is_system_message flag
CREATE OR REPLACE FUNCTION public.post_system_message(
  _channel_id UUID,
  _user_id UUID,
  _content TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _message_id UUID;
BEGIN
  -- Insert system message as if from the user (so it shows their profile picture and username)
  -- Set is_system_message = TRUE to mark it as a system message
  INSERT INTO messages (channel_id, user_id, content, is_system_message)
  VALUES (_channel_id, _user_id, _content, TRUE)
  RETURNING id INTO _message_id;
  
  RETURN _message_id;
END;
$$;
