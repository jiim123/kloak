-- Route forum thread updates through Realtime Broadcast topics.
-- Mirrors the media realtime approach while keeping existing RPC/RLS write paths.

CREATE OR REPLACE FUNCTION public.broadcast_forum_thread_change()
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
        'channel_id', NEW.channel_id,
        'message_id', NEW.message_id,
        'created_by', NEW.created_by,
        'created_at', NEW.created_at
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'threads',
    'forum-threads:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_forum_thread_message_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _thread_id uuid;
  _channel_id uuid;
  _payload jsonb;
BEGIN
  _thread_id := COALESCE(NEW.thread_id, OLD.thread_id);

  IF _thread_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT t.channel_id
    INTO _channel_id
  FROM public.threads t
  WHERE t.id = _thread_id;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
        'thread_id', OLD.thread_id,
        'user_id', OLD.user_id,
        'reply_to_id', OLD.reply_to_id
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'thread_id', NEW.thread_id,
        'user_id', NEW.user_id,
        'reply_to_id', NEW.reply_to_id,
        'content', NEW.content,
        'edited_at', NEW.edited_at,
        'created_at', NEW.created_at
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'thread_messages',
    'thread-messages:' || _thread_id::text,
    false
  );

  IF _channel_id IS NOT NULL THEN
    PERFORM realtime.send(
      _payload,
      'thread_messages',
      'forum-threads:' || _channel_id::text,
      false
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_forum_thread_reaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _message_id uuid;
  _thread_id uuid;
  _payload jsonb;
BEGIN
  _message_id := COALESCE(NEW.message_id, OLD.message_id);

  IF _message_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT tm.thread_id
    INTO _thread_id
  FROM public.thread_messages tm
  WHERE tm.id = _message_id;

  IF _thread_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
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
        'message_id', NEW.message_id,
        'user_id', NEW.user_id,
        'emoji', NEW.emoji
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'thread_reactions',
    'thread-messages:' || _thread_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_forum_thread_change ON public.threads;
CREATE TRIGGER trg_broadcast_forum_thread_change
AFTER INSERT OR UPDATE OR DELETE ON public.threads
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_forum_thread_change();

DROP TRIGGER IF EXISTS trg_broadcast_forum_thread_message_change ON public.thread_messages;
CREATE TRIGGER trg_broadcast_forum_thread_message_change
AFTER INSERT OR UPDATE OR DELETE ON public.thread_messages
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_forum_thread_message_change();

DROP TRIGGER IF EXISTS trg_broadcast_forum_thread_reaction_change ON public.thread_reactions;
CREATE TRIGGER trg_broadcast_forum_thread_reaction_change
AFTER INSERT OR UPDATE OR DELETE ON public.thread_reactions
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_forum_thread_reaction_change();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
