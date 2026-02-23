-- Thread Operations RPC Functions

-- Create thread from a message
CREATE OR REPLACE FUNCTION public.create_thread(
  _message_id uuid,
  _user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  message_channel_id uuid;
  message_user_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  new_thread_id uuid;
BEGIN
  -- Get message details
  SELECT channel_id, user_id INTO message_channel_id, message_user_id
  FROM messages
  WHERE id = _message_id;

  IF message_channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Verify the user is the message author or has permission
  IF message_user_id != _user_id THEN
    -- Check if user has permission to create threads (could be extended for moderation)
    SELECT server_id INTO channel_server_id
    FROM channels
    WHERE id = message_channel_id;

    SELECT sm.is_muted INTO is_muted
    FROM server_members sm
    WHERE sm.server_id = channel_server_id
      AND sm.user_id = _user_id
      AND sm.is_banned = false;

    IF is_muted IS NULL THEN
      RAISE EXCEPTION 'Not a member of this server';
    END IF;
  END IF;

  -- Check if thread already exists for this message
  SELECT id INTO new_thread_id
  FROM threads
  WHERE message_id = _message_id;

  IF new_thread_id IS NOT NULL THEN
    RETURN new_thread_id;
  END IF;

  -- Create the thread
  INSERT INTO threads (channel_id, message_id, created_by)
  VALUES (message_channel_id, _message_id, _user_id)
  RETURNING id INTO new_thread_id;

  RETURN new_thread_id;
END;
$$;

-- Send message to a thread
CREATE OR REPLACE FUNCTION public.send_thread_message(
  _thread_id uuid,
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
  thread_channel_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  new_message_id uuid;
  result json;
BEGIN
  -- Get thread's channel
  SELECT channel_id INTO thread_channel_id
  FROM threads
  WHERE id = _thread_id;

  IF thread_channel_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = thread_channel_id;

  -- Check membership and muted status
  SELECT sm.is_muted INTO is_muted
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

  -- Insert thread message
  INSERT INTO thread_messages (thread_id, user_id, content, reply_to_id)
  VALUES (_thread_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;

  -- Return the message
  SELECT json_build_object(
    'id', tm.id,
    'thread_id', tm.thread_id,
    'user_id', tm.user_id,
    'content', tm.content,
    'reply_to_id', tm.reply_to_id,
    'edited_at', tm.edited_at,
    'created_at', tm.created_at
  ) INTO result
  FROM thread_messages tm
  WHERE tm.id = new_message_id;

  RETURN result;
END;
$$;

-- Get thread messages
CREATE OR REPLACE FUNCTION public.get_thread_messages(
  _thread_id uuid,
  _limit integer DEFAULT 50,
  _before text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  WITH ordered_messages AS (
    SELECT tm.*
    FROM thread_messages tm
    WHERE tm.thread_id = _thread_id
      AND (_before IS NULL OR tm.created_at < _before::timestamptz)
    ORDER BY tm.created_at DESC
    LIMIT _limit
  )
  SELECT json_agg(
    json_build_object(
      'id', om.id,
      'thread_id', om.thread_id,
      'user_id', om.user_id,
      'content', om.content,
      'reply_to_id', om.reply_to_id,
      'edited_at', om.edited_at,
      'created_at', om.created_at,
      'user', (
        SELECT json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url,
          'avatar_decoration', u.avatar_decoration,
          'profile_effect', u.profile_effect,
          'banner_color', u.banner_color,
          'banner_url', u.banner_url,
          'profile_theme_primary', u.profile_theme_primary,
          'profile_theme_accent', u.profile_theme_accent,
          'bio', u.bio,
          'status', u.status,
          'custom_status', u.custom_status
        )
        FROM users u
        WHERE u.id = om.user_id
      )
    )
    ORDER BY om.created_at ASC
  ) INTO result
  FROM ordered_messages om;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Get thread message count
CREATE OR REPLACE FUNCTION public.get_thread_message_count(
  _message_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  thread_id_val uuid;
  message_count integer;
BEGIN
  -- Get thread ID from message
  SELECT id INTO thread_id_val
  FROM threads
  WHERE message_id = _message_id;

  IF thread_id_val IS NULL THEN
    RETURN 0;
  END IF;

  -- Count messages in thread
  SELECT COUNT(*) INTO message_count
  FROM thread_messages
  WHERE thread_id = thread_id_val;

  RETURN message_count;
END;
$$;

-- Get thread info by message ID
CREATE OR REPLACE FUNCTION public.get_thread_info(
  _message_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', t.id,
    'channel_id', t.channel_id,
    'message_id', t.message_id,
    'created_by', t.created_by,
    'created_at', t.created_at,
    'message_count', (
      SELECT COUNT(*)
      FROM thread_messages
      WHERE thread_id = t.id
    )
  ) INTO result
  FROM threads t
  WHERE t.message_id = _message_id;

  RETURN result;
END;
$$;

-- Get thread by message ID
CREATE OR REPLACE FUNCTION public.get_thread_by_message_id(
  _message_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT row_to_json(t) INTO result
  FROM threads t
  WHERE t.message_id = _message_id;

  RETURN result;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_thread(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_thread_message(uuid, uuid, text, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_messages(uuid, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_message_count(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_info(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_thread_by_message_id(uuid) TO anon, authenticated;
