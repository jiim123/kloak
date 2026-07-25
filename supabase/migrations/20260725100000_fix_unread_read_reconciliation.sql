-- Keep unread/mention state authoritative after socket-based read receipts.
-- Mention counters can be incremented asynchronously after a user has already
-- read the message, so unread RPCs must derive mention_count from unread
-- mention rows instead of trusting channel_reads.mention_count.

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
  first_unread_message_id uuid
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
  )
  SELECT
    c.id AS channel_id,
    COALESCE(uc.unread_count, 0)::bigint AS unread_count,
    COALESCE(umc.mention_count, 0)::integer AS mention_count,
    crd.last_read_at,
    crd.last_read_message_id,
    fu.message_id AS first_unread_message_id
  FROM unnest(_channel_ids) AS c(id)
  LEFT JOIN channel_reads_data crd ON crd.channel_id = c.id
  LEFT JOIN unread_counts uc ON uc.channel_id = c.id
  LEFT JOIN unread_mentions umc ON umc.channel_id = c.id
  LEFT JOIN first_unread fu ON fu.channel_id = c.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_server_unread_summary(
  _user_id uuid,
  _blocked_user_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS TABLE(
  server_id uuid,
  unread_count bigint,
  mention_count integer,
  channel_ids uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN QUERY
  WITH user_servers AS (
    SELECT sm.server_id, sm.role
    FROM public.server_members sm
    WHERE sm.user_id = _user_id
      AND COALESCE(sm.is_banned, false) = false
  ),
  visible_channels AS (
    SELECT c.id AS channel_id, c.server_id
    FROM public.channels c
    JOIN user_servers us ON us.server_id = c.server_id
    WHERE COALESCE(c.is_private, false) = false
      OR us.role IN ('owner', 'admin')
      OR EXISTS (
        SELECT 1
        FROM public.channel_members cm
        WHERE cm.channel_id = c.id
          AND cm.user_id = _user_id
      )
  ),
  channel_reads_data AS (
    SELECT
      cr.channel_id,
      cr.last_read_at
    FROM public.channel_reads cr
    JOIN visible_channels vc ON vc.channel_id = cr.channel_id
    WHERE cr.user_id = _user_id
  ),
  unread_messages AS (
    SELECT vc.server_id, vc.channel_id, m.id AS message_id
    FROM visible_channels vc
    JOIN public.messages m ON m.channel_id = vc.channel_id
    LEFT JOIN channel_reads_data crd ON crd.channel_id = vc.channel_id
    WHERE m.user_id <> _user_id
      AND (crd.last_read_at IS NULL OR m.created_at > crd.last_read_at)
      AND (
        array_length(_blocked_user_ids, 1) IS NULL
        OR m.user_id <> ALL(_blocked_user_ids)
      )
  ),
  unread_by_server AS (
    SELECT um.server_id, COUNT(*)::bigint AS unread_count
    FROM unread_messages um
    GROUP BY um.server_id
  ),
  mentions_by_server AS (
    SELECT um.server_id, COUNT(*)::integer AS mention_count
    FROM unread_messages um
    JOIN public.mentions mn ON mn.message_id = um.message_id
    WHERE mn.user_id = _user_id
    GROUP BY um.server_id
  ),
  channels_by_server AS (
    SELECT
      um.server_id,
      array_agg(DISTINCT um.channel_id ORDER BY um.channel_id) AS channel_ids
    FROM unread_messages um
    GROUP BY um.server_id
  )
  SELECT
    us.server_id,
    COALESCE(ubs.unread_count, 0)::bigint AS unread_count,
    COALESCE(mbs.mention_count, 0)::integer AS mention_count,
    COALESCE(cbs.channel_ids, ARRAY[]::uuid[]) AS channel_ids
  FROM user_servers us
  LEFT JOIN unread_by_server ubs ON ubs.server_id = us.server_id
  LEFT JOIN mentions_by_server mbs ON mbs.server_id = us.server_id
  LEFT JOIN channels_by_server cbs ON cbs.server_id = us.server_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_channel_unread_counts(uuid, uuid[], uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_channel_unread_counts(uuid, uuid[], uuid[]) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.get_user_server_unread_summary(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_server_unread_summary(uuid, uuid[]) TO anon, authenticated;
