-- Support replying to multiple direct/group DM messages while preserving
-- direct_messages.reply_to_id for legacy single-reply compatibility.

CREATE TABLE IF NOT EXISTS public.direct_message_reply_targets (
  message_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  reply_to_id uuid NOT NULL REFERENCES public.direct_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, reply_to_id),
  CONSTRAINT direct_message_reply_targets_no_self_reply CHECK (message_id <> reply_to_id)
);

CREATE INDEX IF NOT EXISTS idx_direct_message_reply_targets_reply_to_id
  ON public.direct_message_reply_targets (reply_to_id);

ALTER TABLE public.direct_message_reply_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DM reply targets viewable by conversation participants" ON public.direct_message_reply_targets;
CREATE POLICY "DM reply targets viewable by conversation participants"
  ON public.direct_message_reply_targets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.direct_messages dm
      JOIN public.dm_participants dp ON dp.conversation_id = dm.conversation_id
      WHERE dm.id = direct_message_reply_targets.message_id
        AND dp.user_id = public.requesting_user_id()
    )
  );

REVOKE ALL ON public.direct_message_reply_targets FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.direct_message_reply_targets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_message_reply_targets TO service_role;

CREATE OR REPLACE FUNCTION public.get_dm_messages_by_ids_secure(
  _message_ids uuid[],
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
          dm.reply_to_id,
          dm.edited_at,
          dm.created_at,
          json_build_object(
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
          ) AS sender
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
$$;

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
SET search_path = public, pg_temp
AS $$
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
            AND (
              _before_id IS NULL
              OR dm.created_at < _before_created_at
              OR (dm.created_at = _before_created_at AND dm.id < _before_id)
            )
            AND NOT EXISTS (
              SELECT 1
              FROM public.friendships f
              WHERE f.status = 'blocked'
                AND (
                  (f.requester_id = _user_id AND f.addressee_id = dm.sender_id)
                  OR (f.requester_id = dm.sender_id AND f.addressee_id = _user_id)
                )
            )
          ORDER BY dm.created_at DESC, dm.id DESC
          LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 100)
        )
        SELECT json_agg(
          json_build_object(
            'id', p.id,
            'conversation_id', p.conversation_id,
            'sender_id', p.sender_id,
            'content', p.content,
            'reply_to_id', p.reply_to_id,
            'reply_to_ids', COALESCE(
              (
                SELECT json_agg(mrt.reply_to_id ORDER BY mrt.created_at ASC)
                FROM public.direct_message_reply_targets mrt
                WHERE mrt.message_id = p.id
              ),
              CASE WHEN p.reply_to_id IS NOT NULL THEN json_build_array(p.reply_to_id) ELSE '[]'::json END
            ),
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
                SELECT json_agg(row_to_json(a) ORDER BY a.id ASC)
                FROM public.dm_attachments a
                WHERE a.message_id = p.id
              ),
              '[]'::json
            ),
            'reactions', COALESCE(
              (
                SELECT json_agg(row_to_json(r) ORDER BY r.id ASC)
                FROM public.dm_reactions r
                WHERE r.message_id = p.id
              ),
              '[]'::json
            ),
            'reply_to', CASE WHEN reply.id IS NULL THEN NULL ELSE json_build_object(
              'id', reply.id,
              'conversation_id', reply.conversation_id,
              'sender_id', reply.sender_id,
              'content', reply.content,
              'reply_to_id', reply.reply_to_id,
              'edited_at', reply.edited_at,
              'created_at', reply.created_at,
              'sender', row_to_json(reply_sender)
            ) END,
            'reply_to_list', COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'id', replied.id,
                    'conversation_id', replied.conversation_id,
                    'sender_id', replied.sender_id,
                    'content', replied.content,
                    'reply_to_id', replied.reply_to_id,
                    'edited_at', replied.edited_at,
                    'created_at', replied.created_at,
                    'sender', row_to_json(replied_sender)
                  )
                  ORDER BY mrt.created_at ASC
                )
                FROM public.direct_message_reply_targets mrt
                JOIN public.direct_messages replied ON replied.id = mrt.reply_to_id
                JOIN public.users replied_sender ON replied_sender.id = replied.sender_id
                WHERE mrt.message_id = p.id
                  AND replied.conversation_id = p.conversation_id
              ),
              CASE WHEN reply.id IS NOT NULL THEN json_build_array(json_build_object(
                'id', reply.id,
                'conversation_id', reply.conversation_id,
                'sender_id', reply.sender_id,
                'content', reply.content,
                'reply_to_id', reply.reply_to_id,
                'edited_at', reply.edited_at,
                'created_at', reply.created_at,
                'sender', row_to_json(reply_sender)
              )) ELSE '[]'::json END
            )
          )
          ORDER BY p.created_at DESC, p.id DESC
        )
        FROM page p
        JOIN public.users sender ON sender.id = p.sender_id
        LEFT JOIN public.direct_messages reply
          ON reply.id = p.reply_to_id
          AND reply.conversation_id = p.conversation_id
        LEFT JOIN public.users reply_sender ON reply_sender.id = reply.sender_id
      ),
      '[]'::json
    )
  );
END;
$$;

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
SET search_path = public, pg_temp
AS $$
DECLARE
  payload json;
BEGIN
  SELECT public.get_dm_bootstrap_secure(_conversation_id, _user_id, _limit, _before_id)
  INTO payload;
  RETURN COALESCE(payload->'messages', '[]'::json);
END;
$$;

