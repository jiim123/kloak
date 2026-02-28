-- Reject non-emoji / invalid custom emoji reaction payloads at the DB layer.

CREATE OR REPLACE FUNCTION public.is_unicode_emoji(_emoji text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := btrim(_emoji);
BEGIN
  IF v IS NULL OR v = '' THEN
    RETURN false;
  END IF;

  -- Hard cap to avoid abuse with very long strings.
  IF char_length(v) > 64 THEN
    RETURN false;
  END IF;

  -- Allow common emoji ranges + ZWJ/VS16 for compound emoji sequences.
  RETURN v ~ E'^[\\U0001F1E0-\\U0001F1FF\\U0001F300-\\U0001FAFF\\u2600-\\u27BF\\u200D\\uFE0F]+$';
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_reaction_emoji(
  _emoji text,
  _channel_id uuid,
  _user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emoji text := btrim(_emoji);
  v_name text;
  v_qualifier text;
  v_channel_server_id uuid;
  v_emoji_server_id uuid;
BEGIN
  IF v_emoji IS NULL OR v_emoji = '' THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  IF char_length(v_emoji) > 64 THEN
    RAISE EXCEPTION 'Invalid emoji';
  END IF;

  -- Custom emoji: :name: or :name~Server Name:
  IF v_emoji ~ '^:[a-z0-9_]{2,12}:$' THEN
    v_name := substring(v_emoji from '^:([a-z0-9_]{2,12}):$');
  ELSIF v_emoji ~ '^:[a-z0-9_]{2,12}~[^:]{1,64}:$' THEN
    v_name := substring(v_emoji from '^:([a-z0-9_]{2,12})~[^:]+:$');
    v_qualifier := substring(v_emoji from '^:[a-z0-9_]{2,12}~([^:]+):$');
  ELSE
    -- Native emoji only
    IF NOT public.is_unicode_emoji(v_emoji) THEN
      RAISE EXCEPTION 'Invalid emoji';
    END IF;
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

  IF v_qualifier IS NULL THEN
    -- First: emoji from the current server
    SELECT se.server_id INTO v_emoji_server_id
    FROM public.server_emojis se
    WHERE se.server_id = v_channel_server_id AND se.name = v_name
    LIMIT 1;

    IF v_emoji_server_id IS NULL THEN
      -- External emoji: require permission + membership in a server with that emoji
      IF NOT public.check_user_permission(_user_id, _channel_id, 'use_external_emojis') THEN
        RAISE EXCEPTION 'Invalid emoji';
      END IF;

      SELECT se.server_id INTO v_emoji_server_id
      FROM public.server_emojis se
      JOIN public.server_members sm ON sm.server_id = se.server_id AND sm.user_id = _user_id
      WHERE se.name = v_name
      LIMIT 1;

      IF v_emoji_server_id IS NULL THEN
        RAISE EXCEPTION 'Invalid emoji';
      END IF;
    END IF;
  ELSE
    -- Qualified emoji: must resolve to a server the user belongs to
    SELECT se.server_id INTO v_emoji_server_id
    FROM public.server_emojis se
    JOIN public.servers s ON s.id = se.server_id
    JOIN public.server_members sm ON sm.server_id = se.server_id AND sm.user_id = _user_id
    WHERE se.name = v_name AND s.name = v_qualifier
    LIMIT 1;

    IF v_emoji_server_id IS NULL THEN
      RAISE EXCEPTION 'Invalid emoji';
    END IF;

    IF v_emoji_server_id <> v_channel_server_id
      AND NOT public.check_user_permission(_user_id, _channel_id, 'use_external_emojis') THEN
      RAISE EXCEPTION 'Invalid emoji';
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_dm_reaction_emoji(_emoji text)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF NOT public.is_unicode_emoji(_emoji) THEN
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
    PERFORM public.validate_dm_reaction_emoji(NEW.emoji);
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

DROP TRIGGER IF EXISTS trg_validate_reaction_emoji ON public.reactions;
CREATE TRIGGER trg_validate_reaction_emoji
BEFORE INSERT OR UPDATE OF emoji, message_id
ON public.reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_valid_reaction_emoji();

DROP TRIGGER IF EXISTS trg_validate_thread_reaction_emoji ON public.thread_reactions;
CREATE TRIGGER trg_validate_thread_reaction_emoji
BEFORE INSERT OR UPDATE OF emoji, message_id
ON public.thread_reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_valid_reaction_emoji();

DROP TRIGGER IF EXISTS trg_validate_dm_reaction_emoji ON public.dm_reactions;
CREATE TRIGGER trg_validate_dm_reaction_emoji
BEFORE INSERT OR UPDATE OF emoji
ON public.dm_reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_valid_reaction_emoji();

DROP TRIGGER IF EXISTS trg_validate_announcement_comment_reaction_emoji ON public.announcement_comment_reactions;
CREATE TRIGGER trg_validate_announcement_comment_reaction_emoji
BEFORE INSERT OR UPDATE OF emoji, comment_id
ON public.announcement_comment_reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_valid_reaction_emoji();

DROP TRIGGER IF EXISTS trg_validate_media_comment_reaction_emoji ON public.media_comment_reactions;
CREATE TRIGGER trg_validate_media_comment_reaction_emoji
BEFORE INSERT OR UPDATE OF emoji, comment_id
ON public.media_comment_reactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_valid_reaction_emoji();

-- Tighten RPC to fail fast with the same validation
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
  -- Identity verification
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;
  -- Get the channel_id from the message
  SELECT m.channel_id, c.server_id INTO channel_id, channel_server_id
  FROM messages m
  JOIN channels c ON c.id = m.channel_id
  WHERE m.id = _message_id;

  IF channel_id IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  -- Check permission using database-backed permission system
  IF NOT public.check_user_permission(_user_id, channel_id, 'add_reactions') THEN
    RAISE EXCEPTION 'You do not have permission to add reactions in this channel';
  END IF;

  -- Emoji validation (blocks arbitrary text payloads)
  PERFORM public.validate_reaction_emoji(_emoji, channel_id, _user_id);

  -- Check if reaction already exists
  IF EXISTS (
    SELECT 1 FROM reactions
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = _emoji
  ) THEN
    -- Reaction already exists, return existing
    SELECT json_build_object(
      'id', r.id,
      'message_id', r.message_id,
      'user_id', r.user_id,
      'emoji', r.emoji
    ) INTO result
    FROM reactions r
    WHERE r.message_id = _message_id AND r.user_id = _user_id AND r.emoji = _emoji
    LIMIT 1;

    RETURN result;
  END IF;

  -- Insert new reaction
  INSERT INTO reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji)
  RETURNING id INTO new_reaction_id;

  -- Return the reaction
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
