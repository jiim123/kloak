-- Update set_role_permission and set_channel_permission to handle the new partial unique indexes
-- This fixes the 400 errors when saving permissions

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
  user_role server_role;
  new_permission_id uuid;
BEGIN
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can manage role permissions';
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
  
  -- Insert or update permission using manual check since we have partial unique indexes
  IF _role_id IS NOT NULL THEN
    INSERT INTO role_permissions (server_id, role_id, role_name, permission, allowed)
    VALUES (_server_id, _role_id, NULL, _permission, _allowed)
    ON CONFLICT (server_id, role_id, permission) WHERE role_id IS NOT NULL
    DO UPDATE SET allowed = _allowed;
  ELSE
    INSERT INTO role_permissions (server_id, role_id, role_name, permission, allowed)
    VALUES (_server_id, NULL, _role_name, _permission, _allowed)
    ON CONFLICT (server_id, role_name, permission) WHERE role_name IS NOT NULL
    DO UPDATE SET allowed = _allowed;
  END IF;
  
  -- Get the ID of the inserted/updated row
  SELECT id INTO new_permission_id
  FROM role_permissions
  WHERE server_id = _server_id
    AND (role_id = _role_id OR (_role_id IS NULL AND role_id IS NULL))
    AND (role_name = _role_name OR (_role_name IS NULL AND role_name IS NULL))
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
  user_role server_role;
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
  
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = channel_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can manage channel permissions';
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
  
  -- Insert or update permission using manual check since we have partial unique indexes
  IF _role_id IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, role_id, role_name, permission, allowed)
    VALUES (_channel_id, _role_id, NULL, _permission, _allowed)
    ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL
    DO UPDATE SET allowed = _allowed;
  ELSE
    INSERT INTO channel_permissions (channel_id, role_id, role_name, permission, allowed)
    VALUES (_channel_id, NULL, _role_name, _permission, _allowed)
    ON CONFLICT (channel_id, role_name, permission) WHERE role_name IS NOT NULL
    DO UPDATE SET allowed = _allowed;
  END IF;
  
  -- Get the ID of the inserted/updated row
  SELECT id INTO new_permission_id
  FROM channel_permissions
  WHERE channel_id = _channel_id
    AND (role_id = _role_id OR (_role_id IS NULL AND role_id IS NULL))
    AND (role_name = _role_name OR (_role_name IS NULL AND role_name IS NULL))
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
