-- Fix channel permission management to respect custom role permissions
-- The previous version used hardcoded role checks instead of the permission system

CREATE OR REPLACE FUNCTION public.set_channel_permission(
  _channel_id uuid,
  _user_id uuid,
  _permission permission_type,
  _allowed boolean,
  _role_id uuid DEFAULT NULL,
  _role_name server_role DEFAULT NULL,
  _target_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  new_permission_id uuid;
BEGIN
  -- Get channel's server_id
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  -- Check permission using database-backed permission system
  -- This properly checks custom roles with manage_channels permission
  IF NOT public.check_user_server_permission(_user_id, channel_server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Validate that exactly one target is provided
  IF (_role_id IS NOT NULL)::int + (_role_name IS NOT NULL)::int + (_target_user_id IS NOT NULL)::int != 1 THEN
    RAISE EXCEPTION 'Exactly one of role_id, role_name, or target_user_id must be provided';
  END IF;
  
  -- If role_id is provided, verify it belongs to the server
  IF _role_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM server_roles WHERE id = _role_id AND server_id = channel_server_id) THEN
      RAISE EXCEPTION 'Role not found in this server';
    END IF;
  END IF;
  
  -- If target_user_id is provided, verify they are a member
  IF _target_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = channel_server_id AND user_id = _target_user_id) THEN
      RAISE EXCEPTION 'Target user is not a member of this server';
    END IF;
  END IF;
  
  -- Delete existing matching permission first
  DELETE FROM channel_permissions
  WHERE channel_id = _channel_id
    AND permission = _permission
    AND (
      (_role_id IS NOT NULL AND role_id = _role_id AND role_name IS NULL AND user_id IS NULL) OR
      (_role_name IS NOT NULL AND role_name = _role_name AND role_id IS NULL AND user_id IS NULL) OR
      (_target_user_id IS NOT NULL AND user_id = _target_user_id AND role_id IS NULL AND role_name IS NULL)
    );
  
  -- Insert the new permission
  INSERT INTO channel_permissions (channel_id, role_id, role_name, user_id, permission, allowed)
  VALUES (_channel_id, _role_id, _role_name, _target_user_id, _permission, _allowed);
  
  -- Return the permission
  SELECT id INTO new_permission_id
  FROM channel_permissions
  WHERE channel_id = _channel_id
    AND (role_id = _role_id OR (role_id IS NULL AND _role_id IS NULL))
    AND (role_name = _role_name OR (role_name IS NULL AND _role_name IS NULL))
    AND (user_id = _target_user_id OR (user_id IS NULL AND _target_user_id IS NULL))
    AND permission = _permission;
  
  RETURN (
    SELECT json_build_object(
      'id', cp.id,
      'channel_id', cp.channel_id,
      'role_id', cp.role_id,
      'role_name', cp.role_name,
      'user_id', cp.user_id,
      'permission', cp.permission,
      'allowed', cp.allowed,
      'created_at', cp.created_at
    )
    FROM channel_permissions cp
    WHERE cp.id = new_permission_id
  );
END;
$$;