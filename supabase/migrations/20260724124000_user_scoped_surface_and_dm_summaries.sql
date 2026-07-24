-- User-scoped realtime surface payloads for privacy-sensitive server and DM updates.

CREATE OR REPLACE FUNCTION public.server_surface_broadcast_for_user(_server_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'categories', COALESCE(public.get_server_categories(_server_id, _user_id)::jsonb, '[]'::jsonb),
    'channels', COALESCE(public.get_server_channels(_server_id, _user_id)::jsonb, '[]'::jsonb),
    'roles', COALESCE(
      (
        SELECT jsonb_agg(to_jsonb(sr) ORDER BY sr.position ASC)
        FROM public.server_roles sr
        WHERE sr.server_id = _server_id
      ),
      '[]'::jsonb
    ),
    'members_lite', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
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
            'user', to_jsonb(u),
            'roles', COALESCE(
              (
                SELECT jsonb_agg(to_jsonb(sr) ORDER BY sr.position ASC)
                FROM public.server_member_roles smr
                JOIN public.server_roles sr ON sr.id = smr.role_id
                WHERE smr.member_id = sm.id
              ),
              '[]'::jsonb
            )
          )
          ORDER BY COALESCE(u.status, 'offline') <> 'offline' DESC, sm.joined_at ASC
        )
        FROM public.server_members sm
        JOIN public.users u ON u.id = sm.user_id
        WHERE sm.server_id = _server_id
          AND COALESCE(sm.is_banned, false) = false
          AND (
            COALESCE(u.status, 'offline') <> 'offline'
            OR sm.role = 'owner'
            OR COALESCE(u.is_bot, false) = true
          )
      ),
      '[]'::jsonb
    ),
    'current_member', (
      SELECT jsonb_build_object(
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
        'user', to_jsonb(u),
        'roles', COALESCE(
          (
            SELECT jsonb_agg(to_jsonb(sr) ORDER BY sr.position ASC)
            FROM public.server_member_roles smr
            JOIN public.server_roles sr ON sr.id = smr.role_id
            WHERE smr.member_id = sm.id
          ),
          '[]'::jsonb
        )
      )
      FROM public.server_members sm
      JOIN public.users u ON u.id = sm.user_id
      WHERE sm.server_id = _server_id
        AND sm.user_id = _user_id
        AND COALESCE(sm.is_banned, false) = false
      LIMIT 1
    )
  )
  WHERE public.is_server_member(_server_id, _user_id);
$$;

CREATE OR REPLACE FUNCTION public.dm_conversation_summary_for_user(_conversation_id uuid, _user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', c.id,
      'created_at', c.created_at,
      'is_group', c.is_group,
      'name', c.name,
      'created_by', c.created_by
    ),
    'participants', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', dp2.id,
            'conversation_id', dp2.conversation_id,
            'user_id', dp2.user_id,
            'last_read_at', dp2.last_read_at,
            'user', jsonb_build_object(
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
              'last_seen', CASE WHEN u.id = _user_id THEN u.last_seen ELSE NULL END,
              'is_bot', u.is_bot
            )
          )
          ORDER BY dp2.id ASC
        )
        FROM public.dm_participants dp2
        JOIN public.users u ON u.id = dp2.user_id
        WHERE dp2.conversation_id = c.id
      ),
      '[]'::jsonb
    ),
    'last_message', (
      SELECT jsonb_build_object(
        'id', dm.id,
        'conversation_id', dm.conversation_id,
        'sender_id', dm.sender_id,
        'content', dm.content,
        'reply_to_id', dm.reply_to_id,
        'edited_at', dm.edited_at,
        'created_at', dm.created_at
      )
      FROM public.direct_messages dm
      WHERE dm.conversation_id = c.id
      ORDER BY dm.created_at DESC
      LIMIT 1
    )
  )
  FROM public.dm_conversations c
  WHERE c.id = _conversation_id
    AND EXISTS (
      SELECT 1
      FROM public.dm_participants self_dp
      WHERE self_dp.conversation_id = c.id
        AND self_dp.user_id = _user_id
    );
$$;

CREATE OR REPLACE FUNCTION public.broadcast_server_surface_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _server_id uuid;
  _channel_id uuid;
  _member_id uuid;
  _row_new jsonb;
  _row_old jsonb;
  _payload jsonb;
  _participant record;
  _surface jsonb;
  _removed_user_id uuid;
