-- Discord-like client visibility hardening:
-- keep data needed for normal client UX, remove server secrets/internal metadata.

-- -------------------------------------------------------------------
-- check_server_membership: do not return invite_code to normal members.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_server_membership(_server_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _user_id uuid;
  _is_member boolean;
  _server jsonb;
BEGIN
  _user_id := public.requesting_user_id();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('is_member', false);
  END IF;

  _is_member := public.is_server_member(_server_id, _user_id);
  IF NOT _is_member THEN
    RETURN jsonb_build_object('is_member', false);
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'is_published', s.is_published,
    'about', s.about,
    'created_at', s.created_at,
    'system_channel_join_id', s.system_channel_join_id,
    'system_channel_leave_id', s.system_channel_leave_id,
    'enable_join_messages', s.enable_join_messages,
    'enable_leave_messages', s.enable_leave_messages
  ) INTO _server
  FROM public.servers s
  WHERE s.id = _server_id;

  RETURN jsonb_build_object('is_member', true, 'server', _server);
END;
$function$;

-- -------------------------------------------------------------------
-- get_user_servers: remove invite_code from client payload.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_servers(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        s.id,
        s.name,
        s.owner_id,
        s.icon_url,
        s.banner_url,
        s.is_published,
        s.about,
        s.system_channel_join_id,
        s.system_channel_leave_id,
        s.enable_join_messages,
        s.enable_leave_messages,
        s.created_at,
        sm.role,
        sm.nickname,
        sm.joined_at,
        sm.is_muted,
        sm.position
      FROM public.servers s
      INNER JOIN public.server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = _user_id
        AND (sm.is_banned IS NULL OR sm.is_banned = false)
      ORDER BY sm.position ASC NULLS LAST, s.name ASC
    ) t
  );
END;
$function$;

-- -------------------------------------------------------------------
-- join_server_by_invite: do not echo invite_code back in result.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_server_by_invite(
  _invite_code text,
  _user_id uuid,
  _join_source text DEFAULT 'invite_link'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target_server_id uuid;
  existing_member record;
  result json;
  clean_code text;
  system_channel_id uuid;
  enable_join boolean;
  join_message_content text;
  invite_row_id uuid;
  invite_max_uses integer;
  invite_uses_count integer;
  invite_expires_at timestamptz;
  message_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  clean_code := upper(trim(_invite_code));

  SELECT id, system_channel_join_id, enable_join_messages
    INTO target_server_id, system_channel_id, enable_join
  FROM public.servers
  WHERE trim(invite_code::text) = clean_code;

  IF target_server_id IS NULL THEN
    SELECT si.id, si.server_id, si.max_uses, si.uses_count, si.expires_at
      INTO invite_row_id, target_server_id, invite_max_uses, invite_uses_count, invite_expires_at
    FROM public.server_invites si
    WHERE si.revoked_at IS NULL
      AND trim(si.code::text) = clean_code
    FOR UPDATE
    LIMIT 1;

    IF invite_row_id IS NOT NULL THEN
      IF invite_expires_at IS NOT NULL AND invite_expires_at <= now() THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      IF invite_max_uses IS NOT NULL AND invite_uses_count >= invite_max_uses THEN
        RAISE EXCEPTION 'Invalid invite code';
      END IF;
      SELECT system_channel_join_id, enable_join_messages
        INTO system_channel_id, enable_join
      FROM public.servers
      WHERE id = target_server_id;
    END IF;
  END IF;

  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  SELECT * INTO existing_member
  FROM public.server_members
  WHERE server_id = target_server_id AND user_id = _user_id;

  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned = true THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;

    SELECT json_build_object(
      'id', s.id,
      'name', s.name,
      'owner_id', s.owner_id,
      'icon_url', s.icon_url,
      'banner_url', s.banner_url,
      'created_at', s.created_at,
      'already_member', true
    ) INTO result
    FROM public.servers s
    WHERE s.id = target_server_id;

    RETURN result;
  END IF;

  INSERT INTO public.server_members (server_id, user_id, role, is_banned)
  VALUES (target_server_id, _user_id, 'member', false)
  ON CONFLICT (server_id, user_id) DO NOTHING;

  IF invite_row_id IS NOT NULL THEN
    UPDATE public.server_invites
    SET uses_count = uses_count + 1
    WHERE id = invite_row_id;
  END IF;

  IF system_channel_id IS NOT NULL AND enable_join THEN
    join_message_content := format('<@%s> joined', _user_id);
    BEGIN
      INSERT INTO public.messages (channel_id, user_id, content, is_system_message)
      VALUES (system_channel_id, _user_id, join_message_content, true)
      RETURNING id INTO message_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'created_at', s.created_at,
    'already_member', false
  ) INTO result
  FROM public.servers s
  WHERE s.id = target_server_id;

  RETURN result;
