-- Set DM privacy default to friends-only for both existing and future users.

-- 1) Future default for any newly inserted user_preferences row.
ALTER TABLE public.user_preferences
ALTER COLUMN dm_privacy SET DEFAULT 'friends';

-- 2) Backfill existing users who are still on legacy default.
UPDATE public.user_preferences
SET dm_privacy = 'friends',
    updated_at = now()
WHERE dm_privacy IS NULL
   OR dm_privacy = 'shared_servers';

-- 3) Ensure open_dm_conversation fallback (no preference row) is friends-only.
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
