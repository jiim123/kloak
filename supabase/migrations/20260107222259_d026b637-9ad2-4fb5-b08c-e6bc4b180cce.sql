-- Get user by ID function
CREATE OR REPLACE FUNCTION public.get_user_by_id(_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  )
  FROM users u WHERE u.id = _user_id;
$$;