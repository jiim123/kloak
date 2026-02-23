-- Fix 1: search_messages - replace auth.uid() with requesting_user_id()
CREATE OR REPLACE FUNCTION public.search_messages(
  search_query text,
  server_filter uuid DEFAULT NULL,
  channel_filter uuid DEFAULT NULL,
  user_filter uuid DEFAULT NULL,
  result_limit integer DEFAULT 50
)
RETURNS TABLE(
  message_id uuid,
  channel_id uuid,
  user_id uuid,
  content text,
  created_at timestamptz,
  rank real
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _current_user_id uuid;
BEGIN
  _current_user_id := public.requesting_user_id();

  IF _current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is member of the server if filtering by server
  IF server_filter IS NOT NULL THEN
    IF NOT public.is_server_member(server_filter, _current_user_id) THEN
      RAISE EXCEPTION 'Access denied: not a member of this server';
    END IF;
  END IF;

  -- Only return messages from servers the user is a member of
  RETURN QUERY
  SELECT
    m.id AS message_id,
    m.channel_id,
    m.user_id,
    m.content,
    m.created_at,
    ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', search_query)) AS rank
  FROM public.messages m
  JOIN public.channels c ON m.channel_id = c.id
  WHERE
    to_tsvector('english', m.content) @@ plainto_tsquery('english', search_query)
    AND (server_filter IS NULL OR c.server_id = server_filter)
    AND (channel_filter IS NULL OR m.channel_id = channel_filter)
    AND (user_filter IS NULL OR m.user_id = user_filter)
    AND public.is_server_member(c.server_id, _current_user_id)
  ORDER BY rank DESC, m.created_at DESC
  LIMIT result_limit;
END;
$$;

-- Fix 2: get_server_members - hide last_seen for non-owners (privacy)
-- Only the user themselves can see their own last_seen
CREATE OR REPLACE FUNCTION public.get_server_members(
  _server_id uuid,
  _user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _requesting_user_id uuid;
BEGIN
  _requesting_user_id := public.requesting_user_id();

  -- Identity verification if _user_id is provided
  IF _user_id IS NOT NULL AND NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', sm.join_invite_code,
          'user', json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_url', u.banner_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status,
            'created_at', u.created_at,
            -- Only expose last_seen to the user themselves
            'last_seen', CASE WHEN u.id = _requesting_user_id THEN u.last_seen ELSE NULL END
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'name', sr.name,
                  'color', sr.color,
                  'position', sr.position
                ) ORDER BY sr.position ASC
              )
              FROM server_member_roles smr
              JOIN server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM server_members sm
      JOIN users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND (sm.is_banned IS NULL OR sm.is_banned = false)
    ),
    '[]'::json
  );
END;
$$;

-- Fix 3: get_user_dm_conversations - hide last_seen for non-self participants
CREATE OR REPLACE FUNCTION public.get_user_dm_conversations(_user_id uuid)
RETURNS TABLE(
  conversation json,
  participants json,
  last_message json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
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
            -- Only expose last_seen to the user themselves
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

-- Fix 4: Add SET search_path to key security functions that were missing it
CREATE OR REPLACE FUNCTION public.verify_request_identity(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  header_hash text;
  stored_hash text;
BEGIN
  BEGIN
    header_hash := (current_setting('request.headers', true)::json->>'x-key-hash');
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  IF header_hash IS NULL OR header_hash = '' THEN
    RETURN false;
  END IF;

  SELECT ua.key_hash INTO stored_hash FROM user_auth ua WHERE ua.user_id = _user_id;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  RETURN header_hash = stored_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_request_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key_hash text;
  _user_id uuid;
BEGIN
  _key_hash := current_setting('request.headers', true)::json->>'x-key-hash';
  IF _key_hash IS NULL OR _key_hash = '' THEN
    RETURN NULL;
  END IF;
  SELECT ua.user_id INTO _user_id FROM user_auth ua WHERE ua.key_hash = _key_hash LIMIT 1;
  RETURN _user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    RETURN public.get_request_user_id();
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;
