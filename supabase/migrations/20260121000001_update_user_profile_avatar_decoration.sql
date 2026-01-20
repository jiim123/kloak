-- Update update_user_profile function to include avatar_decoration
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
    avatar_decoration = COALESCE(_updates->>'avatar_decoration', avatar_decoration),
    banner_color = COALESCE(_updates->>'banner_color', banner_color),
    custom_status = COALESCE(_updates->>'custom_status', custom_status)
  WHERE id = _user_id;
  
  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'avatar_decoration', u.avatar_decoration,
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
