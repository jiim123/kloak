-- Mark a channel as read (custom-auth friendly).
-- Uses SECURITY DEFINER to bypass RLS because the app does not use Supabase Auth (JWT).

CREATE OR REPLACE FUNCTION public.mark_channel_read(
  _channel_id uuid,
  _user_id uuid,
  _last_read_message_id uuid,
  _last_read_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  VALUES (_channel_id, _user_id, _last_read_message_id, _last_read_at, 0)
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = EXCLUDED.last_read_message_id,
    last_read_at = EXCLUDED.last_read_at,
    mention_count = 0;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_channel_read(uuid, uuid, uuid, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_channel_read(uuid, uuid, uuid, timestamptz) TO authenticated;

