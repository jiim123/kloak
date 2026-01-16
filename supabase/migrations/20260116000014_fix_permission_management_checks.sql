-- Fix permission management RPC functions to use permission checks instead of hardcoded role checks
-- This allows users with custom roles that have manage_roles/manage_channels to edit permissions

-- Update set_role_permission to use permission check
CREATE OR REPLACE FUNCTION public.set_role_permission(
  _server_id uuid,
  _user_id uuid,
  _permission permission_type,
  _role_id uuid DEFAULT NULL,
  _role_name server_role DEFAULT NULL,
  _allowed boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_permission_id uuid;
BEGIN
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Validate that either role_id or role_name is provided
  IF _role_id IS NULL AND _role_name IS NULL THEN
    RAISE EXCEPTION 'Either role_id or role_name must be provided';
  END IF;
  
  -- If role_id is provided, verify it belongs to the server
  IF _role_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM server_roles WHERE id = _role_id AND server_id = _server_id) THEN
      RAISE EXCEPTION 'Role not found in this server';
    END IF;
  END IF;
  
  -- Insert or update permission
  INSERT INTO role_permissions (server_id, role_id, role_name, permission, allowed)
  VALUES (_server_id, _role_id, _role_name, _permission, _allowed)
  ON CONFLICT (server_id, role_id, role_name, permission)
  DO UPDATE SET allowed = _allowed;
  
  -- Return the permission
  SELECT id INTO new_permission_id
  FROM role_permissions
  WHERE server_id = _server_id
    AND (role_id = _role_id OR role_id IS NULL)
    AND (role_name = _role_name OR role_name IS NULL)
    AND permission = _permission;
  
  RETURN (
    SELECT json_build_object(
      'id', rp.id,
      'server_id', rp.server_id,
      'role_id', rp.role_id,
      'role_name', rp.role_name,
      'permission', rp.permission,
      'allowed', rp.allowed,
      'created_at', rp.created_at
    )
    FROM role_permissions rp
    WHERE rp.id = new_permission_id
  );
END;
$$;

-- Update delete_role_permission to use permission check
CREATE OR REPLACE FUNCTION public.delete_role_permission(
  _permission_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  permission_server_id uuid;
BEGIN
  -- Get permission's server_id
  SELECT server_id INTO permission_server_id
  FROM role_permissions
  WHERE id = _permission_id;
  
  IF permission_server_id IS NULL THEN
    RAISE EXCEPTION 'Permission not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, permission_server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Delete permission
  DELETE FROM role_permissions WHERE id = _permission_id;
  
  RETURN true;
END;
$$;

-- Update set_channel_permission to use permission check
CREATE OR REPLACE FUNCTION public.set_channel_permission(
  _channel_id uuid,
  _user_id uuid,
  _permission permission_type,
  _allowed boolean,
  _role_id uuid DEFAULT NULL,
  _role_name server_role DEFAULT NULL
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
  -- Users need manage_channels permission to set channel-specific overrides
  IF NOT public.check_user_server_permission(_user_id, channel_server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Validate that either role_id or role_name is provided
  IF _role_id IS NULL AND _role_name IS NULL THEN
    RAISE EXCEPTION 'Either role_id or role_name must be provided';
  END IF;
  
  -- If role_id is provided, verify it belongs to the server
  IF _role_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM server_roles WHERE id = _role_id AND server_id = channel_server_id) THEN
      RAISE EXCEPTION 'Role not found in this server';
    END IF;
  END IF;
  
  -- Insert or update permission
  INSERT INTO channel_permissions (channel_id, role_id, role_name, permission, allowed)
  VALUES (_channel_id, _role_id, _role_name, _permission, _allowed)
  ON CONFLICT (channel_id, role_id, role_name, permission)
  DO UPDATE SET allowed = _allowed;
  
  -- Return the permission
  SELECT id INTO new_permission_id
  FROM channel_permissions
  WHERE channel_id = _channel_id
    AND (role_id = _role_id OR role_id IS NULL)
    AND (role_name = _role_name OR role_name IS NULL)
    AND permission = _permission;
  
  RETURN (
    SELECT json_build_object(
      'id', cp.id,
      'channel_id', cp.channel_id,
      'role_id', cp.role_id,
      'role_name', cp.role_name,
      'permission', cp.permission,
      'allowed', cp.allowed,
      'created_at', cp.created_at
    )
    FROM channel_permissions cp
    WHERE cp.id = new_permission_id
  );
END;
$$;

-- Update delete_channel_permission to use permission check
CREATE OR REPLACE FUNCTION public.delete_channel_permission(
  _permission_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  permission_channel_id uuid;
  channel_server_id uuid;
BEGIN
  -- Get permission's channel_id
  SELECT channel_id INTO permission_channel_id
  FROM channel_permissions
  WHERE id = _permission_id;
  
  IF permission_channel_id IS NULL THEN
    RAISE EXCEPTION 'Permission not found';
  END IF;
  
  -- Get channel's server_id
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = permission_channel_id;
  
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  -- Check permission using database-backed permission system
  -- Users need manage_channels permission to delete channel-specific overrides
  IF NOT public.check_user_server_permission(_user_id, channel_server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Delete permission
  DELETE FROM channel_permissions WHERE id = _permission_id;
  
  RETURN true;
END;
$$;
