-- Phase 6C: replace high-value direct table reads with guarded RPC wrappers.

-- -------------------------------------------------------------------
-- Messages: channel page read with nested relations, identity + access checks.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_channel_messages_secure(
  _channel_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 50,
  _before timestamptz DEFAULT NULL,
  _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          m.id,
          m.channel_id,
          m.user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          row_to_json(u) AS "user",
          COALESCE(
            (
              SELECT json_agg(row_to_json(ma) ORDER BY ma.created_at ASC)
              FROM public.message_attachments ma
              WHERE ma.message_id = m.id
            ),
            '[]'::json
          ) AS attachments,
          COALESCE(
            (
              SELECT json_agg(row_to_json(r) ORDER BY r.created_at ASC)
              FROM public.reactions r
              WHERE r.message_id = m.id
            ),
            '[]'::json
          ) AS reactions
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.channel_id = _channel_id
          AND (_before IS NULL OR m.created_at < _before)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
        ORDER BY m.created_at DESC
        LIMIT _limit
      ) t
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_message_replies_secure(
  _message_ids uuid[],
  _user_id uuid,
  _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          m.id,
          m.content,
          row_to_json(u) AS "user"
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.id = ANY(_message_ids)
          AND public.can_access_channel(m.channel_id, _user_id)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
      ) t
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_messages_by_ids_secure(
  _message_ids uuid[],
  _user_id uuid,
  _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          m.id,
          m.channel_id,
          m.user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          row_to_json(u) AS "user",
          COALESCE(
            (
              SELECT json_agg(row_to_json(ma) ORDER BY ma.created_at ASC)
              FROM public.message_attachments ma
              WHERE ma.message_id = m.id
            ),
            '[]'::json
          ) AS attachments,
          COALESCE(
            (
              SELECT json_agg(row_to_json(r) ORDER BY r.created_at ASC)
              FROM public.reactions r
              WHERE r.message_id = m.id
            ),
            '[]'::json
          ) AS reactions
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.id = ANY(_message_ids)
          AND public.can_access_channel(m.channel_id, _user_id)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
      ) t
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_pinned_messages_secure(
  _channel_id uuid,
  _user_id uuid,
  _blocked_user_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          m.id,
          m.channel_id,
          m.user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          row_to_json(u) AS "user",
          COALESCE(
            (
              SELECT json_agg(row_to_json(ma) ORDER BY ma.created_at ASC)
              FROM public.message_attachments ma
              WHERE ma.message_id = m.id
            ),
            '[]'::json
          ) AS attachments
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        WHERE m.channel_id = _channel_id
          AND m.is_pinned = true
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
        ORDER BY m.created_at DESC
      ) t
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_server_recent_announcements_secure(
  _server_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 5
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          m.id,
          m.content,
          m.created_at,
          m.channel_id,
          c.name AS channel_name,
          row_to_json(u) AS "user"
        FROM public.messages m
        JOIN public.channels c ON c.id = m.channel_id
        JOIN public.users u ON u.id = m.user_id
        WHERE c.server_id = _server_id
          AND c.type = 'announcement'
        ORDER BY m.created_at DESC
        LIMIT _limit
      ) t
    ),
    '[]'::json
  );
END;
$function$;

-- -------------------------------------------------------------------
-- DM read helpers.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dm_messages_by_ids_secure(
  _message_ids uuid[],
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          dm.id,
          dm.conversation_id,
          dm.sender_id,
          dm.content,
          dm.created_at,
          json_build_object('username', u.username) AS sender
        FROM public.direct_messages dm
        JOIN public.users u ON u.id = dm.sender_id
        WHERE dm.id = ANY(_message_ids)
          AND EXISTS (
            SELECT 1
            FROM public.dm_participants dp
            WHERE dp.conversation_id = dm.conversation_id
              AND dp.user_id = _user_id
          )
      ) t
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dm_message_conversation_secure(
  _message_id uuid,
  _user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _conversation_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT dm.conversation_id
    INTO _conversation_id
  FROM public.direct_messages dm
  WHERE dm.id = _message_id
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants dp
      WHERE dp.conversation_id = dm.conversation_id
        AND dp.user_id = _user_id
    )
  LIMIT 1;

  RETURN _conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_dm_conversation_ids_secure(
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(dp.conversation_id)
      FROM public.dm_participants dp
      WHERE dp.user_id = _user_id
    ),
    '[]'::json
  );