END;
$function$;

-- -------------------------------------------------------------------
-- update_server: do not return invite_code in mutation payload.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_server(_server_id uuid, _user_id uuid, _updates jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _user_role public.server_role;
  _updated_server public.servers%ROWTYPE;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT role INTO _user_role
  FROM public.server_members
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;

  IF _user_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not a member of this server');
  END IF;

  IF _user_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  IF (_updates ? 'is_published') AND ((_updates->>'is_published')::boolean = true) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'We''re rebuilding the Explore page. Publishing will be available soon.'
    );
  END IF;

  UPDATE public.servers
  SET
    name = COALESCE(_updates->>'name', name),
    icon_url = CASE WHEN _updates ? 'icon_url' THEN _updates->>'icon_url' ELSE icon_url END,
    banner_url = CASE WHEN _updates ? 'banner_url' THEN _updates->>'banner_url' ELSE banner_url END,
    about = CASE WHEN _updates ? 'about' THEN NULLIF(_updates->>'about', '') ELSE about END,
    is_published = CASE WHEN _updates ? 'is_published' THEN (_updates->>'is_published')::boolean ELSE is_published END,
    system_channel_join_id = CASE
      WHEN _updates ? 'system_channel_join_id' THEN
        CASE
          WHEN _updates->'system_channel_join_id' IS NULL
            OR _updates->>'system_channel_join_id' IN ('null', '', 'none') THEN NULL
          ELSE (_updates->>'system_channel_join_id')::uuid
        END
      ELSE system_channel_join_id
    END,
    system_channel_leave_id = CASE
      WHEN _updates ? 'system_channel_leave_id' THEN
        CASE
          WHEN _updates->'system_channel_leave_id' IS NULL
            OR _updates->>'system_channel_leave_id' IN ('null', '', 'none') THEN NULL
          ELSE (_updates->>'system_channel_leave_id')::uuid
        END
      ELSE system_channel_leave_id
    END,
    enable_join_messages = CASE WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean ELSE enable_join_messages END,
    enable_leave_messages = CASE WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean ELSE enable_leave_messages END
  WHERE id = _server_id
  RETURNING * INTO _updated_server;

  IF _updated_server.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'server', json_build_object(
      'id', _updated_server.id,
      'name', _updated_server.name,
      'icon_url', _updated_server.icon_url,
      'banner_url', _updated_server.banner_url,
      'about', _updated_server.about,
      'is_published', _updated_server.is_published,
      'owner_id', _updated_server.owner_id,
      'created_at', _updated_server.created_at,
      'system_channel_join_id', _updated_server.system_channel_join_id,
      'system_channel_leave_id', _updated_server.system_channel_leave_id,
      'enable_join_messages', _updated_server.enable_join_messages,
      'enable_leave_messages', _updated_server.enable_leave_messages
    )
  );
END;
$function$;

-- -------------------------------------------------------------------
-- get_server_members: remove internal join metadata from normal client payload.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
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
          'joined_at', sm.joined_at,
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
        AND COALESCE(sm.is_banned, false) = false
    ),
    '[]'::json
  );
END;
$function$;
