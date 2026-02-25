-- Extend Broadcast-based realtime to polls + unread surfaces.

CREATE OR REPLACE FUNCTION public.broadcast_channel_poll_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _channel_id uuid;
  _payload jsonb;
BEGIN
  _channel_id := COALESCE(NEW.channel_id, OLD.channel_id);

  IF _channel_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
        'channel_id', OLD.channel_id,
        'message_id', OLD.message_id
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'message_id', NEW.message_id,
        'channel_id', NEW.channel_id,
        'created_by', NEW.created_by,
        'question', NEW.question,
        'options', NEW.options,
        'allow_multiple', NEW.allow_multiple,
        'ends_at', NEW.ends_at,
        'is_closed', NEW.is_closed,
        'results', NEW.results,
        'total_votes', NEW.total_votes,
        'created_at', NEW.created_at
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'polls',
    'chat:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_user_channel_read_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _payload jsonb;
BEGIN
  _user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
        'user_id', OLD.user_id,
        'channel_id', OLD.channel_id,
        'last_read_message_id', OLD.last_read_message_id,
        'last_read_at', OLD.last_read_at
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'channel_id', NEW.channel_id,
        'last_read_message_id', NEW.last_read_message_id,
        'last_read_at', NEW.last_read_at
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'channel_reads',
    'user:' || _user_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_user_dm_participant_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _user_id uuid;
  _payload jsonb;
BEGIN
  _user_id := COALESCE(NEW.user_id, OLD.user_id);

  IF _user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
        'user_id', OLD.user_id,
        'conversation_id', OLD.conversation_id,
        'last_read_at', OLD.last_read_at
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'conversation_id', NEW.conversation_id,
        'last_read_at', NEW.last_read_at
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'dm_participants',
    'user:' || _user_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_channel_poll_change ON public.polls;
CREATE TRIGGER trg_broadcast_channel_poll_change
AFTER INSERT OR UPDATE OR DELETE ON public.polls
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_channel_poll_change();

DROP TRIGGER IF EXISTS trg_broadcast_user_channel_read_change ON public.channel_reads;
CREATE TRIGGER trg_broadcast_user_channel_read_change
AFTER INSERT OR UPDATE OR DELETE ON public.channel_reads
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_user_channel_read_change();

DROP TRIGGER IF EXISTS trg_broadcast_user_dm_participant_change ON public.dm_participants;
CREATE TRIGGER trg_broadcast_user_dm_participant_change
AFTER INSERT OR UPDATE OR DELETE ON public.dm_participants
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_user_dm_participant_change();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
