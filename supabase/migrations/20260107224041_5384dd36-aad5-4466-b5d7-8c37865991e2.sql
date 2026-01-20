-- Create RPC function to send a direct message
CREATE OR REPLACE FUNCTION public.send_dm(_conversation_id uuid, _sender_id uuid, _content text, _reply_to_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_message_id uuid;
  result json;
BEGIN
  -- Verify user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM dm_participants 
    WHERE conversation_id = _conversation_id AND user_id = _sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  
  INSERT INTO direct_messages (conversation_id, sender_id, content, reply_to_id)
  VALUES (_conversation_id, _sender_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;
  
  SELECT json_build_object(
    'id', dm.id,
    'conversation_id', dm.conversation_id,
    'sender_id', dm.sender_id,
    'content', dm.content,
    'reply_to_id', dm.reply_to_id,
    'edited_at', dm.edited_at,
    'created_at', dm.created_at
  ) INTO result FROM direct_messages dm WHERE dm.id = new_message_id;
  
  RETURN result;
END;
$$;

-- Create RPC function to edit a direct message
CREATE OR REPLACE FUNCTION public.edit_dm(_message_id uuid, _sender_id uuid, _content text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only sender can edit their message
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE direct_messages SET content = _content, edited_at = now() WHERE id = _message_id;
  
  SELECT json_build_object(
    'id', dm.id,
    'conversation_id', dm.conversation_id,
    'sender_id', dm.sender_id,
    'content', dm.content,
    'reply_to_id', dm.reply_to_id,
    'edited_at', dm.edited_at,
    'created_at', dm.created_at
  ) INTO result FROM direct_messages dm WHERE dm.id = _message_id;
  
  RETURN result;
END;
$$;

-- Create RPC function to delete a direct message
CREATE OR REPLACE FUNCTION public.delete_dm(_message_id uuid, _sender_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only sender can delete their message
  IF NOT EXISTS (SELECT 1 FROM direct_messages WHERE id = _message_id AND sender_id = _sender_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM direct_messages WHERE id = _message_id;
  RETURN true;
END;
$$;

-- Create RPC function to add a DM reaction
CREATE OR REPLACE FUNCTION public.add_dm_reaction(_message_id uuid, _user_id uuid, _emoji text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_conversation_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  SELECT conversation_id INTO msg_conversation_id FROM direct_messages WHERE id = _message_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM dm_participants 
    WHERE conversation_id = msg_conversation_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  
  INSERT INTO dm_reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  ON CONFLICT (message_id, user_id, emoji) DO NOTHING
  RETURNING id INTO new_reaction_id;
  
  IF new_reaction_id IS NULL THEN
    SELECT id INTO new_reaction_id FROM dm_reactions 
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  END IF;
  
  SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji)
  INTO result FROM dm_reactions r WHERE r.id = new_reaction_id;
  
  RETURN result;
END;
$$;

-- Create RPC function to remove a DM reaction
CREATE OR REPLACE FUNCTION public.remove_dm_reaction(_message_id uuid, _user_id uuid, _emoji text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM dm_reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;

-- Create RPC function to get DM messages
CREATE OR REPLACE FUNCTION public.get_dm_messages(_conversation_id uuid, _user_id uuid, _limit integer DEFAULT 50, _before_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM dm_participants 
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;
  
  RETURN (
    SELECT json_agg(msg ORDER BY created_at DESC)
    FROM (
      SELECT json_build_object(
        'id', dm.id,
        'conversation_id', dm.conversation_id,
        'sender_id', dm.sender_id,
        'content', dm.content,
        'reply_to_id', dm.reply_to_id,
        'edited_at', dm.edited_at,
        'created_at', dm.created_at,
        'sender', json_build_object(
          'id', u.id, 'username', u.username, 'display_name', u.display_name,
          'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
        )
      ) as msg, dm.created_at
      FROM direct_messages dm
      JOIN users u ON u.id = dm.sender_id
      WHERE dm.conversation_id = _conversation_id
      AND (_before_id IS NULL OR dm.created_at < (SELECT created_at FROM direct_messages WHERE id = _before_id))
      ORDER BY dm.created_at DESC
      LIMIT _limit
    ) sub
  );
END;
$$;

-- Create RPC function to open or create a DM conversation
CREATE OR REPLACE FUNCTION public.open_dm_conversation(_user_id uuid, _other_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_conversation_id uuid;
  new_conversation_id uuid;
  result json;
BEGIN
  -- Check if conversation already exists
  SELECT dp1.conversation_id INTO existing_conversation_id
  FROM dm_participants dp1
  JOIN dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
  WHERE dp1.user_id = _user_id AND dp2.user_id = _other_user_id;
  
  IF existing_conversation_id IS NOT NULL THEN
    SELECT json_build_object(
      'id', dc.id,
      'created_at', dc.created_at
    ) INTO result FROM dm_conversations dc WHERE dc.id = existing_conversation_id;
    RETURN result;
  END IF;
  
  -- Create new conversation
  INSERT INTO dm_conversations DEFAULT VALUES
  RETURNING id INTO new_conversation_id;
  
  -- Add both participants
  INSERT INTO dm_participants (conversation_id, user_id) VALUES
    (new_conversation_id, _user_id),
    (new_conversation_id, _other_user_id);
  
  SELECT json_build_object(
    'id', dc.id,
    'created_at', dc.created_at
  ) INTO result FROM dm_conversations dc WHERE dc.id = new_conversation_id;
  
  RETURN result;
END;
$$;

-- Create RPC function to get user's DM conversations
CREATE OR REPLACE FUNCTION public.get_user_dm_conversations(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(conv)
    FROM (
      SELECT json_build_object(
        'id', dc.id,
        'created_at', dc.created_at,
        'participants', (
          SELECT json_agg(json_build_object(
            'user_id', dp.user_id,
            'last_read_at', dp.last_read_at,
            'user', json_build_object(
              'id', u.id, 'username', u.username, 'display_name', u.display_name,
              'avatar_url', u.avatar_url, 'status', u.status
            )
          ))
          FROM dm_participants dp
          JOIN users u ON u.id = dp.user_id
          WHERE dp.conversation_id = dc.id
        ),
        'last_message', (
          SELECT json_build_object(
            'id', dm.id, 'content', dm.content, 'sender_id', dm.sender_id, 'created_at', dm.created_at
          )
          FROM direct_messages dm
          WHERE dm.conversation_id = dc.id
          ORDER BY dm.created_at DESC
          LIMIT 1
        )
      ) as conv
      FROM dm_conversations dc
      WHERE EXISTS (
        SELECT 1 FROM dm_participants dp 
        WHERE dp.conversation_id = dc.id AND dp.user_id = _user_id
      )
      ORDER BY (
        SELECT MAX(dm.created_at) FROM direct_messages dm WHERE dm.conversation_id = dc.id
      ) DESC NULLS LAST
    ) sub
  );
END;
$$;

-- Create RPC function to mark DM conversation as read
CREATE OR REPLACE FUNCTION public.mark_dm_read(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE dm_participants 
  SET last_read_at = now()
  WHERE conversation_id = _conversation_id AND user_id = _user_id;
  
  RETURN true;
END;
$$;