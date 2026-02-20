-- Add per-user DM privacy preferences and enforce them in DM conversation creation.

-- -------------------------------------------------------------------
-- user_preferences: dm_privacy setting
-- -------------------------------------------------------------------
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS dm_privacy text NOT NULL DEFAULT 'friends';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_preferences_dm_privacy_check'
      AND conrelid = 'public.user_preferences'::regclass
  ) THEN
    ALTER TABLE public.user_preferences
      ADD CONSTRAINT user_preferences_dm_privacy_check
      CHECK (dm_privacy = ANY (ARRAY['everyone', 'shared_servers', 'friends', 'no_one']));
  END IF;
END;
$$;

-- -------------------------------------------------------------------
-- RPC: explicit update path for DM privacy setting
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_dm_privacy_preference(_user_id uuid, _dm_privacy text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _dm_privacy IS NULL OR _dm_privacy NOT IN ('everyone', 'shared_servers', 'friends', 'no_one') THEN
    RAISE EXCEPTION 'Invalid dm_privacy value';
  END IF;

  INSERT INTO public.user_preferences (user_id, dm_privacy)
  VALUES (_user_id, _dm_privacy)
  ON CONFLICT (user_id) DO UPDATE
  SET dm_privacy = EXCLUDED.dm_privacy,
      updated_at = now();
END;
$$;

-- -------------------------------------------------------------------
-- open_dm_conversation: enforce target user's DM privacy preference
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
