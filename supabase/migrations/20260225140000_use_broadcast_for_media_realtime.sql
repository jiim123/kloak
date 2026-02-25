-- Route media channel updates through Realtime Broadcast topics.
-- Keeps existing RPC/RLS write paths unchanged while restoring cross-user live updates.

CREATE OR REPLACE FUNCTION public.broadcast_media_item_change()
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
        'channel_id', NEW.channel_id
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'media_items',
    'media_items:' || _channel_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_media_comment_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _media_id uuid;
  _payload jsonb;
BEGIN
  _media_id := COALESCE(NEW.media_id, OLD.media_id);

  IF _media_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
        'media_id', OLD.media_id
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'media_id', NEW.media_id
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'media_comments',
    'media-comments:' || _media_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.broadcast_media_comment_reaction_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _comment_id uuid;
  _media_id uuid;
  _payload jsonb;
BEGIN
  _comment_id := COALESCE(NEW.comment_id, OLD.comment_id);

  IF _comment_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT mc.media_id
    INTO _media_id
  FROM public.media_comments mc
  WHERE mc.id = _comment_id;

  IF _media_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'DELETE' THEN
    _payload := jsonb_build_object(
      'op', TG_OP,
      'old', jsonb_build_object(
        'id', OLD.id,
        'comment_id', OLD.comment_id
      )
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', jsonb_build_object(
        'id', NEW.id,
        'comment_id', NEW.comment_id
      )
    );
  END IF;

  PERFORM realtime.send(
    _payload,
    'media_comment_reactions',
    'media-comments:' || _media_id::text,
    false
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_broadcast_media_item_change ON public.media_items;
CREATE TRIGGER trg_broadcast_media_item_change
AFTER INSERT OR UPDATE OR DELETE ON public.media_items
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_media_item_change();

DROP TRIGGER IF EXISTS trg_broadcast_media_comment_change ON public.media_comments;
CREATE TRIGGER trg_broadcast_media_comment_change
AFTER INSERT OR UPDATE OR DELETE ON public.media_comments
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_media_comment_change();

DROP TRIGGER IF EXISTS trg_broadcast_media_comment_reaction_change ON public.media_comment_reactions;
CREATE TRIGGER trg_broadcast_media_comment_reaction_change
AFTER INSERT OR UPDATE OR DELETE ON public.media_comment_reactions
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_media_comment_reaction_change();

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
