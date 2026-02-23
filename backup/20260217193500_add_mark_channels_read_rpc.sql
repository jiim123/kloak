-- Mark multiple channels as read in a single RPC (custom-auth friendly).
-- Uses SECURITY DEFINER to bypass RLS because the app does not use Supabase Auth (JWT).
-- This avoids N+1 client queries (fetch latest message per channel) and reduces request spam
-- when marking an entire server as read.

CREATE OR REPLACE FUNCTION public.mark_channels_read(
  _channel_ids uuid[],
  _user_id uuid,
  _last_read_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- For each channel, pick the latest message id (if any) and upsert channel_reads.
  WITH latest AS (
    SELECT DISTINCT ON (m.channel_id)
      m.channel_id,
      m.id AS last_message_id
    FROM public.messages m
    WHERE m.channel_id = ANY(_channel_ids)
    ORDER BY m.channel_id, m.created_at DESC
  )
  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  SELECT l.channel_id, _user_id, l.last_message_id, _last_read_at, 0
  FROM latest l
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at,
    mention_count = 0;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_channels_read(uuid[], uuid, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_channels_read(uuid[], uuid, timestamptz) TO authenticated;

