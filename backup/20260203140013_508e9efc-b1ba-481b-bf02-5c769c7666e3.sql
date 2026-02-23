-- Create batch unread counts RPC to replace N+1 queries
-- This reduces 50+ queries to a single query per polling cycle

CREATE OR REPLACE FUNCTION public.get_all_channel_unread_counts(
  _user_id UUID,
  _channel_ids UUID[],
  _blocked_user_ids UUID[] DEFAULT '{}'::UUID[]
)
RETURNS TABLE(
  channel_id UUID,
  unread_count BIGINT,
  mention_count INTEGER,
  last_read_at TIMESTAMPTZ,
  last_read_message_id UUID,
  first_unread_message_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH channel_reads_data AS (
    SELECT 
      cr.channel_id,
      cr.last_read_at,
      cr.last_read_message_id,
      COALESCE(cr.mention_count, 0) AS mention_count
    FROM channel_reads cr
    WHERE cr.user_id = _user_id
      AND cr.channel_id = ANY(_channel_ids)
  ),
  unread_messages AS (
    SELECT 
      m.channel_id,
      COUNT(*) AS unread_count,
      MIN(m.id) AS first_unread_id
    FROM messages m
    LEFT JOIN channel_reads_data crd ON crd.channel_id = m.channel_id
    WHERE m.channel_id = ANY(_channel_ids)
      AND m.user_id != _user_id
      AND (crd.last_read_at IS NULL OR m.created_at > crd.last_read_at)
      AND (array_length(_blocked_user_ids, 1) IS NULL 
           OR m.user_id != ALL(_blocked_user_ids))
    GROUP BY m.channel_id
  )
  SELECT 
    c.id AS channel_id,
    COALESCE(um.unread_count, 0)::BIGINT AS unread_count,
    COALESCE(crd.mention_count, 0)::INTEGER AS mention_count,
    crd.last_read_at,
    crd.last_read_message_id,
    um.first_unread_id AS first_unread_message_id
  FROM unnest(_channel_ids) AS c(id)
  LEFT JOIN channel_reads_data crd ON crd.channel_id = c.id
  LEFT JOIN unread_messages um ON um.channel_id = c.id;
END;
$$;

-- Grant execute permission to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_all_channel_unread_counts(UUID, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_channel_unread_counts(UUID, UUID[], UUID[]) TO anon;