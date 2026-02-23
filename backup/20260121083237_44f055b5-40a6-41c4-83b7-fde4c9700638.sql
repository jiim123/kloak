-- Update send_friend_request to allow re-sending after 5 minutes when declined
CREATE OR REPLACE FUNCTION public.send_friend_request(_requester_id uuid, _addressee_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _addressee_id uuid;
  _existing_friendship record;
  _new_friendship record;
  _cooldown_minutes int := 5;
BEGIN
  -- Find the addressee by username
  SELECT id INTO _addressee_id
  FROM users
  WHERE lower(username) = lower(_addressee_username);

  IF _addressee_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if trying to friend self
  IF _addressee_id = _requester_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check for existing friendship in either direction
  SELECT * INTO _existing_friendship
  FROM friendships
  WHERE (requester_id = _requester_id AND addressee_id = _addressee_id)
     OR (requester_id = _addressee_id AND addressee_id = _requester_id);

  IF _existing_friendship IS NOT NULL THEN
    -- Already friends
    IF _existing_friendship.status = 'accepted' THEN
      RAISE EXCEPTION 'Already friends with this user';
    END IF;

    -- Blocked by either party
    IF _existing_friendship.status = 'blocked' THEN
      RAISE EXCEPTION 'Cannot send friend request';
    END IF;

    -- Pending request exists
    IF _existing_friendship.status = 'pending' THEN
      -- If I sent the request before, check if we're within cooldown period
      IF _existing_friendship.requester_id = _requester_id THEN
        RAISE EXCEPTION 'Friend request already pending';
      ELSE
        -- The other user sent me a request, I can accept by sending one back
        UPDATE friendships
        SET status = 'accepted'
        WHERE id = _existing_friendship.id
        RETURNING * INTO _existing_friendship;
        
        RETURN json_build_object('id', _existing_friendship.id, 'status', 'accepted');
      END IF;
    END IF;

    -- For declined status (row was deleted), we'll handle below as no existing friendship
  END IF;

  -- Create new friendship request
  INSERT INTO friendships (requester_id, addressee_id, status, created_at)
  VALUES (_requester_id, _addressee_id, 'pending', now())
  RETURNING * INTO _new_friendship;

  -- Create notification for addressee
  PERFORM create_notification(
    _user_id := _addressee_id,
    _type := 'friend_request',
    _title := 'New Friend Request',
    _body := (SELECT username FROM users WHERE id = _requester_id) || ' sent you a friend request',
    _link := '/app'
  );

  RETURN json_build_object('id', _new_friendship.id, 'status', 'pending');
END;
$$;

-- Update decline_friend_request to delete the friendship record so user can re-request
CREATE OR REPLACE FUNCTION public.decline_friend_request(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _friendship record;
BEGIN
  -- Get the friendship
  SELECT * INTO _friendship
  FROM friendships
  WHERE id = _friendship_id;

  IF _friendship IS NULL THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;

  -- User must be the addressee
  IF _friendship.addressee_id != _user_id THEN
    RAISE EXCEPTION 'You can only decline requests sent to you';
  END IF;

  -- Only decline pending requests
  IF _friendship.status != 'pending' THEN
    RAISE EXCEPTION 'Can only decline pending requests';
  END IF;

  -- Delete the friendship record instead of updating status
  -- This allows the requester to send a new request after cooldown
  DELETE FROM friendships WHERE id = _friendship_id;

  RETURN true;
END;
$$;

-- Create a table to track declined friend requests with cooldown
CREATE TABLE IF NOT EXISTS public.declined_friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  declined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- Enable RLS
ALTER TABLE public.declined_friend_requests ENABLE ROW LEVEL SECURITY;

-- Policies for declined_friend_requests
CREATE POLICY "Declined requests viewable by involved users"
ON public.declined_friend_requests FOR SELECT
USING (true);

CREATE POLICY "Declined requests can be inserted"
ON public.declined_friend_requests FOR INSERT
WITH CHECK (true);

CREATE POLICY "Declined requests can be deleted"
ON public.declined_friend_requests FOR DELETE
USING (true);

-- Update decline_friend_request to record the decline
CREATE OR REPLACE FUNCTION public.decline_friend_request(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _friendship record;
BEGIN
  -- Get the friendship
  SELECT * INTO _friendship
  FROM friendships
  WHERE id = _friendship_id;

  IF _friendship IS NULL THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;

  -- User must be the addressee
  IF _friendship.addressee_id != _user_id THEN
    RAISE EXCEPTION 'You can only decline requests sent to you';
  END IF;

  -- Only decline pending requests
  IF _friendship.status != 'pending' THEN
    RAISE EXCEPTION 'Can only decline pending requests';
  END IF;

  -- Record the decline with timestamp
  INSERT INTO declined_friend_requests (requester_id, addressee_id, declined_at)
  VALUES (_friendship.requester_id, _friendship.addressee_id, now())
  ON CONFLICT (requester_id, addressee_id) 
  DO UPDATE SET declined_at = now();

  -- Delete the friendship record
  DELETE FROM friendships WHERE id = _friendship_id;

  RETURN true;
END;
$$;

-- Update send_friend_request to check cooldown from declined_friend_requests table
CREATE OR REPLACE FUNCTION public.send_friend_request(_requester_id uuid, _addressee_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _addressee_id uuid;
  _existing_friendship record;
  _declined_request record;
  _new_friendship record;
  _cooldown_minutes int := 5;
  _time_since_decline interval;
  _remaining_minutes int;
BEGIN
  -- Find the addressee by username
  SELECT id INTO _addressee_id
  FROM users
  WHERE lower(username) = lower(_addressee_username);

  IF _addressee_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Check if trying to friend self
  IF _addressee_id = _requester_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;

  -- Check for existing friendship in either direction
  SELECT * INTO _existing_friendship
  FROM friendships
  WHERE (requester_id = _requester_id AND addressee_id = _addressee_id)
     OR (requester_id = _addressee_id AND addressee_id = _requester_id);

  IF _existing_friendship IS NOT NULL THEN
    -- Already friends
    IF _existing_friendship.status = 'accepted' THEN
      RAISE EXCEPTION 'Already friends with this user';
    END IF;

    -- Blocked by either party
    IF _existing_friendship.status = 'blocked' THEN
      RAISE EXCEPTION 'Cannot send friend request';
    END IF;

    -- Pending request exists
    IF _existing_friendship.status = 'pending' THEN
      IF _existing_friendship.requester_id = _requester_id THEN
        RAISE EXCEPTION 'Friend request already pending';
      ELSE
        -- The other user sent me a request, I can accept by sending one back
        UPDATE friendships
        SET status = 'accepted'
        WHERE id = _existing_friendship.id
        RETURNING * INTO _existing_friendship;
        
        RETURN json_build_object('id', _existing_friendship.id, 'status', 'accepted');
      END IF;
    END IF;
  END IF;

  -- Check for recently declined request with cooldown
  SELECT * INTO _declined_request
  FROM declined_friend_requests
  WHERE requester_id = _requester_id AND addressee_id = _addressee_id;

  IF _declined_request IS NOT NULL THEN
    _time_since_decline := now() - _declined_request.declined_at;
    
    IF _time_since_decline < (_cooldown_minutes || ' minutes')::interval THEN
      _remaining_minutes := ceil(extract(epoch from ((_cooldown_minutes || ' minutes')::interval - _time_since_decline)) / 60);
      RAISE EXCEPTION 'You can send another request in % minute(s)', _remaining_minutes;
    END IF;
    
    -- Cooldown passed, remove the declined record
    DELETE FROM declined_friend_requests 
    WHERE requester_id = _requester_id AND addressee_id = _addressee_id;
  END IF;

  -- Create new friendship request
  INSERT INTO friendships (requester_id, addressee_id, status, created_at)
  VALUES (_requester_id, _addressee_id, 'pending', now())
  RETURNING * INTO _new_friendship;

  -- Create notification for addressee
  PERFORM create_notification(
    _user_id := _addressee_id,
    _type := 'friend_request',
    _title := 'New Friend Request',
    _body := (SELECT username FROM users WHERE id = _requester_id) || ' sent you a friend request',
    _link := '/app'
  );

  RETURN json_build_object('id', _new_friendship.id, 'status', 'pending');
END;
$$;