BEGIN
  _row_new := CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END;
  _row_old := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;

  _server_id := COALESCE(
    NULLIF((_row_new ->> 'server_id'), '')::uuid,
    NULLIF((_row_old ->> 'server_id'), '')::uuid
  );

  IF _server_id IS NULL AND TG_TABLE_NAME = 'servers' THEN
    IF TG_OP = 'DELETE' THEN
      _server_id := OLD.id;
    ELSE
      _server_id := NEW.id;
    END IF;
  END IF;

  IF _server_id IS NULL AND TG_TABLE_NAME IN ('channel_permissions', 'channel_members') THEN
    _channel_id := COALESCE(
      NULLIF((_row_new ->> 'channel_id'), '')::uuid,
      NULLIF((_row_old ->> 'channel_id'), '')::uuid
    );
    IF _channel_id IS NOT NULL THEN
      SELECT c.server_id INTO _server_id
      FROM public.channels c
      WHERE c.id = _channel_id;
    END IF;
  END IF;

  IF _server_id IS NULL AND TG_TABLE_NAME = 'server_member_roles' THEN
    _member_id := COALESCE(
      NULLIF((_row_new ->> 'member_id'), '')::uuid,
      NULLIF((_row_old ->> 'member_id'), '')::uuid
    );
    IF _member_id IS NOT NULL THEN
      SELECT sm.server_id INTO _server_id
      FROM public.server_members sm
      WHERE sm.id = _member_id;
    END IF;
  END IF;

  IF _server_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_TABLE_NAME = 'server_members' AND TG_OP = 'DELETE' THEN
    _removed_user_id := OLD.user_id;
  END IF;

  _payload := jsonb_build_object(
    'table', TG_TABLE_NAME,
    'op', TG_OP,
    'server_id', _server_id,
    'new', CASE WHEN TG_TABLE_NAME = 'servers' THEN _row_new ELSE NULL END,
    'old', CASE WHEN TG_TABLE_NAME = 'servers' THEN _row_old ELSE NULL END
  );

  PERFORM realtime.send(_payload, 'server_surface', 'server:' || _server_id::text, false);

  FOR _participant IN
    SELECT sm.user_id
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND COALESCE(sm.is_banned, false) = false
    UNION
    SELECT _removed_user_id
    WHERE _removed_user_id IS NOT NULL
  LOOP
    _surface := public.server_surface_broadcast_for_user(_server_id, _participant.user_id);
    PERFORM realtime.send(
      jsonb_build_object(
        'table', TG_TABLE_NAME,
        'op', TG_OP,
        'server_id', _server_id,
        'surface', _surface,
        'removed', _surface IS NULL
      ),
      'server_surface',
      'user:' || _participant.user_id::text,
      false
    );
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_user_dm_message_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _conversation_id uuid;
  _payload jsonb;
  _participant record;
BEGIN
  _conversation_id := COALESCE(NEW.conversation_id, OLD.conversation_id);
  IF _conversation_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object('id', OLD.id, 'conversation_id', OLD.conversation_id),
      'conversation_id', _conversation_id
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'content', NEW.content,
        'reply_to_id', NEW.reply_to_id,
        'edited_at', NEW.edited_at,
        'created_at', NEW.created_at
      ),
      'conversation_id', _conversation_id
    );
  END IF;

  FOR _participant IN
    SELECT dp.user_id
    FROM public.dm_participants dp
    WHERE dp.conversation_id = _conversation_id
  LOOP
    PERFORM realtime.send(
      _payload || jsonb_build_object('conversation', public.dm_conversation_summary_for_user(_conversation_id, _participant.user_id)),
      'direct_messages',
      'user:' || _participant.user_id::text,
      false
    );
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_user_dm_participant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _conversation_id uuid;
  _user_id uuid;
  _payload jsonb;
  _participant record;
BEGIN
  _conversation_id := COALESCE(NEW.conversation_id, OLD.conversation_id);
  _user_id := COALESCE(NEW.user_id, OLD.user_id);
  IF _conversation_id IS NULL OR _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _payload := jsonb_build_object(
    'op', TG_OP,
    'conversation_id', _conversation_id,
    'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END
  );

  FOR _participant IN
    SELECT dp.user_id
    FROM public.dm_participants dp
    WHERE dp.conversation_id = _conversation_id
    UNION
    SELECT OLD.user_id
    WHERE TG_OP = 'DELETE'
      AND OLD.user_id IS NOT NULL
  LOOP
    PERFORM realtime.send(
      _payload || jsonb_build_object(
        'conversation', public.dm_conversation_summary_for_user(_conversation_id, _participant.user_id),
        'removed', NOT EXISTS (
          SELECT 1 FROM public.dm_participants dp
          WHERE dp.conversation_id = _conversation_id AND dp.user_id = _participant.user_id
        )
      ),
      'dm_participants',
      'user:' || _participant.user_id::text,
      false
    );
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.server_surface_broadcast_for_user(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.dm_conversation_summary_for_user(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_server_surface_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_user_dm_message_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_user_dm_participant_change() FROM PUBLIC;