DROP FUNCTION IF EXISTS public.send_dm(uuid, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.send_dm(uuid, uuid, text, uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.send_dm(
  _conversation_id uuid,
  _sender_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL::uuid,
  _reply_to_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_message_id uuid;
  other_user_id uuid;
  result json;
  recent_count_1m integer;
  recent_count_10s integer;
  convo_count_10s integer;
  sender_created_at timestamptz;
  normalized_reply_to_ids uuid[];
  primary_reply_to_id uuid;
  reply_to_list json;
BEGIN
  IF NOT public.verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  SELECT u.created_at INTO sender_created_at
  FROM public.users u
  WHERE u.id = _sender_id;

  IF sender_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF sender_created_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'DMs are temporarily restricted for new accounts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  SELECT count(*) INTO recent_count_1m
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND created_at > now() - interval '1 minute';

  IF recent_count_1m >= 20 THEN
    RAISE EXCEPTION 'Rate limited: too many DM messages';
  END IF;

  SELECT count(*) INTO recent_count_10s
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND created_at > now() - interval '10 seconds';

  IF recent_count_10s >= 6 THEN
    RAISE EXCEPTION 'Rate limited: sending DMs too quickly';
  END IF;

  SELECT count(*) INTO convo_count_10s
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND conversation_id = _conversation_id
    AND created_at > now() - interval '10 seconds';

  IF convo_count_10s >= 4 THEN
    RAISE EXCEPTION 'Rate limited: too many messages in this DM';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.direct_messages dm
    WHERE dm.sender_id = _sender_id
      AND dm.conversation_id = _conversation_id
      AND dm.content = _content
      AND dm.created_at > now() - interval '30 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate DM blocked';
  END IF;

  SELECT dp.user_id INTO other_user_id
  FROM public.dm_participants dp
  WHERE dp.conversation_id = _conversation_id
    AND dp.user_id <> _sender_id
  LIMIT 1;

  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Conversation has no recipient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'blocked'
      AND (
        (f.requester_id = _sender_id AND f.addressee_id = other_user_id)
        OR (f.requester_id = other_user_id AND f.addressee_id = _sender_id)
      )
  ) THEN
    RAISE EXCEPTION 'Cannot send DM to this user';
  END IF;

  SELECT array_agg(DISTINCT reply_id)
  INTO normalized_reply_to_ids
  FROM unnest(COALESCE(_reply_to_ids, ARRAY[]::uuid[]) || ARRAY[_reply_to_id]) AS reply_ids(reply_id)
  WHERE reply_id IS NOT NULL;

  IF COALESCE(array_length(normalized_reply_to_ids, 1), 0) > 5 THEN
    RAISE EXCEPTION 'Too many reply references. Maximum 5 replies per message.';
  END IF;

  primary_reply_to_id := COALESCE(_reply_to_id, normalized_reply_to_ids[1]);

  IF COALESCE(array_length(normalized_reply_to_ids, 1), 0) > 0 THEN
    IF EXISTS (
      SELECT 1
      FROM unnest(normalized_reply_to_ids) AS reply_ids(reply_id)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.direct_messages dm
        WHERE dm.id = reply_id
          AND dm.conversation_id = _conversation_id
      )
    ) THEN
      RAISE EXCEPTION 'Invalid reply reference.';
    END IF;
  END IF;

  INSERT INTO public.direct_messages (conversation_id, sender_id, content, reply_to_id)
  VALUES (_conversation_id, _sender_id, _content, primary_reply_to_id)
  RETURNING id INTO new_message_id;

  IF COALESCE(array_length(normalized_reply_to_ids, 1), 0) > 0 THEN
    INSERT INTO public.direct_message_reply_targets (message_id, reply_to_id)
    SELECT new_message_id, reply_id
    FROM unnest(normalized_reply_to_ids) AS reply_ids(reply_id)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT COALESCE(json_agg(
    json_build_object(
      'id', replied.id,
      'conversation_id', replied.conversation_id,
      'sender_id', replied.sender_id,
      'content', replied.content,
      'reply_to_id', replied.reply_to_id,
      'edited_at', replied.edited_at,
      'created_at', replied.created_at,
      'sender', row_to_json(replied_sender)
    )
    ORDER BY mrt.created_at ASC
  ), '[]'::json)
  INTO reply_to_list
  FROM public.direct_message_reply_targets mrt
  JOIN public.direct_messages replied ON replied.id = mrt.reply_to_id
  JOIN public.users replied_sender ON replied_sender.id = replied.sender_id
  WHERE mrt.message_id = new_message_id;

  SELECT json_build_object(
    'id', dm.id,
    'conversation_id', dm.conversation_id,
    'sender_id', dm.sender_id,
    'content', dm.content,
    'reply_to_id', dm.reply_to_id,
    'reply_to_ids', COALESCE(normalized_reply_to_ids, ARRAY[]::uuid[]),
    'reply_to_list', COALESCE(reply_to_list, '[]'::json),
    'created_at', dm.created_at,
    'edited_at', dm.edited_at
  )
  INTO result
  FROM public.direct_messages dm
  WHERE dm.id = new_message_id;

  RETURN result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_dm_messages_by_ids_secure(uuid[], uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dm_bootstrap_secure(uuid, uuid, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_dm_messages(uuid, uuid, integer, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_dm(uuid, uuid, text, uuid, uuid[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_dm_messages_by_ids_secure(uuid[], uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dm_bootstrap_secure(uuid, uuid, integer, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_dm_messages(uuid, uuid, integer, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_dm(uuid, uuid, text, uuid, uuid[]) TO authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;