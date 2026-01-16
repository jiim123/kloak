-- Fix add_reaction function to use correct table name (reactions, not message_reactions)
CREATE OR REPLACE FUNCTION public.add_reaction(
  _message_id uuid,
  _user_id uuid,
  _emoji text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_id uuid;
  channel_server_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  -- Get the channel_id from the message
  SELECT m.channel_id, c.server_id INTO channel_id, channel_server_id
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'You do not have permission to add reactions in this channel';
  END IF;
  
  -- Check if reaction already exists
  IF EXISTS (
    SELECT 1 FROM reactions
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji
  ) THEN
    -- Reaction already exists, return existing
    SELECT json_build_object(
      'id', r.id,
      'message_id', r.message_id,
      'user_id', r.user_id,
      'emoji', r.emoji,
      'created_at', r.created_at
    ) INTO result
    FROM reactions r
    WHERE r.message_id = _message_id AND r.user_id = _user_id AND r.emoji = _emoji
    LIMIT 1;
    
    RETURN result;
  END IF;
  
  -- Insert new reaction
  INSERT INTO reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  RETURNING id INTO new_reaction_id;
  
  -- Return the reaction
  SELECT json_build_object(
    'id', r.id,
    'message_id', r.message_id,
    'user_id', r.user_id,
    'emoji', r.emoji,
    'created_at', r.created_at
  ) INTO result
  FROM reactions r
  WHERE r.id = new_reaction_id;
  
  RETURN result;
END;
$$;

-- Also update remove_reaction to ensure it's correct
CREATE OR REPLACE FUNCTION public.remove_reaction(
  _message_id uuid,
  _user_id uuid,
  _emoji text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_id uuid;
BEGIN
  -- Get the channel_id from the message
  SELECT m.channel_id INTO channel_id
  FROM messages m
  WHERE m.id = _message_id;
  
  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'You do not have permission to remove reactions in this channel';
  END IF;
  
  DELETE FROM reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;

-- Ensure send_message function uses the latest permission check
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
  user_role server_role;
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
  
  -- Check send_messages permission using the permission check function
  -- This will check channel overrides first, then role permissions
  IF NOT public.check_user_permission(_user_id, _channel_id, 'send_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send messages in this channel';
  END IF;
  
  -- Check read-only channel permission - need manage_messages to post in read-only
  IF channel_is_read_only = true THEN
    IF NOT public.check_user_permission(_user_id, _channel_id, 'manage_messages') THEN
      RAISE EXCEPTION 'This channel is read-only';
    END IF;
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
