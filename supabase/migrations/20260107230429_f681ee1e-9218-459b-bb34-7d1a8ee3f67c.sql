-- RPC function to update user profile
CREATE OR REPLACE FUNCTION public.update_user_profile(
  _user_id uuid,
  _updates json
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  UPDATE users SET
    display_name = COALESCE(_updates->>'display_name', display_name),
    bio = COALESCE(_updates->>'bio', bio),
    avatar_url = COALESCE(_updates->>'avatar_url', avatar_url),
    banner_color = COALESCE(_updates->>'banner_color', banner_color),
    custom_status = COALESCE(_updates->>'custom_status', custom_status)
  WHERE id = _user_id;
  
  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_color', u.banner_color,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result FROM users u WHERE u.id = _user_id;
  
  RETURN result;
END;
$$;

-- RPC function to update user status
CREATE OR REPLACE FUNCTION public.update_user_status(
  _user_id uuid,
  _status user_status
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET status = _status, last_seen = now() WHERE id = _user_id;
  RETURN true;
END;
$$;

-- RPC function to update last seen
CREATE OR REPLACE FUNCTION public.update_user_last_seen(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users SET last_seen = now() WHERE id = _user_id;
  RETURN true;
END;
$$;

-- RPC function to login user by key hash
CREATE OR REPLACE FUNCTION public.login_user(_key_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_color', u.banner_color,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result 
  FROM users u 
  WHERE u.key_hash = _key_hash;
  
  IF result IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Update status to online
  UPDATE users SET status = 'online', last_seen = now() WHERE key_hash = _key_hash;
  
  RETURN result;
END;
$$;