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

  IF EXISTS (
    SELECT 1
    FROM friendships f
    WHERE f.status = 'blocked'
      AND ((f.requester_id = _user_id AND f.addressee_id = _other_user_id)
        OR (f.requester_id = _other_user_id AND f.addressee_id = _user_id))
  ) THEN
    RAISE EXCEPTION 'Cannot message this user';
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

CREATE OR REPLACE FUNCTION public.send_dm(_conversation_id uuid, _sender_id uuid, _content text, _reply_to_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_message_id uuid;
  other_user_id uuid;
  result json;
BEGIN
  -- Verify user is a participant
  IF NOT EXISTS (
    SELECT 1 FROM dm_participants
    WHERE conversation_id = _conversation_id AND user_id = _sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  SELECT dp.user_id INTO other_user_id
  FROM dm_participants dp
  WHERE dp.conversation_id = _conversation_id
    AND dp.user_id <> _sender_id
  LIMIT 1;

  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Conversation has no recipient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM friendships f
    WHERE f.status = 'blocked'
      AND ((f.requester_id = _sender_id AND f.addressee_id = other_user_id)
        OR (f.requester_id = other_user_id AND f.addressee_id = _sender_id))
  ) THEN
    RAISE EXCEPTION 'Cannot send DM to this user';
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
        AND NOT EXISTS (
          SELECT 1
          FROM friendships f
          WHERE f.status = 'blocked'
            AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
              OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id))
        )
      ORDER BY dm.created_at DESC
      LIMIT _limit
    ) sub
  );
END;
$$;

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
        AND NOT EXISTS (
          SELECT 1
          FROM friendships f
          WHERE f.status = 'blocked'
            AND ((f.requester_id = _user_id AND f.addressee_id = m.user_id)
              OR (f.requester_id = m.user_id AND f.addressee_id = _user_id))
        )
      ORDER BY m.created_at DESC
      LIMIT _limit
    ) sub
  );
END;
$$;

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
            AND NOT EXISTS (
              SELECT 1
              FROM friendships f
              WHERE f.status = 'blocked'
                AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
                  OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id))
            )
          ORDER BY dm.created_at DESC
          LIMIT 1
        )
      ) as conv
      FROM dm_conversations dc
      WHERE EXISTS (
        SELECT 1 FROM dm_participants dp
        WHERE dp.conversation_id = dc.id AND dp.user_id = _user_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM dm_participants dp_other
        WHERE dp_other.conversation_id = dc.id
          AND dp_other.user_id <> _user_id
          AND EXISTS (
            SELECT 1
            FROM friendships f
            WHERE f.status = 'blocked'
              AND ((f.requester_id = _user_id AND f.addressee_id = dp_other.user_id)
                OR (f.requester_id = dp_other.user_id AND f.addressee_id = _user_id))
          )
      )
      ORDER BY (
        SELECT MAX(dm.created_at)
        FROM direct_messages dm
        WHERE dm.conversation_id = dc.id
          AND NOT EXISTS (
            SELECT 1
            FROM friendships f
            WHERE f.status = 'blocked'
              AND ((f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
                OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id))
          )
      ) DESC NULLS LAST
    ) sub
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_blocked_user_ids_for_visibility(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(x.other_user_id)
      FROM (
        SELECT DISTINCT
          CASE
            WHEN f.requester_id = _user_id THEN f.addressee_id
            ELSE f.requester_id
          END AS other_user_id
        FROM friendships f
        WHERE f.status = 'blocked'
          AND (f.requester_id = _user_id OR f.addressee_id = _user_id)
      ) x
    ),
    '[]'::json
  );
END;
$$;
