-- Update send_message RPC to enforce read-only channel restrictions
CREATE OR REPLACE FUNCTION public.send_message(
  _channel_id uuid,
  _user_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  channel_is_read_only boolean;
  is_muted boolean;
  user_role text;
  new_message_id uuid;
  result json;
BEGIN
  -- Get channel info including read-only status
  SELECT server_id, is_read_only INTO channel_server_id, channel_is_read_only 
  FROM channels WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  -- Check membership and get role
  SELECT sm.is_muted, sm.role INTO is_muted, user_role 
  FROM server_members sm
  WHERE sm.server_id = channel_server_id 
    AND sm.user_id = _user_id 
    AND sm.is_banned = false;
  
  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;
  
  -- Check read-only channel permission - only owner, admin, moderator can post
  IF channel_is_read_only = true AND user_role NOT IN ('owner', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'This channel is read-only';
  END IF;
  
  -- Insert the message
  INSERT INTO messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;
  
  SELECT json_build_object(
    'id', m.id,
    'channel_id', m.channel_id,
    'user_id', m.user_id,
    'content', m.content,
    'reply_to_id', m.reply_to_id,
    'is_pinned', m.is_pinned,
    'edited_at', m.edited_at,
    'created_at', m.created_at
  ) INTO result
  FROM messages m WHERE m.id = new_message_id;
  
  RETURN result;
END;
$$;