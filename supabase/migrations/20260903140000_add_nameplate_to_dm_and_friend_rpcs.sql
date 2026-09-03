-- Include `nameplate` in get_user_dm_conversations user objects
-- so the DM sidebar can render nameplate backgrounds for conversations.
CREATE OR REPLACE FUNCTION public.get_user_dm_conversations(_user_id uuid)
RETURNS TABLE(conversation json, participants json, last_message json)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  SELECT
    json_build_object(
      'id', c.id,
      'created_at', c.created_at,
      'is_group', c.is_group,
      'name', c.name,
      'created_by', c.created_by
    ) as conversation,
    (
      SELECT json_agg(
        json_build_object(
          'user_id', dp2.user_id,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'avatar_decoration', u.avatar_decoration,
            'status', u.status,
            'custom_status', u.custom_status,
            'banner_color', u.banner_color,
            'nameplate', u.nameplate,
            'last_seen', CASE WHEN u.id = _user_id THEN u.last_seen ELSE NULL END
          )
        )
      )
      FROM dm_participants dp2
      JOIN users u ON u.id = dp2.user_id
      WHERE dp2.conversation_id = c.id
    ) as participants,
    (
      SELECT json_build_object(
        'id', dm.id,
        'content', dm.content,
        'created_at', dm.created_at,
        'sender_id', dm.sender_id
      )
      FROM direct_messages dm
      WHERE dm.conversation_id = c.id
      ORDER BY dm.created_at DESC
      LIMIT 1
    ) as last_message
  FROM dm_conversations c
  JOIN dm_participants dp ON dp.conversation_id = c.id
  WHERE dp.user_id = _user_id
  ORDER BY (
    SELECT MAX(dm.created_at)
    FROM direct_messages dm
    WHERE dm.conversation_id = c.id
  ) DESC NULLS LAST;
END;
$$;


-- Include `nameplate` in get_friend_dashboard user objects
-- so the friends list can render nameplate backgrounds.
CREATE OR REPLACE FUNCTION public.get_friend_dashboard(_user_id uuid)
RETURNS json
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  _friends json;
  _pending json;
  _outgoing json;
  _blocked json;
  _visibility_blocked json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Friends (accepted)
  SELECT json_agg(friend) INTO _friends
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', CASE
        WHEN f.requester_id = _user_id THEN (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status, 'nameplate', u.nameplate) FROM users u WHERE u.id = f.addressee_id)
        ELSE (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'custom_status', u.custom_status, 'nameplate', u.nameplate) FROM users u WHERE u.id = f.requester_id)
      END
    ) AS friend
    FROM friendships f
    WHERE (f.requester_id = _user_id OR f.addressee_id = _user_id) AND f.status = 'accepted'
  ) sub;

  -- Pending (incoming)
  SELECT json_agg(request) INTO _pending
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'nameplate', u.nameplate) FROM users u WHERE u.id = f.requester_id)
    ) AS request
    FROM friendships f
    WHERE f.addressee_id = _user_id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  ) sub;

  -- Outgoing
  SELECT json_agg(request) INTO _outgoing
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'status', f.status,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status, 'nameplate', u.nameplate) FROM users u WHERE u.id = f.addressee_id)
    ) AS request
    FROM friendships f
    WHERE f.requester_id = _user_id AND f.status = 'pending'
    ORDER BY f.created_at DESC
  ) sub;

  -- Blocked
  SELECT json_agg(blocked) INTO _blocked
  FROM (
    SELECT json_build_object(
      'id', f.id,
      'created_at', f.created_at,
      'user', (SELECT json_build_object('id', u.id, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url, 'banner_color', u.banner_color) FROM users u WHERE u.id = f.addressee_id)
    ) AS blocked
    FROM friendships f
    WHERE f.requester_id = _user_id AND f.status = 'blocked'
  ) sub;

  -- Visibility blocked IDs
  SELECT COALESCE(json_agg(x.other_user_id), '[]'::json) INTO _visibility_blocked
  FROM (
    SELECT DISTINCT CASE WHEN f.requester_id = _user_id THEN f.addressee_id ELSE f.requester_id END AS other_user_id
    FROM friendships f
    WHERE f.status = 'blocked' AND (f.requester_id = _user_id OR f.addressee_id = _user_id)
  ) x;

  RETURN json_build_object(
    'friends', COALESCE(_friends, '[]'::json),
    'pending_requests', COALESCE(_pending, '[]'::json),
    'outgoing_requests', COALESCE(_outgoing, '[]'::json),
    'blocked_users', COALESCE(_blocked, '[]'::json),
    'visibility_blocked_user_ids', COALESCE(_visibility_blocked, '[]'::json)
  );
END;
$$;
