-- Update get_server_channels to include block_links, allowed_link_domains, and ghost_mode fields
CREATE OR REPLACE FUNCTION public.get_server_channels(_server_id uuid, _user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean := false;
BEGIN
  -- Check if user is admin/owner (they can see all channels)
  IF _user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM server_members 
      WHERE server_id = _server_id 
      AND user_id = _user_id 
      AND role IN ('owner', 'admin')
    ) INTO _is_admin;
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(
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
        'is_read_only', c.is_read_only,
        'icon', c.icon,
        'is_private', c.is_private,
        'block_links', c.block_links,
        'allowed_link_domains', c.allowed_link_domains,
        'ghost_mode', c.ghost_mode,
        'created_at', c.created_at
      ) ORDER BY c.position
    ), '[]'::json)
    FROM channels c
    WHERE c.server_id = _server_id
    AND (
      -- Not private, visible to all
      NOT c.is_private
      -- Or user is admin/owner
      OR _is_admin
      -- Or user is a channel member
      OR (_user_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM channel_members cm 
        WHERE cm.channel_id = c.id AND cm.user_id = _user_id
      ))
    )
  );
END;
$$;