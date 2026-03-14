ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.update_forum_thread_moderation(
  _thread_id uuid,
  _user_id uuid,
  _is_pinned boolean DEFAULT NULL,
  _is_closed boolean DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_thread public.threads%ROWTYPE;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _is_pinned IS NULL AND _is_closed IS NULL THEN
    RAISE EXCEPTION 'No moderation changes requested';
  END IF;

  SELECT *
    INTO v_thread
  FROM public.threads
  WHERE id = _thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  IF NOT public.can_access_channel(v_thread.channel_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF NOT public.check_user_permission(_user_id, v_thread.channel_id, 'manage_messages') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.threads
  SET
    is_pinned = COALESCE(_is_pinned, is_pinned),
    is_closed = COALESCE(_is_closed, is_closed)
  WHERE id = _thread_id;

  RETURN (
    SELECT json_build_object(
      'id', t.id,
      'is_pinned', t.is_pinned,
      'is_closed', t.is_closed
    )
    FROM public.threads t
    WHERE t.id = _thread_id
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_forum_thread_moderation(uuid, uuid, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_forum_thread_moderation(uuid, uuid, boolean, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.send_thread_message(
  _thread_id uuid,
  _user_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  thread_channel_id uuid;
  channel_server_id uuid;
  is_muted boolean;
  thread_is_closed boolean;
  can_manage_messages boolean;
  new_message_id uuid;
  result json;
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT channel_id, is_closed
    INTO thread_channel_id, thread_is_closed
  FROM public.threads
  WHERE id = _thread_id;

  IF thread_channel_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  SELECT server_id INTO channel_server_id
  FROM public.channels
  WHERE id = thread_channel_id;

  SELECT sm.is_muted INTO is_muted
  FROM public.server_members sm
  WHERE sm.server_id = channel_server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF is_muted IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  IF is_muted THEN
    RAISE EXCEPTION 'You are muted in this server';
  END IF;

  can_manage_messages := public.check_user_permission(_user_id, thread_channel_id, 'manage_messages');

  IF thread_is_closed AND NOT can_manage_messages THEN
    RAISE EXCEPTION 'This thread is closed';
  END IF;

  INSERT INTO public.thread_messages (thread_id, user_id, content, reply_to_id)
  VALUES (_thread_id, _user_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT json_build_object(
    'id', tm.id,
    'thread_id', tm.thread_id,
    'user_id', tm.user_id,
    'content', tm.content,
    'reply_to_id', tm.reply_to_id,
    'edited_at', tm.edited_at,
    'created_at', tm.created_at
  )
  INTO result
  FROM public.thread_messages tm
  WHERE tm.id = new_message_id;

  RETURN result;
END;
$function$;

DROP POLICY IF EXISTS "Thread messages can be inserted" ON public.thread_messages;

CREATE POLICY "Thread messages can be inserted" ON public.thread_messages
FOR INSERT
WITH CHECK (
  (user_id = (SELECT public.requesting_user_id() AS requesting_user_id))
  AND ((SELECT public.requesting_user_id() AS requesting_user_id) IS NOT NULL)
  AND EXISTS (
    SELECT 1
    FROM public.threads t
    WHERE t.id = thread_id
      AND public.is_thread_channel_member(thread_id, (SELECT public.requesting_user_id() AS requesting_user_id))
      AND (
        COALESCE(t.is_closed, false) = false
        OR public.check_user_permission((SELECT public.requesting_user_id() AS requesting_user_id), t.channel_id, 'manage_messages')
      )
  )
);
