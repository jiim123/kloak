-- Harden friend-request abuse paths against automated direct API calls.
-- Approach:
-- 1) Enforce identity binding (already present).
-- 2) Add DB-side rate limits (short burst + hourly).
-- 3) Require shared context (shared server or existing DM) before requesting.
-- 4) Cap outstanding pending requests per requester.

BEGIN;

CREATE OR REPLACE FUNCTION public.send_friend_request(_requester_id uuid, _addressee_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
BEGIN
  _caller_id := public.get_request_user_id();
  IF _caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _requester_id IS DISTINCT FROM _caller_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Abuse control: burst + sustained rate limiting.
  IF NOT public.check_rate_limit(_requester_id::text, 'friend_request_burst', 5, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many friend requests. Please wait a minute.';
  END IF;
  IF NOT public.check_rate_limit(_requester_id::text, 'friend_request_hourly', 25, 3600) THEN
    RAISE EXCEPTION 'Rate limited: friend request quota reached. Try again later.';
  END IF;

  -- Find the addressee by username.
  SELECT id INTO _addressee_id
  FROM users
  WHERE lower(username) = lower(_addressee_username);

  IF _addressee_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if trying to friend self.
  IF _addressee_id = _requester_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Abuse control: disallow unsolicited global requests without relationship context.
  IF NOT public.shares_server_with(_requester_id, _addressee_id)
     AND NOT public.shares_dm_with(_requester_id, _addressee_id) THEN
    RAISE EXCEPTION 'Cannot send friend request to this user';
  END IF;

  -- Abuse control: cap outstanding outgoing pending requests.
  SELECT count(*)::int INTO _pending_outgoing_count
  FROM friendships
  WHERE requester_id = _requester_id
    AND status = 'pending';

  IF _pending_outgoing_count >= 50 THEN
    RAISE EXCEPTION 'Too many pending friend requests. Cancel some and try again.';
  END IF;

  -- Check for existing friendship in either direction.
  SELECT * INTO _existing_friendship
  FROM friendships
  WHERE (requester_id = _requester_id AND addressee_id = _addressee_id)
     OR (requester_id = _addressee_id AND addressee_id = _requester_id);

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
        UPDATE friendships
        SET status = 'accepted'
        WHERE id = _existing_friendship.id
        RETURNING * INTO _existing_friendship;

        RETURN json_build_object('id', _existing_friendship.id, 'status', 'accepted');
      END IF;
    END IF;
  END IF;

  -- Check for recently declined request with cooldown.
  SELECT * INTO _declined_request
  FROM declined_friend_requests
  WHERE requester_id = _requester_id AND addressee_id = _addressee_id;

  IF _declined_request IS NOT NULL THEN
    _time_since_decline := now() - _declined_request.declined_at;

    IF _time_since_decline < (_cooldown_minutes || ' minutes')::interval THEN
      _remaining_minutes := ceil(extract(epoch from ((_cooldown_minutes || ' minutes')::interval - _time_since_decline)) / 60);
      RAISE EXCEPTION 'You can send another request in % minute(s)', _remaining_minutes;
    END IF;

    DELETE FROM declined_friend_requests
    WHERE requester_id = _requester_id AND addressee_id = _addressee_id;
  END IF;

  -- Create new friendship request.
  INSERT INTO friendships (requester_id, addressee_id, status, created_at)
  VALUES (_requester_id, _addressee_id, 'pending', now())
  RETURNING * INTO _new_friendship;

  -- Create notification for addressee.
  PERFORM create_notification(
    _user_id := _addressee_id,
    _type := 'friend_request',
    _title := 'New Friend Request',
    _body := (SELECT username FROM users WHERE id = _requester_id) || ' sent you a friend request',
    _link := '/app'
  );

  RETURN json_build_object('id', _new_friendship.id, 'status', 'pending');
END;
$function$;

COMMIT;
