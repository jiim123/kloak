-- Send complete media channel payloads over Realtime Broadcast so clients can
-- update local state without refetching on every media/comment/reaction event.

CREATE OR REPLACE FUNCTION public.media_item_broadcast_row(_item public.media_items)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', _item.id,
    'channel_id', _item.channel_id,
    'user_id', _item.user_id,
    'title', _item.title,
    'description', _item.description,
    'media_url', _item.media_url,
    'media_type', _item.media_type,
    'thumbnail_url', _item.thumbnail_url,
    'youtube_video_id', _item.youtube_video_id,
    'width', _item.width,
    'height', _item.height,
    'created_at', _item.created_at,
    'user', (
      SELECT jsonb_build_object(
        'id', u.id,
        'username', u.username,
        'avatar_url', u.avatar_url,
        'banner_color', u.banner_color
      )
      FROM public.users u
      WHERE u.id = _item.user_id
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.media_comment_broadcast_row(_comment public.media_comments)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', _comment.id,
    'media_id', _comment.media_id,
    'user_id', _comment.user_id,
    'content', _comment.content,
    'reply_to_id', _comment.reply_to_id,
    'edited_at', _comment.edited_at,
    'created_at', _comment.created_at,
    'user', (
      SELECT to_jsonb(u)
      FROM public.users u
      WHERE u.id = _comment.user_id
    ),
    'reply_to', (
      SELECT jsonb_build_object(
        'id', r.id,
        'user_id', r.user_id,
        'content', r.content,
        'created_at', r.created_at,
        'user', (
          SELECT jsonb_build_object(
            'id', ru.id,
            'username', ru.username,
            'display_name', ru.display_name,
            'avatar_url', ru.avatar_url
          )
          FROM public.users ru
          WHERE ru.id = r.user_id
        )
      )
      FROM public.media_comments r
      WHERE r.id = _comment.reply_to_id
    ),
    'reactions', '[]'::jsonb
  );
$$;

CREATE OR REPLACE FUNCTION public.media_comment_reaction_broadcast_row(_reaction public.media_comment_reactions)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', _reaction.id,
    'comment_id', _reaction.comment_id,
    'user_id', _reaction.user_id,
    'emoji', _reaction.emoji,
    'created_at', _reaction.created_at
  );
$$;

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
      'new', public.media_item_broadcast_row(NEW)
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
      'new', public.media_comment_broadcast_row(NEW)
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
      'old', public.media_comment_reaction_broadcast_row(OLD)
    );
  ELSE
    _payload := jsonb_build_object(
      'op', TG_OP,
      'new', public.media_comment_reaction_broadcast_row(NEW)
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

REVOKE EXECUTE ON FUNCTION public.media_item_broadcast_row(public.media_items) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_comment_broadcast_row(public.media_comments) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.media_comment_reaction_broadcast_row(public.media_comment_reactions) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.broadcast_media_item_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.broadcast_media_comment_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.broadcast_media_comment_reaction_change() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
