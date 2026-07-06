-- Allow existing custom emojis as message reactions.
-- The previous DM validator only accepted native Unicode emoji, and the
-- channel validator resolved custom emoji through server_emojis/membership.
-- Both can reject renderable custom emoji tokens like :name: and
-- :name~Server Name:. Use emoji_render_variants as the shared existence
-- check while preserving channel external-emoji permissions.

CREATE OR REPLACE FUNCTION public.resolve_reaction_custom_emoji(
  _emoji text,
  _preferred_server_id uuid DEFAULT NULL
)
RETURNS TABLE(emoji_name text, server_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emoji text := btrim(_emoji);
  v_name text;
  v_qualifier text;
BEGIN
  IF v_emoji IS NULL OR v_emoji = '' OR char_length(v_emoji) > 64 THEN
    RETURN;
  END IF;

  -- Custom emoji: :name: or :name~Server Name:
  IF v_emoji ~ '^:[a-z0-9_]{2,12}:$' THEN
    v_name := substring(v_emoji from '^:([a-z0-9_]{2,12}):$');

    RETURN QUERY
      SELECT erv.name, erv.server_id
      FROM public.emoji_render_variants erv
      WHERE erv.name = v_name
      ORDER BY
        CASE WHEN _preferred_server_id IS NOT NULL AND erv.server_id = _preferred_server_id THEN 0 ELSE 1 END,
        erv.created_at ASC,
        erv.emoji_id ASC
      LIMIT 1;
  ELSIF v_emoji ~ '^:[a-z0-9_]{2,12}~[^:]{1,64}:$' THEN
    v_name := substring(v_emoji from '^:([a-z0-9_]{2,12})~[^:]+:$');
    v_qualifier := substring(v_emoji from '^:[a-z0-9_]{2,12}~([^:]+):$');

    RETURN QUERY
      SELECT erv.name, erv.server_id
      FROM public.emoji_render_variants erv
      WHERE erv.name = v_name
        AND erv.server_name = v_qualifier
      ORDER BY erv.created_at ASC, erv.emoji_id ASC
      LIMIT 1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_dm_reaction_emoji(_emoji text, _user_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emoji text := btrim(_emoji);
  v_custom_server_id uuid;
BEGIN
  IF v_emoji IS NULL OR v_emoji = '' THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  IF char_length(v_emoji) > 64 THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  IF public.is_unicode_emoji(v_emoji) THEN
    RETURN;
  END IF;

  SELECT server_id INTO v_custom_server_id
  FROM public.resolve_reaction_custom_emoji(v_emoji, NULL)
  LIMIT 1;

  IF v_custom_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_reaction_emoji(
  _emoji text,
  _channel_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emoji text := btrim(_emoji);
  v_channel_server_id uuid;
  v_custom_server_id uuid;
BEGIN
  IF v_emoji IS NULL OR v_emoji = '' THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  IF char_length(v_emoji) > 64 THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  IF public.is_unicode_emoji(v_emoji) THEN
    RETURN;
  END IF;

  IF _channel_id IS NULL THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  SELECT c.server_id INTO v_channel_server_id
  FROM public.channels c
  WHERE c.id = _channel_id;

  IF v_channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  SELECT server_id INTO v_custom_server_id
  FROM public.resolve_reaction_custom_emoji(v_emoji, v_channel_server_id)
  LIMIT 1;

  IF v_custom_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  IF v_custom_server_id <> v_channel_server_id
    AND NOT public.check_user_permission(_user_id, _channel_id, 'use_external_emojis') THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_valid_reaction_emoji()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'dm_reactions' THEN
    PERFORM public.validate_dm_reaction_emoji(NEW.emoji, NEW.user_id);
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'reactions' THEN
    v_channel_id := COALESCE(
      NEW.channel_id,
      (SELECT m.channel_id FROM public.messages m WHERE m.id = NEW.message_id)
    );
  ELSIF TG_TABLE_NAME = 'thread_reactions' THEN
    SELECT t.channel_id INTO v_channel_id
    FROM public.thread_messages tm
    JOIN public.threads t ON t.id = tm.thread_id
    WHERE tm.id = NEW.message_id;
  ELSIF TG_TABLE_NAME = 'announcement_comment_reactions' THEN
    SELECT m.channel_id INTO v_channel_id
    FROM public.announcement_comments ac
    JOIN public.messages m ON m.id = ac.message_id
    WHERE ac.id = NEW.comment_id;
  ELSIF TG_TABLE_NAME = 'media_comment_reactions' THEN
    SELECT mi.channel_id INTO v_channel_id
    FROM public.media_comments mc
    JOIN public.media_items mi ON mi.id = mc.media_id
    WHERE mc.id = NEW.comment_id;
  END IF;

  PERFORM public.validate_reaction_emoji(NEW.emoji, v_channel_id, NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_dm_reaction(_message_id uuid, _user_id uuid, _emoji text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_conversation_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT conversation_id INTO msg_conversation_id
  FROM direct_messages
  WHERE id = _message_id;

  IF NOT EXISTS (
    SELECT 1
    FROM dm_participants
    WHERE conversation_id = msg_conversation_id
      AND user_id = _user_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  PERFORM public.validate_dm_reaction_emoji(_emoji, _user_id);

  INSERT INTO dm_reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, btrim(_emoji))
  ON CONFLICT (message_id, user_id, emoji) DO NOTHING
  RETURNING id INTO new_reaction_id;

  IF new_reaction_id IS NULL THEN
    SELECT id INTO new_reaction_id
    FROM dm_reactions
    WHERE message_id = _message_id
      AND user_id = _user_id
      AND emoji = btrim(_emoji);
  END IF;

  SELECT json_build_object('id', r.id, 'message_id', r.message_id, 'user_id', r.user_id, 'emoji', r.emoji)
  INTO result
  FROM dm_reactions r
  WHERE r.id = new_reaction_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_reaction(_message_id uuid, _user_id uuid, _emoji text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_id uuid;
  channel_server_id uuid;
  new_reaction_id uuid;
  result json;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT m.channel_id, c.server_id INTO channel_id, channel_server_id
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  WHERE m.id = _message_id;

  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'You do not have permission to add reactions in this channel';
  END IF;

  PERFORM public.validate_reaction_emoji(_emoji, channel_id, _user_id);

  IF EXISTS (
    SELECT 1
    FROM reactions
    WHERE message_id = _message_id
      AND user_id = _user_id
      AND emoji = btrim(_emoji)
  ) THEN
    SELECT json_build_object(
      'id', r.id,
      'message_id', r.message_id,
      'user_id', r.user_id,
      'emoji', r.emoji
    ) INTO result
    FROM reactions r
    WHERE r.message_id = _message_id
      AND r.user_id = _user_id
      AND r.emoji = btrim(_emoji)
    LIMIT 1;

    RETURN result;
  END IF;

  INSERT INTO reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, btrim(_emoji))
  RETURNING id INTO new_reaction_id;

  SELECT json_build_object(
    'id', r.id,
    'message_id', r.message_id,
    'user_id', r.user_id,
    'emoji', r.emoji
  ) INTO result
  FROM reactions r
  WHERE r.id = new_reaction_id;

  RETURN result;
END;
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