END;
$function$;

-- -------------------------------------------------------------------
-- User/profile read helpers.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_users_presence_secure(
  _user_id uuid,
  _target_user_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT u.id, u.status, u.last_seen
        FROM public.users u
        WHERE u.id = ANY(_target_user_ids)
          AND public.can_view_user(u.id, _user_id)
      ) t
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_users_basic_secure(
  _user_id uuid,
  _target_user_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.banner_color
        FROM public.users u
        WHERE u.id = ANY(_target_user_ids)
          AND public.can_view_user(u.id, _user_id)
      ) t
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_profile_secure(
  _target_user_id uuid,
  _requesting_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN (
    SELECT row_to_json(u)
    FROM (
      SELECT id, username, display_name, avatar_url, banner_url, avatar_decoration, profile_effect,
             banner_color, profile_theme_primary, profile_theme_accent, bio, status,
             custom_status, created_at, last_seen, pronouns
      FROM public.users
      WHERE id = _target_user_id
      LIMIT 1
    ) u
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_shared_server_ids_secure(
  _target_user_id uuid,
  _requesting_user_id uuid,
  _server_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(sm.server_id)
      FROM public.server_members sm
      WHERE sm.user_id = _target_user_id
        AND sm.server_id = ANY(_server_ids)
        AND COALESCE(sm.is_banned, false) = false
    ),
    '[]'::json
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_user_badges_secure(
  _target_user_id uuid,
  _requesting_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', b.id,
          'name', b.name,
          'icon_url', b.icon_url,
          'description', b.description
        )
      )
      FROM public.user_badges ub
      JOIN public.badges b ON b.id = ub.badge_id
      WHERE ub.user_id = _target_user_id
    ),
    '[]'::json
  );
END;
$function$;

-- -------------------------------------------------------------------
-- Server governance read helpers.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_server_banned_secure(
  _server_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _is_banned boolean;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT COALESCE(sm.is_banned, false)
    INTO _is_banned
  FROM public.server_members sm
  WHERE sm.server_id = _server_id
    AND sm.user_id = _user_id
  LIMIT 1;

  RETURN COALESCE(_is_banned, false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_server_roles_secure(
  _server_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.position ASC)
      FROM (
        SELECT id, server_id, name, color, icon, position, created_at
        FROM public.server_roles
        WHERE server_id = _server_id
      ) t
    ),
    '[]'::json
  );
END;
$function$;

-- Execute grants: no PUBLIC, only runtime roles.
REVOKE EXECUTE ON FUNCTION public.get_channel_messages_secure(uuid, uuid, integer, timestamptz, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_message_replies_secure(uuid[], uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_messages_by_ids_secure(uuid[], uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pinned_messages_secure(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_server_recent_announcements_secure(uuid, uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dm_messages_by_ids_secure(uuid[], uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dm_message_conversation_secure(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_dm_conversation_ids_secure(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_users_presence_secure(uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_users_basic_secure(uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_profile_secure(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_shared_server_ids_secure(uuid, uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_badges_secure(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_server_banned_secure(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_server_roles_secure(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_channel_messages_secure(uuid, uuid, integer, timestamptz, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_message_replies_secure(uuid[], uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages_by_ids_secure(uuid[], uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pinned_messages_secure(uuid, uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_recent_announcements_secure(uuid, uuid, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dm_messages_by_ids_secure(uuid[], uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dm_message_conversation_secure(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_dm_conversation_ids_secure(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_presence_secure(uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_users_basic_secure(uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_profile_secure(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_server_ids_secure(uuid, uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_badges_secure(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_server_banned_secure(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_roles_secure(uuid, uuid) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
