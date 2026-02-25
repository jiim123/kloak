-- Allow users to close/hide a DM conversation from their own list.
-- For group DMs, this also leaves the group and emits a system message.
-- For 1:1 DMs, this removes only the caller from participants.

CREATE OR REPLACE FUNCTION public.close_dm_conversation(
  _conversation_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_group boolean;
  v_is_participant boolean;
  v_username text;
  v_display_name text;
  v_participant_count integer;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT c.is_group INTO v_is_group
  FROM public.dm_conversations c
  WHERE c.id = _conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.dm_participants dp
    WHERE dp.conversation_id = _conversation_id
      AND dp.user_id = _user_id
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RETURN json_build_object('success', true, 'already_closed', true);
  END IF;

  IF COALESCE(v_is_group, false) THEN
    SELECT u.username, u.display_name
      INTO v_username, v_display_name
    FROM public.users u
    WHERE u.id = _user_id;

    INSERT INTO public.direct_messages (conversation_id, sender_id, content)
    VALUES (
      _conversation_id,
      _user_id,
      '📤 ' || COALESCE(v_display_name, v_username) || ' has left the group chat'
    );
  END IF;

  DELETE FROM public.dm_participants
  WHERE conversation_id = _conversation_id
    AND user_id = _user_id;

  SELECT COUNT(*)::integer
    INTO v_participant_count
  FROM public.dm_participants
  WHERE conversation_id = _conversation_id;

  IF v_participant_count <= 0 THEN
    DELETE FROM public.dm_conversations WHERE id = _conversation_id;
  END IF;

  RETURN json_build_object('success', true, 'is_group', COALESCE(v_is_group, false));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.close_dm_conversation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_dm_conversation(uuid, uuid) TO anon, authenticated;

