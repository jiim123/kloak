-- Reduce channel-switch request fan-out by returning reply previews inline.
-- This lets the client bootstrap a channel in one RPC instead of:
--   1) get_channel_messages_secure
--   2) get_message_replies_secure

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
          CASE
            WHEN m.reply_to_id IS NULL THEN NULL::json
            ELSE (
              SELECT json_build_object(
                'id', rm.id,
                'content', rm.content,
                'user', row_to_json(ru)
              )
              FROM public.messages rm
              JOIN public.users ru ON ru.id = rm.user_id
              WHERE rm.id = m.reply_to_id
                AND public.can_access_channel(rm.channel_id, _user_id)
                AND (
                  COALESCE(array_length(_blocked_user_ids, 1), 0) = 0
                  OR NOT (rm.user_id = ANY(_blocked_user_ids))
                )
            )
          END AS reply_to,
          m.is_pinned,
          m.edited_at,
          m.created_at,
          row_to_json(u) AS "user",
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
              SELECT json_agg(row_to_json(r))
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

REVOKE EXECUTE ON FUNCTION public.get_channel_messages_secure(uuid, uuid, integer, timestamptz, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_channel_messages_secure(uuid, uuid, integer, timestamptz, uuid[]) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
