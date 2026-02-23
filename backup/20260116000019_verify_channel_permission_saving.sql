-- Add a helper function to debug channel permissions
-- This will help verify that permissions are being saved correctly
CREATE OR REPLACE FUNCTION public.debug_channel_permissions(
  _channel_id uuid,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  result json;
BEGIN
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN json_build_object('error', 'Channel not found');
  END IF;
  
  -- Get user's base role
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  -- Get user's custom role IDs
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Get all channel permissions for this channel
  -- Get channel permissions that match this user's roles
  RETURN json_build_object(
    'channel_id', _channel_id,
    'user_id', _user_id,
    'base_role', user_base_role,
    'custom_role_ids', user_custom_role_ids,
    'channel_permissions', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
        AND (
          (cp.role_name = user_base_role AND cp.role_id IS NULL) OR
          (cp.role_id = ANY(COALESCE(user_custom_role_ids, ARRAY[]::uuid[])))
        )
    ),
    'all_channel_permissions', (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
    )
  );
END;
$$;
