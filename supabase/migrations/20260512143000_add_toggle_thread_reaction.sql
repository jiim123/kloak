CREATE OR REPLACE FUNCTION public.toggle_thread_reaction(
  _message_id uuid,
  _user_id uuid,
  _emoji text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  thread_record record;
  existing_reaction_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT
    tm.id AS message_id,
    tm.thread_id,
    t.channel_id
  INTO thread_record
  FROM public.thread_messages tm
  JOIN public.threads t ON t.id = tm.thread_id
  WHERE tm.id = _message_id;

  IF thread_record IS NULL THEN
    RAISE EXCEPTION 'Thread message not found';
  END IF;

  IF NOT public.can_access_channel(thread_record.channel_id, _user_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF NOT public.check_user_permission(_user_id, thread_record.channel_id, 'add_reactions'::public.permission_type) THEN
    RAISE EXCEPTION 'Permission denied: add_reactions';
  END IF;

  IF NOT public.check_thread_reaction_rate_limit(_user_id) THEN
    RAISE EXCEPTION 'You are adding reactions too fast. Please slow down.';
  END IF;

  IF public.is_user_muted(_user_id) THEN
    RAISE EXCEPTION 'Muted users cannot add thread reactions';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = _user_id
      AND u.created_at <= now() - interval '2 minutes'
  ) THEN
    RAISE EXCEPTION 'Your account must be at least 2 minutes old to add thread reactions';
  END IF;

  SELECT tr.id
  INTO existing_reaction_id
  FROM public.thread_reactions tr
  WHERE tr.message_id = _message_id
    AND tr.user_id = _user_id
    AND tr.emoji = _emoji;

  IF existing_reaction_id IS NOT NULL THEN
    DELETE FROM public.thread_reactions
    WHERE id = existing_reaction_id;

    RETURN jsonb_build_object(
      'active', false,
      'message_id', _message_id,
      'user_id', _user_id,
      'emoji', _emoji
    );
  END IF;

  INSERT INTO public.thread_reactions (message_id, user_id, emoji)
  VALUES (_message_id, _user_id, _emoji);

  RETURN jsonb_build_object(
    'active', true,
    'message_id', _message_id,
    'user_id', _user_id,
    'emoji', _emoji
  );
END;
$$;
