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
AS $function$
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
      cr.last_read_at,
      COALESCE(cr.mention_count, 0) AS mention_count
    FROM public.channel_reads cr
    JOIN visible_channels vc ON vc.channel_id = cr.channel_id
    WHERE cr.user_id = _user_id
  ),
  unread_messages AS (
    SELECT vc.server_id, m.id
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
    SELECT vc.server_id, COALESCE(SUM(crd.mention_count), 0)::integer AS mention_count
    FROM visible_channels vc
    LEFT JOIN channel_reads_data crd ON crd.channel_id = vc.channel_id
    GROUP BY vc.server_id
  ),
  channels_by_server AS (
    SELECT
      vc.server_id,
      array_agg(vc.channel_id ORDER BY vc.channel_id) AS channel_ids
    FROM visible_channels vc
    GROUP BY vc.server_id
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
$function$;

REVOKE EXECUTE ON FUNCTION public.get_user_server_unread_summary(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_server_unread_summary(uuid, uuid[]) TO anon, authenticated;
