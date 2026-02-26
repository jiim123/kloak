-- Route direct message realtime through Broadcast on user-scoped topics.

CREATE OR REPLACE FUNCTION public.broadcast_user_dm_message_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _conversation_id uuid;
  _payload jsonb;
  _participant record;
BEGIN
  _conversation_id := COALESCE(NEW.conversation_id, OLD.conversation_id);

  IF _conversation_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
        'conversation_id', OLD.conversation_id
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'content', NEW.content,
        'reply_to_id', NEW.reply_to_id,
        'edited_at', NEW.edited_at,
        'created_at', NEW.created_at
      )
    );
  END IF;

  FOR _participant IN
    SELECT dp.user_id
    FROM public.dm_participants dp
    WHERE dp.conversation_id = _conversation_id
  LOOP
    PERFORM realtime.send(
      _payload,
      'direct_messages',
      'user:' || _participant.user_id::text,
      false
    );
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_user_dm_message_change ON public.direct_messages;
CREATE TRIGGER trg_broadcast_user_dm_message_change
AFTER INSERT OR UPDATE OR DELETE ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_user_dm_message_change();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
