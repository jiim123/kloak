-- Update toggle_pin_message to use permission check function
CREATE OR REPLACE FUNCTION public.toggle_pin_message(_message_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_id uuid;
  result json;
BEGIN
  -- Get the channel_id from the message
  SELECT m.channel_id INTO channel_id
  FROM messages m
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'pin_messages') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Toggle pin status
  UPDATE messages SET is_pinned = NOT is_pinned WHERE id = _message_id;
  
  -- Return updated message
  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'is_pinned', m.is_pinned,
    'edited_at', m.edited_at,
    'created_at', m.created_at
  ) INTO result
  FROM messages m
  WHERE m.id = _message_id;
  
  RETURN result;
END;
$$;
