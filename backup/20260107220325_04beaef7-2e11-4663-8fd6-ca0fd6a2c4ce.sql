-- Create a secure function to register new users
-- This bypasses RLS since the app uses custom secret key auth, not Supabase Auth
CREATE OR REPLACE FUNCTION public.register_user(
  _username text,
  _key_hash text,
  _banner_color text DEFAULT '#5865F2'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_user_id uuid;
  result json;
BEGIN
  -- Validate username format
  IF length(_username) < 3 OR length(_username) > 20 THEN
    RAISE EXCEPTION 'Username must be between 3 and 20 characters';
  END IF;
  
  IF _username !~ '^[a-z0-9_]+$' THEN
    RAISE EXCEPTION 'Username can only contain lowercase letters, numbers, and underscores';
  END IF;
  
  -- Check for reserved usernames
  IF _username IN ('admin', 'administrator', 'moderator', 'user', 'system', 'root', 'support', 'help') THEN
    RAISE EXCEPTION 'This username is reserved';
  END IF;
  
  -- Check if username exists
  IF EXISTS (SELECT 1 FROM users WHERE username = _username) THEN
    RAISE EXCEPTION 'Username already taken';
  END IF;
  
  -- Insert the new user
  INSERT INTO users (username, key_hash, status, banner_color)
  VALUES (_username, _key_hash, 'online', _banner_color)
  RETURNING id INTO new_user_id;
  
  -- Return the created user data
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
  FROM users u WHERE u.id = new_user_id;
  
  RETURN result;
END;
$$;

-- Also create a function to check username availability (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM users WHERE username = lower(_username)
  );
$$;