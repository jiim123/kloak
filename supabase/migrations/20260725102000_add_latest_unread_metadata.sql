-- Give socket-based read receipts enough DB-derived metadata to mark sidebar and
-- bulk text-channel reads past the latest unread message, even when the UI call
-- site does not have the message list loaded.

DROP FUNCTION IF EXISTS public.get_all_channel_unread_counts(uuid, uuid[], uuid[]);

CREATE OR REPLACE FUNCTION public.get_all_channel_unread_counts(
  _user_id uuid,
  _channel_ids uuid[],
  _blocked_user_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE(
  channel_id uuid,
  unread_count bigint,
  mention_count integer,
  last_read_at timestamptz,
  last_read_message_id uuid,
  first_unread_message_id uuid,
  latest_unread_message_id uuid,
  latest_unread_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  WITH channel_reads_data AS (
    SELECT
      cr.channel_id,
      cr.last_read_at,
      cr.last_read_message_id
    FROM public.channel_reads cr
    WHERE cr.user_id = _user_id
      AND cr.channel_id = ANY(_channel_ids)
  ),
  unread_messages AS (
    SELECT
      m.channel_id,
      m.id AS message_id,
      m.created_at
    FROM public.messages m
    LEFT JOIN channel_reads_data crd ON crd.channel_id = m.channel_id
    WHERE m.channel_id = ANY(_channel_ids)
      AND m.user_id <> _user_id
      AND (crd.last_read_at IS NULL OR m.created_at > crd.last_read_at)
      AND (
        array_length(_blocked_user_ids, 1) IS NULL
        OR m.user_id <> ALL(_blocked_user_ids)
      )
  ),
  unread_counts AS (
    SELECT
      um.channel_id,
      COUNT(*) AS unread_count
    FROM unread_messages um
    GROUP BY um.channel_id
  ),
  unread_mentions AS (
    SELECT
      um.channel_id,
      COUNT(*)::integer AS mention_count
    FROM unread_messages um
    JOIN public.mentions mn ON mn.message_id = um.message_id
    WHERE mn.user_id = _user_id
    GROUP BY um.channel_id
  ),
  first_unread AS (
    SELECT DISTINCT ON (um.channel_id)
      um.channel_id,
      um.message_id
    FROM unread_messages um
    ORDER BY um.channel_id, um.created_at ASC
  ),
  latest_unread AS (
    SELECT DISTINCT ON (um.channel_id)
      um.channel_id,
      um.message_id,
      um.created_at
    FROM unread_messages um
    ORDER BY um.channel_id, um.created_at DESC
  )
  SELECT
    c.id AS channel_id,
    COALESCE(uc.unread_count, 0)::bigint AS unread_count,
    COALESCE(umc.mention_count, 0)::integer AS mention_count,
    crd.last_read_at,
    crd.last_read_message_id,
    fu.message_id AS first_unread_message_id,
    lu.message_id AS latest_unread_message_id,
    lu.created_at AS latest_unread_created_at
  FROM unnest(_channel_ids) AS c(id)
  LEFT JOIN channel_reads_data crd ON crd.channel_id = c.id
  LEFT JOIN unread_counts uc ON uc.channel_id = c.id
  LEFT JOIN unread_mentions umc ON umc.channel_id = c.id
  LEFT JOIN first_unread fu ON fu.channel_id = c.id
  LEFT JOIN latest_unread lu ON lu.channel_id = c.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_channel_unread_counts(uuid, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_channel_unread_counts(uuid, uuid[], uuid[]) TO anon, authenticated;
