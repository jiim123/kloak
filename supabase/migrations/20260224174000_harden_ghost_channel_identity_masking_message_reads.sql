-- Enforce ghost-channel identity masking at RPC layer so reply/user payloads
-- do not leak real usernames or stable raw user_ids for non-owner/admin authors.
--
-- Scope:
-- - get_channel_messages_secure
-- - get_message_replies_secure
-- - get_messages_by_ids_secure
-- - get_pinned_messages_secure
--
-- Notes:
-- - Access checks remain unchanged (verify_request_identity + can_access_channel).
-- - Owner/admin authors stay visible in ghost channels; others are anonymized.
-- - Top-level user_id and reaction user_id are pseudonymized for hidden authors.

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
      WITH channel_ctx AS (
        SELECT c.server_id, c.ghost_mode
        FROM public.channels c
        WHERE c.id = _channel_id
      ),
      limited_messages AS (
        SELECT
          m.id,
          m.channel_id,
          m.user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at
        FROM public.messages m
        WHERE m.channel_id = _channel_id
          AND (_before IS NULL OR m.created_at < _before)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (m.user_id = ANY(_blocked_user_ids))
          )
        ORDER BY m.created_at DESC
        LIMIT _limit
      ),
      attachments_by_message AS (
        SELECT
          ma.message_id,
          json_agg(row_to_json(ma)) AS attachments
        FROM public.message_attachments ma
        JOIN limited_messages lm ON lm.id = ma.message_id
        GROUP BY ma.message_id
      ),
      reactions_by_message AS (
        SELECT
          r.message_id,
          json_agg(
            json_build_object(
              'id', r.id,
              'message_id', r.message_id,
              'user_id',
              CASE
                WHEN cc.ghost_mode = true
                  AND COALESCE(sm_reactor.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
                THEN 'ghost_' || substr(md5(r.user_id::text || ':' || _channel_id::text || ':v1'), 1, 24)
                ELSE r.user_id::text
              END,
              'emoji', r.emoji
            )
          ) AS reactions
        FROM public.reactions r
        JOIN limited_messages lm ON lm.id = r.message_id
        JOIN channel_ctx cc ON true
        LEFT JOIN public.server_members sm_reactor
          ON sm_reactor.server_id = cc.server_id
         AND sm_reactor.user_id = r.user_id
         AND COALESCE(sm_reactor.is_banned, false) = false
        GROUP BY r.message_id
      ),
      reply_targets AS (
        SELECT DISTINCT lm.reply_to_id AS id
        FROM limited_messages lm
        WHERE lm.reply_to_id IS NOT NULL
      ),
      reply_rows AS (
        SELECT
          rm.id,
          rm.user_id,
          rm.content
        FROM public.messages rm
        JOIN reply_targets rt ON rt.id = rm.id
        WHERE public.can_access_channel(rm.channel_id, _user_id)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (rm.user_id = ANY(_blocked_user_ids))
          )
      ),
      replies_by_id AS (
        SELECT
          rr.id,
          json_build_object(
            'id', rr.id,
            'content', rr.content,
            'user',
            CASE
              WHEN cc.ghost_mode = true
                AND COALESCE(sm_reply.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
              THEN json_build_object(
                'id', 'anonymous',
                'username', 'anonymous',
                'display_name', 'Anonymous',
                'avatar_url', NULL,
                'banner_url', NULL,
                'avatar_decoration', NULL,
                'profile_effect', NULL,
                'banner_color', '#6b7280',
                'profile_theme_primary', NULL,
                'profile_theme_accent', NULL,
                'bio', NULL,
                'status', 'offline',
                'custom_status', NULL,
                'created_at', NULL,
                'last_seen', NULL
              )
              ELSE row_to_json(ru)
            END
          ) AS reply_to
        FROM reply_rows rr
        JOIN public.users ru ON ru.id = rr.user_id
        JOIN channel_ctx cc ON true
        LEFT JOIN public.server_members sm_reply
          ON sm_reply.server_id = cc.server_id
         AND sm_reply.user_id = rr.user_id
         AND COALESCE(sm_reply.is_banned, false) = false
      )
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          lm.id,
          lm.channel_id,
          CASE
            WHEN cc.ghost_mode = true
              AND COALESCE(sm_author.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
            THEN 'ghost_' || substr(md5(lm.user_id::text || ':' || _channel_id::text || ':v1'), 1, 24)
            ELSE lm.user_id::text
          END AS user_id,
          lm.content,
          lm.reply_to_id,
          rb.reply_to,
          lm.is_pinned,
          lm.edited_at,
          lm.created_at,
          CASE
            WHEN cc.ghost_mode = true
              AND COALESCE(sm_author.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
            THEN json_build_object(
              'id', 'anonymous',
              'username', 'anonymous',
              'display_name', 'Anonymous',
              'avatar_url', NULL,
              'banner_url', NULL,
              'avatar_decoration', NULL,
              'profile_effect', NULL,
              'banner_color', '#6b7280',
              'profile_theme_primary', NULL,
              'profile_theme_accent', NULL,
              'bio', NULL,
              'status', 'offline',
              'custom_status', NULL,
              'created_at', NULL,
              'last_seen', NULL
            )
            ELSE row_to_json(u)
          END AS "user",
          COALESCE(abm.attachments, '[]'::json) AS attachments,
          COALESCE(rbm.reactions, '[]'::json) AS reactions
        FROM limited_messages lm
        JOIN public.users u ON u.id = lm.user_id
        JOIN channel_ctx cc ON true
        LEFT JOIN public.server_members sm_author
          ON sm_author.server_id = cc.server_id
         AND sm_author.user_id = lm.user_id
         AND COALESCE(sm_author.is_banned, false) = false
        LEFT JOIN attachments_by_message abm ON abm.message_id = lm.id
        LEFT JOIN reactions_by_message rbm ON rbm.message_id = lm.id
        LEFT JOIN replies_by_id rb ON rb.id = lm.reply_to_id
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
          CASE
            WHEN c.ghost_mode = true
              AND COALESCE(sm_author.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
            THEN json_build_object(
              'id', 'anonymous',
              'username', 'anonymous',
              'display_name', 'Anonymous',
              'avatar_url', NULL,
              'banner_url', NULL,
              'avatar_decoration', NULL,
              'profile_effect', NULL,
              'banner_color', '#6b7280',
              'profile_theme_primary', NULL,
              'profile_theme_accent', NULL,
              'bio', NULL,
              'status', 'offline',
              'custom_status', NULL,
              'created_at', NULL,
              'last_seen', NULL
            )
            ELSE row_to_json(u)
          END AS "user"
        FROM public.messages m
        JOIN public.channels c ON c.id = m.channel_id
        JOIN public.users u ON u.id = m.user_id
        LEFT JOIN public.server_members sm_author
          ON sm_author.server_id = c.server_id
         AND sm_author.user_id = m.user_id
         AND COALESCE(sm_author.is_banned, false) = false
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
          CASE
            WHEN c.ghost_mode = true
              AND COALESCE(sm_author.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
            THEN 'ghost_' || substr(md5(m.user_id::text || ':' || c.id::text || ':v1'), 1, 24)
            ELSE m.user_id::text
          END AS user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          CASE
            WHEN c.ghost_mode = true
              AND COALESCE(sm_author.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
            THEN json_build_object(
              'id', 'anonymous',
              'username', 'anonymous',
              'display_name', 'Anonymous',
              'avatar_url', NULL,
              'banner_url', NULL,
              'avatar_decoration', NULL,
              'profile_effect', NULL,
              'banner_color', '#6b7280',
              'profile_theme_primary', NULL,
              'profile_theme_accent', NULL,
              'bio', NULL,
              'status', 'offline',
              'custom_status', NULL,
              'created_at', NULL,
              'last_seen', NULL
            )
            ELSE row_to_json(u)
          END AS "user",
          COALESCE(
            (
              SELECT json_agg(row_to_json(ma))
              FROM public.message_attachments ma
              WHERE ma.message_id = m.id
            ),
            '[]'::json
          ) AS attachments,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', r.id,
                  'message_id', r.message_id,
                  'user_id',
                  CASE
                    WHEN c.ghost_mode = true
                      AND COALESCE(sm_reactor.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
                    THEN 'ghost_' || substr(md5(r.user_id::text || ':' || c.id::text || ':v1'), 1, 24)
                    ELSE r.user_id::text
                  END,
                  'emoji', r.emoji
                )
              )
              FROM public.reactions r
              LEFT JOIN public.server_members sm_reactor
                ON sm_reactor.server_id = c.server_id
               AND sm_reactor.user_id = r.user_id
               AND COALESCE(sm_reactor.is_banned, false) = false
              WHERE r.message_id = m.id
            ),
            '[]'::json
          ) AS reactions
        FROM public.messages m
        JOIN public.channels c ON c.id = m.channel_id
        JOIN public.users u ON u.id = m.user_id
        LEFT JOIN public.server_members sm_author
          ON sm_author.server_id = c.server_id
         AND sm_author.user_id = m.user_id
         AND COALESCE(sm_author.is_banned, false) = false
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
      WITH channel_ctx AS (
        SELECT c.server_id, c.ghost_mode
        FROM public.channels c
        WHERE c.id = _channel_id
      )
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          m.id,
          m.channel_id,
          CASE
            WHEN cc.ghost_mode = true
              AND COALESCE(sm_author.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
            THEN 'ghost_' || substr(md5(m.user_id::text || ':' || _channel_id::text || ':v1'), 1, 24)
            ELSE m.user_id::text
          END AS user_id,
          m.content,
          m.reply_to_id,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          CASE
            WHEN cc.ghost_mode = true
              AND COALESCE(sm_author.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
            THEN json_build_object(
              'id', 'anonymous',
              'username', 'anonymous',
              'display_name', 'Anonymous',
              'avatar_url', NULL,
              'banner_url', NULL,
              'avatar_decoration', NULL,
              'profile_effect', NULL,
              'banner_color', '#6b7280',
              'profile_theme_primary', NULL,
              'profile_theme_accent', NULL,
              'bio', NULL,
              'status', 'offline',
              'custom_status', NULL,
              'created_at', NULL,
              'last_seen', NULL
            )
            ELSE row_to_json(u)
          END AS "user",
          COALESCE(
            (
              SELECT json_agg(row_to_json(ma))
              FROM public.message_attachments ma
              WHERE ma.message_id = m.id
            ),
            '[]'::json
          ) AS attachments
        FROM public.messages m
        JOIN public.users u ON u.id = m.user_id
        JOIN channel_ctx cc ON true
        LEFT JOIN public.server_members sm_author
          ON sm_author.server_id = cc.server_id
         AND sm_author.user_id = m.user_id
         AND COALESCE(sm_author.is_banned, false) = false
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

REVOKE EXECUTE ON FUNCTION public.get_channel_messages_secure(uuid, uuid, integer, timestamptz, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_message_replies_secure(uuid[], uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_messages_by_ids_secure(uuid[], uuid, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_pinned_messages_secure(uuid, uuid, uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_channel_messages_secure(uuid, uuid, integer, timestamptz, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_message_replies_secure(uuid[], uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_messages_by_ids_secure(uuid[], uuid, uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pinned_messages_secure(uuid, uuid, uuid[]) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
