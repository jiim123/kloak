-- Message Operations RPC Functions

-- Send message
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
  is_muted boolean;
  new_message_id uuid;
  result json;
BEGIN
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  SELECT sm.is_muted INTO is_muted FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;
  
  INSERT INTO messages (channel_id, user_id, content, reply_to_id)
  VALUES (_channel_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;
  
  SELECT json_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned,
    'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = new_message_id;
  
  RETURN result;
END;
$$;

-- Edit message
CREATE OR REPLACE FUNCTION public.edit_message(
  _message_id uuid,
  _user_id uuid,
  _content text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only author can edit their message
  IF NOT EXISTS (SELECT 1 FROM messages WHERE id = _message_id AND user_id = _user_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE messages SET content = _content, edited_at = now() WHERE id = _message_id;
  
  SELECT json_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'reply_to_id', m.reply_to_id, 'is_pinned', m.is_pinned,
    'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = _message_id;
  
  RETURN result;
END;
$$;

-- Delete message
CREATE OR REPLACE FUNCTION public.delete_message(_message_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_user_id uuid;
  channel_server_id uuid;
  user_role text;
BEGIN
  SELECT m.user_id, c.server_id INTO msg_user_id, channel_server_id
  FROM messages m JOIN channels c ON c.id = m.channel_id
  WHERE m.id = _message_id;
  
  -- Author can always delete their own messages
  IF msg_user_id = _user_id THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  -- Admins/mods can delete any message
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false;
  
  IF user_role IN ('owner', 'admin', 'moderator') THEN
    DELETE FROM messages WHERE id = _message_id;
    RETURN true;
  END IF;
  
  RAISE EXCEPTION 'Permission denied';
END;
$$;

-- Pin/unpin message
CREATE OR REPLACE FUNCTION public.toggle_pin_message(_message_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  result json;
BEGIN
  SELECT c.server_id INTO channel_server_id
  FROM messages m JOIN channels c ON c.id = m.channel_id
  WHERE m.id = _message_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
    AND role IN ('owner', 'admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  UPDATE messages SET is_pinned = NOT is_pinned WHERE id = _message_id;
  
  SELECT json_build_object(
    'id', m.id, 'channel_id', m.channel_id, 'user_id', m.user_id,
    'content', m.content, 'is_pinned', m.is_pinned, 'edited_at', m.edited_at, 'created_at', m.created_at
  ) INTO result FROM messages m WHERE m.id = _message_id;
  
  RETURN result;
END;
$$;

-- Reaction Operations

-- Add reaction
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
  channel_server_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  SELECT c.server_id INTO channel_server_id
  FROM messages m JOIN channels c ON c.id = m.channel_id
  WHERE m.id = _message_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
  ) THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  INSERT INTO reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  ON CONFLICT (message_id, user_id, emoji) DO NOTHING
  RETURNING id INTO new_reaction_id;
  
  IF new_reaction_id IS NULL THEN
    SELECT id INTO new_reaction_id FROM reactions 
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  END IF;
  
  SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji)
  INTO result FROM reactions r WHERE r.id = new_reaction_id;
  
  RETURN result;
END;
$$;

-- Remove reaction
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
BEGIN
  DELETE FROM reactions WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji;
  RETURN true;
END;
$$;

-- Get messages for a channel
CREATE OR REPLACE FUNCTION public.get_channel_messages(
  _channel_id uuid,
  _user_id uuid,
  _limit int DEFAULT 50,
  _before_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
BEGIN
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  IF NOT EXISTS (
    SELECT 1 FROM server_members 
    WHERE server_id = channel_server_id AND user_id = _user_id AND is_banned = false
  ) THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  RETURN (
    SELECT json_agg(msg ORDER BY msg.created_at DESC)
    FROM (
      SELECT json_build_object(
        'id', m.id,
        'channel_id', m.channel_id,
        'user_id', m.user_id,
        'content', m.content,
        'reply_to_id', m.reply_to_id,
        'is_pinned', m.is_pinned,
        'edited_at', m.edited_at,
        'created_at', m.created_at,
        'user', json_build_object(
          'id', u.id, 'username', u.username, 'display_name', u.display_name,
          'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
        )
      ) as msg, m.created_at
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.channel_id = _channel_id
      AND (_before_id IS NULL OR m.created_at < (SELECT created_at FROM messages WHERE id = _before_id))
      ORDER BY m.created_at DESC
      LIMIT _limit
    ) sub
  );
END;
$$;