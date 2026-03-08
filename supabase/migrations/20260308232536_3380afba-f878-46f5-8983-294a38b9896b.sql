
CREATE OR REPLACE FUNCTION public.send_friend_request(_requester_id uuid, _addressee_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller_id uuid;
  _addressee_id uuid;
  _existing_friendship record;
  _declined_request record;
  _new_friendship record;
  _cooldown_minutes int := 5;
  _time_since_decline interval;
  _remaining_minutes int;
  _pending_outgoing_count int;
  _requester_created_at timestamptz;
  _target_bucket text;
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _requester_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.verify_request_identity(_requester_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  -- Account-age gate to reduce fresh-account spray.
  SELECT u.created_at
    INTO _requester_created_at
  FROM public.users u
  WHERE u.id = _requester_id;

  IF _requester_created_at IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _requester_created_at > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'Your account is too new to send friend requests. Please wait a few minutes.';
  END IF;

  -- Requester-side abuse controls.
  IF NOT public.check_rate_limit(_requester_id::text, 'friend_request_burst', 5, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many friend requests. Please wait a minute.';
  END IF;

  IF NOT public.check_rate_limit(_requester_id::text, 'friend_request_hourly', 25, 3600) THEN
    RAISE EXCEPTION 'Rate limited: friend request quota reached. Try again later.';
  END IF;

  IF NOT public.check_rate_limit(_requester_id::text, 'friend_request_daily', 80, 86400) THEN
    RAISE EXCEPTION 'Rate limited: daily friend request quota reached.';
  END IF;

  -- Resolve target.
  SELECT u.id
    INTO _addressee_id
  FROM public.users u
  WHERE lower(u.username) = lower(_addressee_username);

  IF _addressee_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF _addressee_id = _requester_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Recipient-side anti-spray controls (cross-account protection).
  _target_bucket := 'friend_target:' || _addressee_id::text;

  IF NOT public.check_rate_limit(_target_bucket, 'incoming_friend_request_burst', 8, 60) THEN
    RAISE EXCEPTION 'This user is receiving too many requests right now. Try later.';
  END IF;

  IF NOT public.check_rate_limit(_target_bucket, 'incoming_friend_request_hourly', 60, 3600) THEN
    RAISE EXCEPTION 'This user is receiving too many requests right now. Try later.';
  END IF;

  -- Require shared context to reduce unsolicited global spray.
  IF NOT public.shares_server_with(_requester_id, _addressee_id)
     AND NOT public.shares_dm_with(_requester_id, _addressee_id) THEN
    RAISE EXCEPTION 'Cannot send friend request to this user';
  END IF;

  -- Cap outstanding pending requests per requester.
  SELECT count(*)::int
    INTO _pending_outgoing_count
  FROM public.friendships
  WHERE requester_id = _requester_id
    AND status = 'pending';

  IF _pending_outgoing_count >= 50 THEN
    RAISE EXCEPTION 'Too many pending friend requests. Cancel some and try again.';
  END IF;

  -- Existing relationship checks (use FOR UPDATE to lock the row and prevent races).
  SELECT *
    INTO _existing_friendship
  FROM public.friendships
  WHERE (requester_id = _requester_id AND addressee_id = _addressee_id)
     OR (requester_id = _addressee_id AND addressee_id = _requester_id)
  FOR UPDATE;

  IF _existing_friendship IS NOT NULL THEN
    IF _existing_friendship.status = 'accepted' THEN
      RAISE EXCEPTION 'Already friends with this user';
    END IF;

    IF _existing_friendship.status = 'blocked' THEN
      RAISE EXCEPTION 'Cannot send friend request';
    END IF;

    IF _existing_friendship.status = 'pending' THEN
      IF _existing_friendship.requester_id = _requester_id THEN
        RAISE EXCEPTION 'Friend request already pending';
      ELSE
        UPDATE public.friendships
        SET status = 'accepted'
        WHERE id = _existing_friendship.id
        RETURNING * INTO _existing_friendship;

        RETURN json_build_object('id', _existing_friendship.id, 'status', 'accepted');
      END IF;
    END IF;

    -- Any other status (e.g. 'declined') — delete the stale row and proceed to create fresh
    DELETE FROM public.friendships WHERE id = _existing_friendship.id;
  END IF;

  -- Decline cooldown.
  SELECT *
    INTO _declined_request
  FROM public.declined_friend_requests
  WHERE requester_id = _requester_id
    AND addressee_id = _addressee_id;

  IF _declined_request IS NOT NULL THEN
    _time_since_decline := now() - _declined_request.declined_at;

    IF _time_since_decline < (_cooldown_minutes || ' minutes')::interval THEN
      _remaining_minutes := ceil(
        extract(
          epoch from ((_cooldown_minutes || ' minutes')::interval - _time_since_decline)
        ) / 60
      );
      RAISE EXCEPTION 'You can send another request in % minute(s)', _remaining_minutes;
    END IF;

    DELETE FROM public.declined_friend_requests
    WHERE requester_id = _requester_id
      AND addressee_id = _addressee_id;
  END IF;

  -- Create request + notification (with conflict guard for concurrent calls).
  INSERT INTO public.friendships (requester_id, addressee_id, status, created_at)
  VALUES (_requester_id, _addressee_id, 'pending', now())
  ON CONFLICT (requester_id, addressee_id) DO NOTHING
  RETURNING * INTO _new_friendship;

  -- If the insert was a no-op due to conflict, fetch the existing row
  IF _new_friendship IS NULL THEN
    SELECT * INTO _new_friendship
    FROM public.friendships
    WHERE requester_id = _requester_id AND addressee_id = _addressee_id;

    IF _new_friendship IS NOT NULL THEN
      RETURN json_build_object('id', _new_friendship.id, 'status', _new_friendship.status);
    END IF;
    RAISE EXCEPTION 'Friend request already pending';
  END IF;

  PERFORM public.create_notification(
    _user_id := _addressee_id,
    _type := 'friend_request',
    _title := 'New Friend Request',
    _body := (SELECT username FROM public.users WHERE id = _requester_id) || ' sent you a friend request',
    _link := '/app'
  );

  RETURN json_build_object('id', _new_friendship.id, 'status', 'pending');
END;
$$;
