-- Harden DM spam abuse paths:
-- 1) prevent opening DMs to unrelated users (must share server or be friends)
-- 2) add server-side DM send rate limit to reduce scripted blast attempts

-- -------------------------------------------------------------------
-- open_dm_conversation: require relationship before creating 1:1 conversation.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_dm_conversation(_user_id uuid, _other_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  existing_conversation_id uuid;
  new_conversation_id uuid;
  result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _user_id = _other_user_id THEN
    RAISE EXCEPTION 'Cannot open DM with yourself';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = _other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Discord-like baseline: only allow DM open when users are socially related.
  IF NOT (
    public.is_friend_with(_user_id, _other_user_id)
    OR public.shares_server_with(_user_id, _other_user_id)
  ) THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;

  SELECT dp1.conversation_id INTO existing_conversation_id
  FROM public.dm_participants dp1
  JOIN public.dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
  JOIN public.dm_conversations dc ON dc.id = dp1.conversation_id
  WHERE dp1.user_id = _user_id
    AND dp2.user_id = _other_user_id
    AND COALESCE(dc.is_group, false) = false
  LIMIT 1;

  IF existing_conversation_id IS NOT NULL THEN
    SELECT json_build_object('id', dc.id, 'created_at', dc.created_at)
      INTO result
    FROM public.dm_conversations dc
    WHERE dc.id = existing_conversation_id;
    RETURN result;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'blocked'
      AND (
        (f.requester_id = _user_id AND f.addressee_id = _other_user_id)
        OR (f.requester_id = _other_user_id AND f.addressee_id = _user_id)
      )
  ) THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;

  INSERT INTO public.dm_conversations DEFAULT VALUES
  RETURNING id INTO new_conversation_id;

  INSERT INTO public.dm_participants (conversation_id, user_id)
  VALUES (new_conversation_id, _user_id), (new_conversation_id, _other_user_id);

  SELECT json_build_object('id', dc.id, 'created_at', dc.created_at)
    INTO result
  FROM public.dm_conversations dc
  WHERE dc.id = new_conversation_id;

  RETURN result;
END;
$function$;

-- -------------------------------------------------------------------
-- send_dm: enforce sender participation + anti-spam throttle.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_dm(
  _conversation_id uuid,
  _sender_id uuid,
  _content text,
  _reply_to_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_message_id uuid;
  other_user_id uuid;
  result json;
  recent_count integer;
BEGIN
  IF NOT public.verify_request_identity(_sender_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _content IS NULL OR trim(_content) = '' THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF char_length(_content) > 2000 THEN
    RAISE EXCEPTION 'Message must be 2000 characters or less';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  -- Rate limit: cap per-sender DM throughput to reduce scripted mass-messaging.
  SELECT count(*) INTO recent_count
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND created_at > now() - interval '1 minute';

  IF recent_count >= 20 THEN
    RAISE EXCEPTION 'Rate limited: too many DM messages';
  END IF;

  SELECT dp.user_id INTO other_user_id
  FROM public.dm_participants dp
  WHERE dp.conversation_id = _conversation_id
    AND dp.user_id <> _sender_id
  LIMIT 1;

  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'Conversation has no recipient';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.status = 'blocked'
      AND (
        (f.requester_id = _sender_id AND f.addressee_id = other_user_id)
        OR (f.requester_id = other_user_id AND f.addressee_id = _sender_id)
      )
  ) THEN
    RAISE EXCEPTION 'Cannot send DM to this user';
  END IF;

  INSERT INTO public.direct_messages (conversation_id, sender_id, content, reply_to_id)
  VALUES (_conversation_id, _sender_id, _content, _reply_to_id)
  RETURNING id INTO new_message_id;

  SELECT json_build_object(
    'id', dm.id,
    'conversation_id', dm.conversation_id,
    'sender_id', dm.sender_id,
    'content', dm.content,
    'reply_to_id', dm.reply_to_id,
    'created_at', dm.created_at,
    'edited_at', dm.edited_at
  )
  INTO result
  FROM public.direct_messages dm
  WHERE dm.id = new_message_id;

  RETURN result;
END;
$function$;
