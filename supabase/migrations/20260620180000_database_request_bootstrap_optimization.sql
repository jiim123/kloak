-- Bundle startup and DM read surfaces to reduce client request fan-out.

CREATE OR REPLACE FUNCTION public.get_server_surface_secure(
  _server_id uuid,
  _user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
  _can_manage_invites boolean := false;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _user_id IS NOT NULL AND _user_id <> _caller THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN json_build_object(
      'categories', '[]'::json,
      'channels', '[]'::json,
      'roles', '[]'::json,
      'role_permissions', '[]'::json,
      'member_count', 0,
      'emojis', '[]'::json,
      'current_member', NULL
    );
  END IF;

  _can_manage_invites := public.check_user_server_permission(_caller, _server_id, 'manage_invites');

  RETURN json_build_object(
    'categories', COALESCE(public.get_server_categories(_server_id, _caller), '[]'::json),
    'channels', COALESCE(public.get_server_channels(_server_id, _caller), '[]'::json),
    'roles', COALESCE(public.get_server_roles_secure(_server_id, _caller), '[]'::json),
    'role_permissions', COALESCE(public.get_role_permissions(_server_id), '[]'::json),
    'member_count', COALESCE(public.get_server_member_count_secure(_server_id, _caller), 0),
    'emojis',
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', se.id,
              'name', se.name,
              'file_path', se.file_path
            )
            ORDER BY se.created_at ASC
          )
          FROM public.server_emojis se
          WHERE se.server_id = _server_id
        ),
        '[]'::json
      ),
    'current_member',
      (
        SELECT json_build_object(
          'id', sm.id,
          'server_id', sm.server_id,
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'is_banned', sm.is_banned,
          'is_muted', sm.is_muted,
          'joined_at', sm.joined_at,
          'join_source', sm.join_source,
          'join_invite_code', CASE WHEN _can_manage_invites THEN sm.join_invite_code ELSE NULL END,
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
            'last_seen', u.last_seen,
            'is_bot', u.is_bot
          ),
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'server_id', sr.server_id,
                  'name', sr.name,
                  'color', sr.color,
                  'icon', sr.icon,
                  'is_self_assignable', sr.is_self_assignable,
                  'position', sr.position,
                  'created_at', sr.created_at
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
        FROM public.server_members sm
        JOIN public.users u ON u.id = sm.user_id
        WHERE sm.server_id = _server_id
          AND sm.user_id = _caller
          AND COALESCE(sm.is_banned, false) = false
        LIMIT 1
      )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.server(
  _server_id uuid,
  _user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN public.get_server_surface_secure(_server_id, _user_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_dm_bootstrap_secure(
  _conversation_id uuid,
  _user_id uuid,
  _limit integer DEFAULT 50,
  _before_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _before_created_at timestamptz;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants dp
    WHERE dp.conversation_id = _conversation_id
      AND dp.user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  IF _before_id IS NOT NULL THEN
    SELECT dm.created_at INTO _before_created_at
    FROM public.direct_messages dm
    WHERE dm.id = _before_id
      AND dm.conversation_id = _conversation_id;
  END IF;

  RETURN json_build_object(
    'messages',
    COALESCE(
      (
        WITH page AS (
          SELECT dm.*
          FROM public.direct_messages dm
          WHERE dm.conversation_id = _conversation_id
            AND (_before_id IS NULL OR dm.created_at < _before_created_at)
            AND NOT EXISTS (
              SELECT 1
              FROM public.friendships f
              WHERE f.status = 'blocked'
                AND (
                  (f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
                  OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id)
                )
            )
          ORDER BY dm.created_at DESC
          LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 100)
        )
        SELECT json_agg(
          json_build_object(
            'id', p.id,
            'conversation_id', p.conversation_id,
            'sender_id', p.sender_id,
            'content', p.content,
            'reply_to_id', p.reply_to_id,
            'edited_at', p.edited_at,
            'created_at', p.created_at,
            'sender', json_build_object(
              'id', sender.id,
              'username', sender.username,
              'display_name', sender.display_name,
              'avatar_url', sender.avatar_url,
              'banner_url', sender.banner_url,
              'avatar_decoration', sender.avatar_decoration,
              'profile_effect', sender.profile_effect,
              'banner_color', sender.banner_color,
              'profile_theme_primary', sender.profile_theme_primary,
              'profile_theme_accent', sender.profile_theme_accent,
              'bio', sender.bio,
              'status', sender.status,
              'custom_status', sender.custom_status,
              'created_at', sender.created_at,
              'last_seen', sender.last_seen,
              'is_bot', sender.is_bot
            ),
            'attachments', COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', a.id,
                    'message_id', a.message_id,
                    'file_url', a.file_url,
                    'file_name', a.file_name,
                    'file_type', a.file_type,
                    'file_size', a.file_size,
                    'width', a.width,
                    'height', a.height
                  )
                  ORDER BY a.id ASC
                )
                FROM public.dm_attachments a
                WHERE a.message_id = p.id
              ),
              '[]'::json
            ),
            'reactions', COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', r.id,
                    'message_id', r.message_id,
                    'user_id', r.user_id,
                    'emoji', r.emoji
                  )
                  ORDER BY r.id ASC
                )
                FROM public.dm_reactions r
                WHERE r.message_id = p.id
              ),
              '[]'::json
            ),
            'reply_to',
              CASE
                WHEN reply.id IS NULL THEN NULL
                ELSE json_build_object(
                  'id', reply.id,
                  'conversation_id', reply.conversation_id,
                  'sender_id', reply.sender_id,
                  'content', reply.content,
                  'reply_to_id', reply.reply_to_id,
                  'edited_at', reply.edited_at,
                  'created_at', reply.created_at
                )
              END
          )
          ORDER BY p.created_at DESC
        )
        FROM page p
        JOIN public.users sender ON sender.id = p.sender_id
        LEFT JOIN public.direct_messages reply
          ON reply.id = p.reply_to_id
          AND reply.conversation_id = p.conversation_id
      ),
      '[]'::json
    )
  );
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_dm_reactions_message_id
  ON public.dm_reactions (message_id);

CREATE INDEX IF NOT EXISTS idx_channel_reads_user_channel
  ON public.channel_reads (user_id, channel_id);

REVOKE EXECUTE ON FUNCTION public.get_server_surface_secure(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.server(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dm_bootstrap_secure(uuid, uuid, integer, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_server_surface_secure(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.server(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dm_bootstrap_secure(uuid, uuid, integer, uuid) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
