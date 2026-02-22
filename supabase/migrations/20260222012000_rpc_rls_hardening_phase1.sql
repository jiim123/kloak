-- Phase 1 security hardening: remove implicit PUBLIC RPC execution,
-- enforce DM-open anti-abuse controls, and strengthen DM send throttling.

-- 1) Remove implicit PUBLIC execute on all public schema functions.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS schema_name,
           p.proname AS function_name,
           pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- 2) Re-grant explicit anon/authenticated access for bootstrap/public endpoints.
GRANT EXECUTE ON FUNCTION public.login_user(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_details_by_code(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_explore_servers() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_maintenance_mode() TO anon, authenticated;

-- Keep preference mutation authenticated only.
GRANT EXECUTE ON FUNCTION public.set_dm_privacy_preference(uuid, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_dm_privacy_preference(uuid, text) FROM anon;

-- Preserve helper functions used by RLS in anon/authenticated contexts.
GRANT EXECUTE ON FUNCTION public.can_access_channel(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_user(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_channel_server_member(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_server_member(uuid, uuid) TO anon, authenticated;

-- 3) DM open hardening: attribute creator + rate limits + account-age gate.
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
  target_dm_privacy text;
  allowed_by_privacy boolean := false;
  recent_dm_opens_10m integer := 0;
  recent_dm_opens_1h integer := 0;
  account_created_at timestamptz;
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

  SELECT u.created_at INTO account_created_at
  FROM public.users u
  WHERE u.id = _user_id;

  IF account_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF account_created_at > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'DMs are temporarily restricted for new accounts';
  END IF;

  SELECT count(*) INTO recent_dm_opens_10m
  FROM public.dm_conversations dc
  WHERE dc.created_by = _user_id
    AND COALESCE(dc.is_group, false) = false
    AND dc.created_at > now() - interval '10 minutes';

  IF recent_dm_opens_10m >= 8 THEN
    RAISE EXCEPTION 'Rate limited: too many new DM conversations';
  END IF;

  SELECT count(*) INTO recent_dm_opens_1h
  FROM public.dm_conversations dc
  WHERE dc.created_by = _user_id
    AND COALESCE(dc.is_group, false) = false
    AND dc.created_at > now() - interval '1 hour';

  IF recent_dm_opens_1h >= 25 THEN
    RAISE EXCEPTION 'Rate limited: DM conversation limit reached';
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

  SELECT COALESCE(up.dm_privacy, 'friends')
    INTO target_dm_privacy
  FROM public.user_preferences up
  WHERE up.user_id = _other_user_id;

  IF target_dm_privacy = 'everyone' THEN
    allowed_by_privacy := true;
  ELSIF target_dm_privacy = 'shared_servers' THEN
    allowed_by_privacy := public.shares_server_with(_user_id, _other_user_id);
  ELSIF target_dm_privacy = 'friends' THEN
    allowed_by_privacy := public.is_friend_with(_user_id, _other_user_id);
  ELSIF target_dm_privacy = 'no_one' THEN
    allowed_by_privacy := false;
  END IF;

  IF NOT allowed_by_privacy THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;

  INSERT INTO public.dm_conversations (is_group, created_by)
  VALUES (false, _user_id)
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

-- 4) DM send hardening: tighter burst + duplicate spam protections.
CREATE OR REPLACE FUNCTION public.send_dm(_conversation_id uuid, _sender_id uuid, _content text, _reply_to_id uuid DEFAULT NULL::uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_message_id uuid;
  other_user_id uuid;
  result json;
  recent_count_1m integer;
  recent_count_10s integer;
  convo_count_10s integer;
  sender_created_at timestamptz;
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

  SELECT u.created_at INTO sender_created_at
  FROM public.users u
  WHERE u.id = _sender_id;

  IF sender_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF sender_created_at > now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'DMs are temporarily restricted for new accounts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.dm_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _sender_id
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  SELECT count(*) INTO recent_count_1m
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND created_at > now() - interval '1 minute';

  IF recent_count_1m >= 20 THEN
    RAISE EXCEPTION 'Rate limited: too many DM messages';
  END IF;

  SELECT count(*) INTO recent_count_10s
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND created_at > now() - interval '10 seconds';

  IF recent_count_10s >= 6 THEN
    RAISE EXCEPTION 'Rate limited: sending DMs too quickly';
  END IF;

  SELECT count(*) INTO convo_count_10s
  FROM public.direct_messages
  WHERE sender_id = _sender_id
    AND conversation_id = _conversation_id
    AND created_at > now() - interval '10 seconds';

  IF convo_count_10s >= 4 THEN
    RAISE EXCEPTION 'Rate limited: too many messages in this DM';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.direct_messages dm
    WHERE dm.sender_id = _sender_id
      AND dm.conversation_id = _conversation_id
      AND dm.content = _content
      AND dm.created_at > now() - interval '30 seconds'
  ) THEN
    RAISE EXCEPTION 'Duplicate DM blocked';
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

-- 5) Performance support for DM-open rate checks.
CREATE INDEX IF NOT EXISTS idx_dm_conversations_created_by_created_at
  ON public.dm_conversations (created_by, created_at DESC)
  WHERE created_by IS NOT NULL;
