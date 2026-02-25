-- Route channel message/reaction realtime through Realtime Broadcast topics
-- instead of Postgres Changes subscriptions.

CREATE OR REPLACE FUNCTION public.broadcast_channel_message_change()
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
        'channel_id', OLD.channel_id
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'channel_id', NEW.channel_id,
        'user_id', NEW.user_id,
        'reply_to_id', NEW.reply_to_id,
        'content', NEW.content,
        'is_pinned', COALESCE(NEW.is_pinned, false),
        'is_system_message', COALESCE(NEW.is_system_message, false),
        'edited_at', NEW.edited_at,
        'created_at', NEW.created_at
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'messages',
    'chat:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_channel_reaction_change()
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
        'message_id', OLD.message_id,
        'user_id', OLD.user_id,
        'emoji', OLD.emoji
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'channel_id', NEW.channel_id,
        'message_id', NEW.message_id,
        'user_id', NEW.user_id,
        'emoji', NEW.emoji
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'reactions',
    'chat:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_channel_message_change ON public.messages;
CREATE TRIGGER trg_broadcast_channel_message_change
AFTER INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_channel_message_change();

DROP TRIGGER IF EXISTS trg_broadcast_channel_reaction_change ON public.reactions;
CREATE TRIGGER trg_broadcast_channel_reaction_change
AFTER INSERT OR UPDATE OR DELETE ON public.reactions
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_channel_reaction_change();

-- Keep PostgREST schema cache fresh for function signature metadata.
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
