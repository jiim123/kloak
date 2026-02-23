-- Create a function to fetch server channels (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_server_channels(_server_id uuid)
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
        'id', c.id,
        'server_id', c.server_id,
        'category_id', c.category_id,
        'name', c.name,
        'topic', c.topic,
        'type', c.type,
        'position', c.position,
        'is_nsfw', c.is_nsfw,
        'slowmode_seconds', c.slowmode_seconds,
        'icon', c.icon,
        'created_at', c.created_at
      ) ORDER BY c.position
    )
    FROM channels c
    WHERE c.server_id = _server_id
  );
END;
$$;

-- Create a function to fetch server categories (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_server_categories(_server_id uuid)
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
        'id', cc.id,
        'server_id', cc.server_id,
        'name', cc.name,
        'position', cc.position,
        'is_collapsed', cc.is_collapsed,
        'created_at', cc.created_at
      ) ORDER BY cc.position
    )
    FROM channel_categories cc
    WHERE cc.server_id = _server_id
  );
END;
$$;

-- Create a function to fetch server members (bypasses RLS)
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
          'status', u.status,
          'custom_status', u.custom_status,
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