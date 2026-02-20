-- Harden high-risk SECURITY DEFINER RPCs that were callable by anon/authenticated
-- without strict caller identity or visibility checks.

-- -------------------------------------------------------------------
-- Internal notification writer should not be callable by public clients.
-- -------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, notification_type, text, text, text) FROM anon, authenticated;

-- -------------------------------------------------------------------
-- create_server_role: enforce caller identity before permission checks.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_server_role(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _color text DEFAULT '#5865F2'::text,
  _icon text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  INSERT INTO public.server_roles (server_id, name, color, icon, position)
  VALUES (
    _server_id,
    _name,
    _color,
    _icon,
    COALESCE((SELECT MAX(position) FROM public.server_roles WHERE server_id = _server_id), 0) + 1
  )
  RETURNING id INTO new_role_id;

  RETURN (
    SELECT json_build_object(
      'id', sr.id,
      'server_id', sr.server_id,
      'name', sr.name,
      'color', sr.color,
      'icon', sr.icon,
      'position', sr.position,
      'created_at', sr.created_at
    )
    FROM public.server_roles sr
    WHERE sr.id = new_role_id
  );
END;
$$;

-- -------------------------------------------------------------------
-- get_dm_messages: require caller identity to match _user_id.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dm_messages(
  _conversation_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 50,
  _before_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.dm_participants
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
      FROM public.direct_messages dm
      JOIN public.users u ON u.id = dm.sender_id
      WHERE dm.conversation_id = _conversation_id
        AND (_before_id IS NULL OR dm.created_at < (SELECT created_at FROM public.direct_messages WHERE id = _before_id))
        AND NOT EXISTS (
          SELECT 1
          FROM public.friendships f
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

-- -------------------------------------------------------------------
-- get_user_by_id: enforce visibility via can_view_user(requesting_user_id()).
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_by_id(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF NOT public.can_view_user(_user_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
    SELECT json_build_object(
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
      'last_seen', u.last_seen
    )
    FROM public.users u
    WHERE u.id = _user_id
  );
END;
$$;

-- -------------------------------------------------------------------
-- get_server_members: require authenticated caller who is a member.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
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
            'last_seen', u.last_seen
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
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;
