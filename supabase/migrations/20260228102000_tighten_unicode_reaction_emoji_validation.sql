-- Tighten unicode emoji validation and normalize stored reaction emoji strings.

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

  -- Explicitly reject music-note symbols; these are text symbols, not supported reaction emoji.
  IF v ~ E'[\\u2669-\\u266F]' THEN
    RETURN false;
  END IF;

  -- Allow standard emoji constructs:
  -- 1) Regional indicator flags
  -- 2) Keycap sequences
  -- 3) Emoji sequences using emoji codepoints and optional ZWJ joins
  -- For BMP symbol ranges, require VS16 to avoid accepting plain text symbols like '?'.
  RETURN v ~ E'^(?:[\\U0001F1E6-\\U0001F1FF]{2}|[0-9#*]\\uFE0F?\\u20E3|(?:[\\U0001F300-\\U0001FAFF]|[\\u2600-\\u26FF\\u2700-\\u27BF]\\uFE0F)(?:[\\U0001F3FB-\\U0001F3FF])?(?:\\u200D(?:[\\U0001F300-\\U0001FAFF]|[\\u2600-\\u26FF\\u2700-\\u27BF]\\uFE0F)(?:[\\U0001F3FB-\\U0001F3FF])?)*)$';
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
  -- Normalize leading/trailing whitespace so validation and storage are consistent.
  NEW.emoji := btrim(NEW.emoji);

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
  v_emoji text := btrim(_emoji);
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
  PERFORM public.validate_reaction_emoji(v_emoji, channel_id, _user_id);

  -- Check if reaction already exists
  IF EXISTS (
    SELECT 1 FROM reactions
    WHERE message_id = _message_id AND user_id = _user_id AND emoji = v_emoji
  ) THEN
    SELECT json_build_object(
      'id', r.id,
      'message_id', r.message_id,
      'user_id', r.user_id,
      'emoji', r.emoji
    ) INTO result
    FROM reactions r
    WHERE r.message_id = _message_id AND r.user_id = _user_id AND r.emoji = v_emoji
    LIMIT 1;

    RETURN result;
  END IF;

  -- Insert new reaction
  INSERT INTO reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, v_emoji)
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
