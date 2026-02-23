-- Add user profile banner URL and include it in auth/profile RPC payloads.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Update login_user to include banner_url
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
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
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

-- Update register_user to include banner_url in return payload
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
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
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

-- Update update_user_profile to support banner_url (and allow clearing via JSON null).
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
  _u jsonb := _updates::jsonb;
BEGIN
  UPDATE users SET
    display_name = COALESCE(_updates->>'display_name', display_name),
    bio = COALESCE(_updates->>'bio', bio),
    avatar_url = COALESCE(_updates->>'avatar_url', avatar_url),
    banner_url = CASE
      WHEN (_u ? 'banner_url') THEN (_updates->>'banner_url')
      ELSE banner_url
    END,
    avatar_decoration = CASE
      WHEN (_u ? 'avatar_decoration') THEN (_updates->>'avatar_decoration')
      ELSE avatar_decoration
    END,
    banner_color = COALESCE(_updates->>'banner_color', banner_color),
    profile_theme_primary = CASE
      WHEN (_u ? 'profile_theme_primary') THEN (_updates->>'profile_theme_primary')
      ELSE profile_theme_primary
    END,
    profile_theme_accent = CASE
      WHEN (_u ? 'profile_theme_accent') THEN (_updates->>'profile_theme_accent')
      ELSE profile_theme_accent
    END,
    custom_status = COALESCE(_updates->>'custom_status', custom_status)
  WHERE id = _user_id;
  
  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result FROM users u WHERE u.id = _user_id;
  
  RETURN result;
END;
$$;

