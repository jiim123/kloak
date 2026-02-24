-- Performance optimization for channel bootstrap/message reads.
-- Goals:
-- 1) Avoid per-message N+1 subqueries for attachments/reactions/replies.
-- 2) Add supporting indexes for common filters/joins.
-- 3) Preserve existing security checks exactly.

CREATE INDEX IF NOT EXISTS idx_messages_channel_created_at_desc
  ON public.messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id
  ON public.message_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_reactions_message_id
  ON public.reactions(message_id);

CREATE INDEX IF NOT EXISTS idx_channel_permissions_channel_id
  ON public.channel_permissions(channel_id);

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
      WITH limited_messages AS (
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
          json_agg(row_to_json(r)) AS reactions
        FROM public.reactions r
        JOIN limited_messages lm ON lm.id = r.message_id
        GROUP BY r.message_id
      ),
      reply_targets AS (
        SELECT DISTINCT lm.reply_to_id AS id
        FROM limited_messages lm
        WHERE lm.reply_to_id IS NOT NULL
      ),
      replies_by_id AS (
        SELECT
          rm.id,
          json_build_object(
            'id', rm.id,
            'content', rm.content,
            'user', row_to_json(ru)
          ) AS reply_to
        FROM public.messages rm
        JOIN public.users ru ON ru.id = rm.user_id
        JOIN reply_targets rt ON rt.id = rm.id
        WHERE public.can_access_channel(rm.channel_id, _user_id)
          AND (
            COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
            OR NOT (rm.user_id = ANY(_blocked_user_ids))
          )
      )
      SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
      FROM (
        SELECT
          lm.id,
          lm.channel_id,
          lm.user_id,
          lm.content,
          lm.reply_to_id,
          rb.reply_to,
          lm.is_pinned,
          lm.edited_at,
          lm.created_at,
          row_to_json(u) AS "user",
          COALESCE(abm.attachments, '[]'::json) AS attachments,
          COALESCE(rbm.reactions, '[]'::json) AS reactions
        FROM limited_messages lm
        JOIN public.users u ON u.id = lm.user_id
        LEFT JOIN attachments_by_message abm ON abm.message_id = lm.id
        LEFT JOIN reactions_by_message rbm ON rbm.message_id = lm.id
        LEFT JOIN replies_by_id rb ON rb.id = lm.reply_to_id
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
