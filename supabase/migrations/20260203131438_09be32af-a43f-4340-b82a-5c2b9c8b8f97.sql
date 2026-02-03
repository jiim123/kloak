-- =====================================================
-- Query Performance Optimization Migration
-- Purpose: Batch DM unread counts + add composite indexes
-- =====================================================

-- RPC function to batch DM unread counts in a single query
-- Replaces N+1 pattern with single database call
CREATE OR REPLACE FUNCTION get_dm_unread_counts(_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  unread_count bigint,
  last_read_at timestamptz
)
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    dp.conversation_id,
    COALESCE(COUNT(dm.id) FILTER (
      WHERE dm.sender_id != _user_id 
      AND (dp.last_read_at IS NULL OR dm.created_at > dp.last_read_at)
    ), 0) as unread_count,
    dp.last_read_at
  FROM dm_participants dp
  LEFT JOIN direct_messages dm ON dm.conversation_id = dp.conversation_id
  WHERE dp.user_id = _user_id
  GROUP BY dp.conversation_id, dp.last_read_at;
$$;

GRANT EXECUTE ON FUNCTION get_dm_unread_counts TO anon, authenticated;

-- Composite index for message pagination (most common query pattern)
-- Optimizes: SELECT * FROM messages WHERE channel_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_messages_channel_created 
ON public.messages(channel_id, created_at DESC);

-- Composite index for DM pagination
-- Optimizes: SELECT * FROM direct_messages WHERE conversation_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_direct_messages_conv_created 
ON public.direct_messages(conversation_id, created_at DESC);