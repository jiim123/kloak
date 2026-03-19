CREATE OR REPLACE FUNCTION public.edit_forum_thread_post(
  _thread_id uuid,
  _title text,
  _content text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller uuid;
  _trimmed_title text;
  _trimmed_body text;
  _full_content text;
  _thread public.threads%ROWTYPE;
  _can_manage boolean := false;
  _result json;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  _trimmed_title := trim(coalesce(_title, ''));
  IF _trimmed_title = '' THEN
    RAISE EXCEPTION 'Topic title cannot be empty';
  END IF;

  _trimmed_body := trim(coalesce(_content, ''));
  _full_content := _trimmed_title;
  IF _trimmed_body <> '' THEN
    _full_content := _trimmed_title || E'\n\n' || _trimmed_body;
  END IF;

  IF char_length(_full_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  SELECT *
    INTO _thread
  FROM public.threads
  WHERE id = _thread_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  IF NOT public.can_access_channel(_thread.channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  _can_manage := public.check_user_permission(_caller, _thread.channel_id, 'manage_messages');

  IF _thread.created_by <> _caller AND NOT _can_manage THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.messages
  SET content = _full_content,
      edited_at = now()
  WHERE id = _thread.message_id
  RETURNING json_build_object(
    'message_id', id,
    'thread_id', _thread.id,
    'content', content,
    'edited_at', edited_at
  ) INTO _result;

  RETURN _result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.edit_forum_thread_post(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_forum_thread_post(uuid, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.edit_thread_message(
  _message_id uuid,
  _content text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _caller uuid;
  _trimmed_content text;
  _thread_message public.thread_messages%ROWTYPE;
  _thread_channel_id uuid;
  _result json;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  _trimmed_content := trim(coalesce(_content, ''));
  IF _trimmed_content = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(_trimmed_content) > 4000 THEN
    RAISE EXCEPTION 'Message must be 4000 characters or less';
  END IF;

  SELECT tm.*
    INTO _thread_message
  FROM public.thread_messages tm
  WHERE tm.id = _message_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  SELECT t.channel_id
    INTO _thread_channel_id
  FROM public.threads t
  WHERE t.id = _thread_message.thread_id;

  IF _thread_message.user_id <> _caller THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF NOT public.can_access_channel(_thread_channel_id, _caller) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.thread_messages
  SET content = _trimmed_content,
      edited_at = now()
  WHERE id = _message_id
  RETURNING json_build_object(
    'id', id,
    'thread_id', thread_id,
    'user_id', user_id,
    'content', content,
    'edited_at', edited_at,
    'created_at', created_at
  ) INTO _result;

  RETURN _result;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.edit_thread_message(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edit_thread_message(uuid, text) TO anon, authenticated;
