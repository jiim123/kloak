-- When read receipts are sent over websocket, the client clock can be behind
-- the database clock that produced messages.created_at. If last_read_at is
-- earlier than the latest read message, unread RPCs can resurrect the indicator.

CREATE OR REPLACE FUNCTION public.persist_channel_read_broadcast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime, pg_temp
AS $$
DECLARE
  _row jsonb;
  _user_id uuid;
  _topic_user_id uuid;
  _channel_id uuid;
  _last_read_message_id uuid;
  _last_read_at timestamptz;
  _message_created_at timestamptz;
BEGIN
  IF NEW.extension IS DISTINCT FROM 'broadcast'
     OR NEW.event IS DISTINCT FROM 'channel_reads'
     OR NEW.topic !~ '^user:[0-9a-fA-F-]{36}$' THEN
    RETURN NEW;
  END IF;

  _row := COALESCE(NEW.payload->'new', NEW.payload);
  IF _row IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    _topic_user_id := substring(NEW.topic from 6)::uuid;
    _user_id := (_row->>'user_id')::uuid;
    _channel_id := (_row->>'channel_id')::uuid;
    _last_read_message_id := NULLIF(_row->>'last_read_message_id', '')::uuid;
    _last_read_at := COALESCE(NULLIF(_row->>'last_read_at', '')::timestamptz, now());
  EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
  END;

  IF _user_id IS NULL OR _channel_id IS NULL OR _topic_user_id IS DISTINCT FROM _user_id THEN
    RETURN NEW;
  END IF;

  IF _last_read_message_id IS NOT NULL THEN
    SELECT m.created_at
    INTO _message_created_at
    FROM public.messages m
    WHERE m.id = _last_read_message_id
      AND m.channel_id = _channel_id;

    IF _message_created_at IS NULL THEN
      _last_read_message_id := NULL;
    ELSE
      _last_read_at := GREATEST(_last_read_at, _message_created_at + interval '1 millisecond');
    END IF;
  END IF;

  INSERT INTO public.channel_reads (channel_id, user_id, last_read_message_id, last_read_at, mention_count)
  VALUES (_channel_id, _user_id, _last_read_message_id, _last_read_at, 0)
  ON CONFLICT (channel_id, user_id)
  DO UPDATE SET
    last_read_message_id = CASE
      WHEN EXCLUDED.last_read_at >= COALESCE(public.channel_reads.last_read_at, '-infinity'::timestamptz)
        THEN COALESCE(EXCLUDED.last_read_message_id, public.channel_reads.last_read_message_id)
      ELSE public.channel_reads.last_read_message_id
    END,
    last_read_at = GREATEST(COALESCE(public.channel_reads.last_read_at, '-infinity'::timestamptz), EXCLUDED.last_read_at),
    mention_count = 0;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.persist_channel_read_broadcast() FROM PUBLIC;
