-- Make read receipts durable through explicit RPC writes and prevent older/client
-- timestamps from moving the read cursor behind already-read messages.

CREATE OR REPLACE FUNCTION public.mark_channel_read(
  _channel_id uuid,
  _user_id uuid,
  _last_read_message_id uuid,
  _last_read_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _message_created_at timestamptz;
  _effective_read_at timestamptz := COALESCE(_last_read_at, now());
  _effective_message_id uuid := _last_read_message_id;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _effective_message_id IS NOT NULL THEN
    SELECT m.created_at
    INTO _message_created_at
    FROM public.messages m
    WHERE m.id = _effective_message_id
      AND m.channel_id = _channel_id;

    IF _message_created_at IS NULL THEN
      _effective_message_id := NULL;
    ELSE
      _effective_read_at := GREATEST(_effective_read_at, _message_created_at + interval '1 millisecond');
    END IF;
  END IF;

  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  VALUES (_channel_id, _user_id, _effective_message_id, _effective_read_at, 0)
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = CASE
      WHEN EXCLUDED.last_read_at >= COALESCE(public.channel_reads.last_read_at, '-infinity'::timestamptz)
        THEN COALESCE(EXCLUDED.last_read_message_id, public.channel_reads.last_read_message_id)
      ELSE public.channel_reads.last_read_message_id
    END,
    last_read_at = GREATEST(COALESCE(public.channel_reads.last_read_at, '-infinity'::timestamptz), EXCLUDED.last_read_at),
    mention_count = 0;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_channels_read(
  _channel_ids uuid[],
  _user_id uuid,
  _last_read_at timestamptz DEFAULT now()
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  WITH latest AS (
    SELECT DISTINCT ON (m.channel_id)
      m.channel_id,
      m.id AS last_message_id,
      GREATEST(COALESCE(_last_read_at, now()), m.created_at + interval '1 millisecond') AS effective_read_at
    FROM public.messages m
    WHERE m.channel_id = ANY(_channel_ids)
    ORDER BY m.channel_id, m.created_at DESC
  )
  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  SELECT l.channel_id, _user_id, l.last_message_id, l.effective_read_at, 0
  FROM latest l
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = CASE
      WHEN EXCLUDED.last_read_at >= COALESCE(public.channel_reads.last_read_at, '-infinity'::timestamptz)
        THEN COALESCE(EXCLUDED.last_read_message_id, public.channel_reads.last_read_message_id)
      ELSE public.channel_reads.last_read_message_id
    END,
    last_read_at = GREATEST(COALESCE(public.channel_reads.last_read_at, '-infinity'::timestamptz), EXCLUDED.last_read_at),
    mention_count = 0;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_dm_read(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _latest_message_at timestamptz;
  _effective_read_at timestamptz := now();
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT MAX(dm.created_at)
  INTO _latest_message_at
  FROM public.direct_messages dm
  WHERE dm.conversation_id = _conversation_id;

  IF _latest_message_at IS NOT NULL THEN
    _effective_read_at := GREATEST(_effective_read_at, _latest_message_at + interval '1 millisecond');
  END IF;

  UPDATE public.dm_participants
  SET last_read_at = GREATEST(COALESCE(last_read_at, '-infinity'::timestamptz), _effective_read_at)
  WHERE conversation_id = _conversation_id
    AND user_id = _user_id;

  RETURN FOUND;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_channel_read(uuid, uuid, uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_channel_read(uuid, uuid, uuid, timestamptz) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_channels_read(uuid[], uuid, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_channels_read(uuid[], uuid, timestamptz) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.mark_dm_read(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_dm_read(uuid, uuid) TO anon, authenticated;