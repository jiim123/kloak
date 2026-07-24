
-- Typing is now sent directly over the websocket by the client instead of the
-- old broadcast-typing Edge Function, so remove the policy that blocked it.
DROP POLICY IF EXISTS "typing_broadcast_insert_guard" ON realtime.messages;

-- Ensure regular server channel messages are broadcast to chat:<channel_id>.
-- This restores the websocket path used by useRealtimeMessages after removing
-- periodic catchup refetches.

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
        'embed_hidden', COALESCE(NEW.embed_hidden, false),
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

DROP TRIGGER IF EXISTS trg_broadcast_channel_message_change ON public.messages;
CREATE TRIGGER trg_broadcast_channel_message_change
AFTER INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_channel_message_change();

REVOKE EXECUTE ON FUNCTION public.broadcast_channel_message_change() FROM PUBLIC;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
