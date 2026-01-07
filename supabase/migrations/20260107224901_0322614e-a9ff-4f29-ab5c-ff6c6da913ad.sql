-- Create RPC function to send a friend request
CREATE OR REPLACE FUNCTION public.send_friend_request(_requester_id uuid, _addressee_username text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  addressee_user_id uuid;
  existing_friendship record;
  new_friendship_id uuid;
  result json;
BEGIN
  -- Find user by username
  SELECT id INTO addressee_user_id FROM users WHERE username = lower(_addressee_username);
  
  IF addressee_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  IF addressee_user_id = _requester_id THEN
    RAISE EXCEPTION 'Cannot send friend request to yourself';
  END IF;
  
  -- Check for existing friendship in either direction
  SELECT * INTO existing_friendship FROM friendships
  WHERE (requester_id = _requester_id AND addressee_id = addressee_user_id)
     OR (requester_id = addressee_user_id AND addressee_id = _requester_id);
  
  IF existing_friendship IS NOT NULL THEN
    IF existing_friendship.status = 'accepted' THEN
      RAISE EXCEPTION 'Already friends with this user';
    ELSIF existing_friendship.status = 'pending' THEN
      IF existing_friendship.requester_id = _requester_id THEN
        RAISE EXCEPTION 'Friend request already sent';
      ELSE
        -- Accept the pending request from the other user
        UPDATE friendships SET status = 'accepted' WHERE id = existing_friendship.id;
        SELECT json_build_object(
          'id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id,
          'status', f.status, 'created_at', f.created_at
        ) INTO result FROM friendships f WHERE f.id = existing_friendship.id;
        RETURN result;
      END IF;
    ELSIF existing_friendship.status = 'blocked' THEN
      RAISE EXCEPTION 'Cannot send friend request to this user';
    END IF;
  END IF;
  
  -- Create new friend request
  INSERT INTO friendships (requester_id, addressee_id, status)
  VALUES (_requester_id, addressee_user_id, 'pending')
  RETURNING id INTO new_friendship_id;
  
  SELECT json_build_object(
    'id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id,
    'status', f.status, 'created_at', f.created_at
  ) INTO result FROM friendships f WHERE f.id = new_friendship_id;
  
  RETURN result;
END;
$$;

-- Create RPC function to accept a friend request
CREATE OR REPLACE FUNCTION public.accept_friend_request(_friendship_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Only the addressee can accept
  IF NOT EXISTS (
    SELECT 1 FROM friendships 
    WHERE id = _friendship_id AND addressee_id = _user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot accept this friend request';
  END IF;
  
  UPDATE friendships SET status = 'accepted' WHERE id = _friendship_id;
  
  SELECT json_build_object(
    'id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id,
    'status', f.status, 'created_at', f.created_at
  ) INTO result FROM friendships f WHERE f.id = _friendship_id;
  
  RETURN result;
END;
$$;

-- Create RPC function to decline a friend request
CREATE OR REPLACE FUNCTION public.decline_friend_request(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the addressee can decline
  IF NOT EXISTS (
    SELECT 1 FROM friendships 
    WHERE id = _friendship_id AND addressee_id = _user_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'Cannot decline this friend request';
  END IF;
  
  DELETE FROM friendships WHERE id = _friendship_id;
  RETURN true;
END;
$$;

-- Create RPC function to remove a friend
CREATE OR REPLACE FUNCTION public.remove_friend(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Either party can remove the friendship
  IF NOT EXISTS (
    SELECT 1 FROM friendships 
    WHERE id = _friendship_id 
    AND (requester_id = _user_id OR addressee_id = _user_id)
    AND status = 'accepted'
  ) THEN
    RAISE EXCEPTION 'Friendship not found';
  END IF;
  
  DELETE FROM friendships WHERE id = _friendship_id;
  RETURN true;
END;
$$;

-- Create RPC function to block a user
CREATE OR REPLACE FUNCTION public.block_user(_user_id uuid, _blocked_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_friendship record;
  result json;
BEGIN
  IF _user_id = _blocked_user_id THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;
  
  -- Check for existing friendship
  SELECT * INTO existing_friendship FROM friendships
  WHERE (requester_id = _user_id AND addressee_id = _blocked_user_id)
     OR (requester_id = _blocked_user_id AND addressee_id = _user_id);
  
  IF existing_friendship IS NOT NULL THEN
    -- Update to blocked status
    UPDATE friendships SET status = 'blocked', requester_id = _user_id, addressee_id = _blocked_user_id
    WHERE id = existing_friendship.id;
    
    SELECT json_build_object(
      'id', f.id, 'requester_id', f.requester_id, 'addressee_id', f.addressee_id,
      'status', f.status, 'created_at', f.created_at
    ) INTO result FROM friendships f WHERE f.id = existing_friendship.id;
  ELSE
    -- Create new blocked record
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (_user_id, _blocked_user_id, 'blocked')
    RETURNING json_build_object('id', id, 'requester_id', requester_id, 'addressee_id', addressee_id, 'status', status, 'created_at', created_at)
    INTO result;
  END IF;
  
  RETURN result;
END;
$$;

-- Create RPC function to unblock a user
CREATE OR REPLACE FUNCTION public.unblock_user(_user_id uuid, _blocked_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only the blocker can unblock
  DELETE FROM friendships 
  WHERE requester_id = _user_id AND addressee_id = _blocked_user_id AND status = 'blocked';
  
  RETURN true;
END;
$$;

-- Create RPC function to get user's friends
CREATE OR REPLACE FUNCTION public.get_user_friends(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(friend)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', CASE 
          WHEN f.requester_id = _user_id THEN (
            SELECT json_build_object(
              'id', u.id, 'username', u.username, 'display_name', u.display_name,
              'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status,
              'custom_status', u.custom_status
            ) FROM users u WHERE u.id = f.addressee_id
          )
          ELSE (
            SELECT json_build_object(
              'id', u.id, 'username', u.username, 'display_name', u.display_name,
              'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status,
              'custom_status', u.custom_status
            ) FROM users u WHERE u.id = f.requester_id
          )
        END
      ) as friend
      FROM friendships f
      WHERE (f.requester_id = _user_id OR f.addressee_id = _user_id)
      AND f.status = 'accepted'
    ) sub
  );
END;
$$;

-- Create RPC function to get pending friend requests (incoming)
CREATE OR REPLACE FUNCTION public.get_pending_friend_requests(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(request)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id, 'username', u.username, 'display_name', u.display_name,
            'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
          ) FROM users u WHERE u.id = f.requester_id
        )
      ) as request
      FROM friendships f
      WHERE f.addressee_id = _user_id AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ) sub
  );
END;
$$;

-- Create RPC function to get outgoing friend requests
CREATE OR REPLACE FUNCTION public.get_outgoing_friend_requests(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(request)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'status', f.status,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id, 'username', u.username, 'display_name', u.display_name,
            'avatar_url', u.avatar_url, 'banner_color', u.banner_color, 'status', u.status
          ) FROM users u WHERE u.id = f.addressee_id
        )
      ) as request
      FROM friendships f
      WHERE f.requester_id = _user_id AND f.status = 'pending'
      ORDER BY f.created_at DESC
    ) sub
  );
END;
$$;

-- Create RPC function to get blocked users
CREATE OR REPLACE FUNCTION public.get_blocked_users(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(blocked)
    FROM (
      SELECT json_build_object(
        'id', f.id,
        'created_at', f.created_at,
        'user', (
          SELECT json_build_object(
            'id', u.id, 'username', u.username, 'display_name', u.display_name,
            'avatar_url', u.avatar_url, 'banner_color', u.banner_color
          ) FROM users u WHERE u.id = f.addressee_id
        )
      ) as blocked
      FROM friendships f
      WHERE f.requester_id = _user_id AND f.status = 'blocked'
    ) sub
  );
END;
$$;