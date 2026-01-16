-- Update add_reaction to use permission check function
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
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Check if reaction already exists
  IF EXISTS (
    SELECT 1 FROM message_reactions
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji
  ) THEN
    -- Reaction already exists, return existing
    SELECT json_build_object(
      'id', mr.id,
      'message_id', mr.message_id,
      'user_id', mr.user_id,
      'emoji', mr.emoji,
      'created_at', mr.created_at
    ) INTO result
    FROM message_reactions mr
    WHERE mr.message_id = _message_id AND mr.user_id = _user_id AND mr.emoji = _emoji
    LIMIT 1;
    
    RETURN result;
  END IF;
  
  -- Insert new reaction
  INSERT INTO message_reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  RETURNING id INTO new_reaction_id;
  
  -- Return the reaction
  SELECT json_build_object(
    'id', mr.id,
    'message_id', mr.message_id,
    'user_id', mr.user_id,
    'emoji', mr.emoji,
    'created_at', mr.created_at
  ) INTO result
  FROM message_reactions mr
  WHERE mr.id = new_reaction_id;
  
  RETURN result;
END;
$$;
