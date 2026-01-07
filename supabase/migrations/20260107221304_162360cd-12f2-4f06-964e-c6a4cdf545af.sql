-- Update get_server_members to include all user fields
CREATE OR REPLACE FUNCTION public.get_server_members(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', sm.id,
        'server_id', sm.server_id,
        'user_id', sm.user_id,
        'role', sm.role,
        'nickname', sm.nickname,
        'is_banned', sm.is_banned,
        'is_muted', sm.is_muted,
        'joined_at', sm.joined_at,
        'user', json_build_object(
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
      )
    )
    FROM server_members sm
    JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id
  );
END;
$$;