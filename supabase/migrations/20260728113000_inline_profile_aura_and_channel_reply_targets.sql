-- Fold profile achievement summaries and multi-reply channel targets into
-- existing read surfaces to remove extra client-side RPCs during navigation.

CREATE OR REPLACE FUNCTION public.profile(
  _target_user_id uuid,
  _requesting_user_id uuid,
  _server_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _shared_server_ids json := '[]'::json;
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF COALESCE(array_length(_server_ids, 1), 0) > 0 THEN
    SELECT COALESCE(json_agg(sm.server_id), '[]'::json)
      INTO _shared_server_ids
    FROM public.server_members sm
    WHERE sm.user_id = _target_user_id
      AND sm.server_id = ANY(_server_ids)
      AND COALESCE(sm.is_banned, false) = false;
  END IF;

  RETURN json_build_object(
    'user', (
      SELECT row_to_json(u)
      FROM (
        SELECT id, username, display_name, avatar_url, banner_url, avatar_decoration, profile_effect,
               banner_color, profile_theme_primary, profile_theme_accent, bio, tagline, status,
               custom_status, created_at, last_seen, pronouns, is_bot
        FROM public.users
        WHERE id = _target_user_id
        LIMIT 1
      ) u
    ),
    'badges', COALESCE(
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
    ),
    'posts', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', p.id,
            'user_id', p.user_id,
            'title', p.title,
            'content', p.content,
            'created_at', p.created_at,
            'updated_at', p.updated_at,
            'reactions', public.profile_post_reactions_json(p.id, _requesting_user_id),
            'comment_count', (
              SELECT count(*)::int
              FROM public.user_profile_post_comments pc
              WHERE pc.post_id = p.id
            ),
            'comments', COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', c.id,
                    'post_id', c.post_id,
                    'user_id', c.user_id,
                    'content', c.content,
                    'created_at', c.created_at,
                    'updated_at', c.updated_at,
                    'user', json_build_object(
                      'id', cu.id,
                      'username', cu.username,
                      'display_name', cu.display_name,
                      'avatar_url', cu.avatar_url,
                      'banner_url', cu.banner_url,
                      'avatar_decoration', cu.avatar_decoration,
                      'profile_effect', cu.profile_effect,
                      'banner_color', cu.banner_color,
                      'profile_theme_primary', cu.profile_theme_primary,
                      'profile_theme_accent', cu.profile_theme_accent,
                      'bio', cu.bio,
                      'tagline', cu.tagline,
                      'status', cu.status,
                      'custom_status', cu.custom_status,
                      'created_at', cu.created_at,
                      'last_seen', cu.last_seen,
                      'pronouns', cu.pronouns,
                      'is_bot', cu.is_bot
                    )
                  )
                  ORDER BY c.created_at ASC
                )
                FROM (
                  SELECT *
                  FROM public.user_profile_post_comments
                  WHERE post_id = p.id
                  ORDER BY created_at DESC
                  LIMIT 5
                ) c
                JOIN public.users cu ON cu.id = c.user_id
              ),
              '[]'::json
            ),
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
              'tagline', u.tagline,
              'status', u.status,
              'custom_status', u.custom_status,
              'created_at', u.created_at,
              'last_seen', u.last_seen,
              'pronouns', u.pronouns,
              'is_bot', u.is_bot
            )
          )
          ORDER BY p.created_at DESC
        )
        FROM (
          SELECT *
          FROM public.user_profile_posts
          WHERE user_id = _target_user_id
          ORDER BY created_at DESC
          LIMIT 20
        ) p
        JOIN public.users u ON u.id = p.user_id
      ),
      '[]'::json
    ),
    'shared_server_ids', _shared_server_ids,
    'aura_summary', public.achievement_summary_for_user(_target_user_id),
    'declined_at', (
      SELECT dfr.declined_at
      FROM public.declined_friend_requests dfr
      WHERE dfr.requester_id = _requesting_user_id
        AND dfr.addressee_id = _target_user_id
      ORDER BY dfr.declined_at DESC
      LIMIT 1
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.profile(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile(uuid, uuid, uuid[]) TO anon, authenticated;

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
        SELECT ma.message_id, json_agg(row_to_json(ma)) AS attachments
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
        SELECT rm.id, rm.user_id, rm.content
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
      ),
      multi_reply_targets AS (
        SELECT mrt.message_id, mrt.reply_to_id, mrt.created_at
        FROM public.message_reply_targets mrt
        JOIN limited_messages lm ON lm.id = mrt.message_id
        JOIN public.messages replied ON replied.id = mrt.reply_to_id
        WHERE replied.channel_id = lm.channel_id
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (replied.user_id = ANY(_blocked_user_ids))
          )
      ),
      multi_replies_by_message AS (
        SELECT
          mrt.message_id,
          array_agg(mrt.reply_to_id ORDER BY mrt.created_at ASC) AS reply_to_ids,
          json_agg(
            json_build_object(
              'id', replied.id,
              'content', replied.content,
              'user_id',
              CASE
                WHEN cc.ghost_mode = true
                  AND COALESCE(sm_reply.role, 'member'::public.server_role) NOT IN ('owner', 'admin')
                THEN 'ghost_' || substr(md5(replied.user_id::text || ':' || _channel_id::text || ':v1'), 1, 24)
                ELSE replied.user_id::text
              END,
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
            )
            ORDER BY mrt.created_at ASC
          ) AS reply_to_list
        FROM multi_reply_targets mrt
        JOIN public.messages replied ON replied.id = mrt.reply_to_id
        JOIN public.users ru ON ru.id = replied.user_id
        JOIN channel_ctx cc ON true
        LEFT JOIN public.server_members sm_reply
          ON sm_reply.server_id = cc.server_id
         AND sm_reply.user_id = replied.user_id
         AND COALESCE(sm_reply.is_banned, false) = false
        GROUP BY mrt.message_id
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
          (lm.user_id = _user_id) AS is_own,
          lm.content,
          lm.reply_to_id,
          rb.reply_to,
          COALESCE(mrb.reply_to_ids, CASE WHEN lm.reply_to_id IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[lm.reply_to_id] END) AS reply_to_ids,
          COALESCE(mrb.reply_to_list, CASE WHEN rb.reply_to IS NULL THEN '[]'::json ELSE json_build_array(rb.reply_to) END) AS reply_to_list,
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
        LEFT JOIN multi_replies_by_message mrb ON mrb.message_id = lm.id
      ) t
    ),
    '[]'::json
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_channel_messages_secure(uuid, uuid, integer, timestamptz, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_channel_messages_secure(uuid, uuid, integer, timestamptz, uuid[]) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
