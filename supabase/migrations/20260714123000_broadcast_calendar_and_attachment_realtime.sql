-- Move remaining live calendar-detail and attachment updates to Realtime Broadcast.

CREATE OR REPLACE FUNCTION public.broadcast_calendar_event_detail_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _event_id uuid;
  _payload jsonb;
BEGIN
  _event_id := COALESCE(NEW.event_id, OLD.event_id);

  IF _event_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  _payload := jsonb_build_object(
    'op', TG_OP,
    'event_id', _event_id
  );

  PERFORM realtime.send(
    _payload,
    TG_TABLE_NAME,
    'calendar-event:' || _event_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_message_attachment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _message_id uuid;
  _channel_id uuid;
  _row jsonb;
BEGIN
  _message_id := COALESCE(NEW.message_id, OLD.message_id);

  IF _message_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT m.channel_id
  INTO _channel_id
  FROM public.messages m
  WHERE m.id = _message_id;

  IF _channel_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _row := jsonb_build_object(
      'id', OLD.id,
      'message_id', OLD.message_id
    );
  ELSE
    _row := jsonb_build_object(
      'id', NEW.id,
      'message_id', NEW.message_id,
      'file_name', NEW.file_name,
      'file_url', NEW.file_url,
      'file_type', NEW.file_type,
      'file_size', NEW.file_size,
      'width', NEW.width,
      'height', NEW.height,
      'is_spoiler', NEW.is_spoiler,
      'is_voice_message', NEW.is_voice_message,
      'waveform', NEW.waveform
    );
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'op', TG_OP,
      CASE WHEN TG_OP = 'DELETE' THEN 'old' ELSE 'new' END,
      _row
    ),
    'message_attachments',
    'chat:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_dm_attachment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _message_id uuid;
  _conversation_id uuid;
  _participant record;
  _row jsonb;
BEGIN
  _message_id := COALESCE(NEW.message_id, OLD.message_id);

  IF _message_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT dm.conversation_id
  INTO _conversation_id
  FROM public.direct_messages dm
  WHERE dm.id = _message_id;

  IF _conversation_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _row := jsonb_build_object(
      'id', OLD.id,
      'message_id', OLD.message_id
    );
  ELSE
    _row := jsonb_build_object(
      'id', NEW.id,
      'message_id', NEW.message_id,
      'file_name', NEW.file_name,
      'file_url', NEW.file_url,
      'file_type', NEW.file_type,
      'file_size', NEW.file_size,
      'width', NEW.width,
      'height', NEW.height
    );
  END IF;

  PERFORM realtime.send(
    jsonb_build_object(
      'op', TG_OP,
      'conversation_id', _conversation_id,
      CASE WHEN TG_OP = 'DELETE' THEN 'old' ELSE 'new' END,
      _row
    ),
    'dm_attachments',
    'dm:' || _conversation_id::text,
    false
  );

  FOR _participant IN
    SELECT dp.user_id
    FROM public.dm_participants dp
    WHERE dp.conversation_id = _conversation_id
  LOOP
    PERFORM realtime.send(
      jsonb_build_object(
        'op', TG_OP,
        'conversation_id', _conversation_id,
        CASE WHEN TG_OP = 'DELETE' THEN 'old' ELSE 'new' END,
        _row
      ),
      'dm_attachments',
      'user:' || _participant.user_id::text,
      false
    );
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_calendar_event_rsvp_change ON public.calendar_event_rsvps;
CREATE TRIGGER trg_broadcast_calendar_event_rsvp_change
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_event_rsvps
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_calendar_event_detail_change();

DROP TRIGGER IF EXISTS trg_broadcast_calendar_event_comment_change ON public.calendar_event_comments;
CREATE TRIGGER trg_broadcast_calendar_event_comment_change
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_event_comments
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_calendar_event_detail_change();

DROP TRIGGER IF EXISTS trg_broadcast_calendar_event_reaction_change ON public.calendar_event_reactions;
CREATE TRIGGER trg_broadcast_calendar_event_reaction_change
AFTER INSERT OR UPDATE OR DELETE ON public.calendar_event_reactions
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_calendar_event_detail_change();

DROP TRIGGER IF EXISTS trg_broadcast_message_attachment_change ON public.message_attachments;
CREATE TRIGGER trg_broadcast_message_attachment_change
AFTER INSERT OR UPDATE OR DELETE ON public.message_attachments
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_message_attachment_change();

DROP TRIGGER IF EXISTS trg_broadcast_dm_attachment_change ON public.dm_attachments;
CREATE TRIGGER trg_broadcast_dm_attachment_change
AFTER INSERT OR UPDATE OR DELETE ON public.dm_attachments
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_dm_attachment_change();

REVOKE EXECUTE ON FUNCTION public.broadcast_calendar_event_detail_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_message_attachment_change() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.broadcast_dm_attachment_change() FROM PUBLIC;
