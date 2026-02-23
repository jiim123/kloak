-- Create permission enum type
CREATE TYPE public.permission_type AS ENUM (
  'manage_server',
  'manage_roles',
  'manage_channels',
  'kick_members',
  'ban_members',
  'mute_members',
  'manage_nicknames',
  'manage_messages',
  'pin_messages',
  'send_messages',
  'add_reactions',
  'view_channels',
  'transfer_ownership',
  'manage_invites'
);

-- Create role_permissions table
-- Stores permissions for custom roles (and can store for default server_role enum too)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.server_roles(id) ON DELETE CASCADE,
  -- For default roles (owner, admin, moderator, member), role_id is NULL and we use role_name
  role_name server_role,
  permission permission_type NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure either role_id or role_name is set, but not both
  CONSTRAINT role_permissions_role_check CHECK (
    (role_id IS NOT NULL AND role_name IS NULL) OR 
    (role_id IS NULL AND role_name IS NOT NULL)
  ),
  -- Prevent duplicate permissions for the same role
  UNIQUE(server_id, role_id, role_name, permission)
);

-- Create channel_permissions table
-- Stores channel-specific permission overrides (allow/deny) for roles
CREATE TABLE public.channel_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.server_roles(id) ON DELETE CASCADE,
  -- For default roles (owner, admin, moderator, member), role_id is NULL and we use role_name
  role_name server_role,
  permission permission_type NOT NULL,
  allowed BOOLEAN NOT NULL, -- true = allow, false = deny
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure either role_id or role_name is set, but not both
  CONSTRAINT channel_permissions_role_check CHECK (
    (role_id IS NOT NULL AND role_name IS NULL) OR 
    (role_id IS NULL AND role_name IS NOT NULL)
  ),
  -- Prevent duplicate permissions for the same role in the same channel
  UNIQUE(channel_id, role_id, role_name, permission)
);

-- Create indexes for performance
CREATE INDEX idx_role_permissions_server ON public.role_permissions(server_id);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_role_name ON public.role_permissions(server_id, role_name);
CREATE INDEX idx_channel_permissions_channel ON public.channel_permissions(channel_id);
CREATE INDEX idx_channel_permissions_role_id ON public.channel_permissions(role_id);
CREATE INDEX idx_channel_permissions_role_name ON public.channel_permissions(channel_id, role_name);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for role_permissions
CREATE POLICY "Role permissions viewable by members" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update role permissions" ON public.role_permissions FOR UPDATE USING (true);
CREATE POLICY "Admins can delete role permissions" ON public.role_permissions FOR DELETE USING (true);

-- RLS Policies for channel_permissions
CREATE POLICY "Channel permissions viewable by members" ON public.channel_permissions FOR SELECT USING (true);
CREATE POLICY "Admins can manage channel permissions" ON public.channel_permissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update channel permissions" ON public.channel_permissions FOR UPDATE USING (true);
CREATE POLICY "Admins can delete channel permissions" ON public.channel_permissions FOR DELETE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.role_permissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channel_permissions;

-- Function to get role permissions for a server
CREATE OR REPLACE FUNCTION public.get_role_permissions(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', rp.id,
          'server_id', rp.server_id,
          'role_id', rp.role_id,
          'role_name', rp.role_name,
          'permission', rp.permission,
          'allowed', rp.allowed,
          'created_at', rp.created_at
        ) ORDER BY rp.created_at ASC
      )
      FROM role_permissions rp
      WHERE rp.server_id = _server_id
    ),
    '[]'::json
  );
END;
$$;

-- Function to get channel permissions for a channel
CREATE OR REPLACE FUNCTION public.get_channel_permissions(_channel_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'channel_id', cp.channel_id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed,
          'created_at', cp.created_at
        ) ORDER BY cp.created_at ASC
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
    ),
    '[]'::json
  );
END;
$$;

-- Function to set role permission
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

-- Function to set channel permission
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

-- Function to delete role permission
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
  user_role server_role;
  permission_server_id uuid;
BEGIN
  -- Get permission's server_id
  SELECT server_id INTO permission_server_id
  FROM role_permissions
  WHERE id = _permission_id;
  
  IF permission_server_id IS NULL THEN
    RAISE EXCEPTION 'Permission not found';
  END IF;
  
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = permission_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can delete role permissions';
  END IF;
  
  -- Delete permission
  DELETE FROM role_permissions WHERE id = _permission_id;
  
  RETURN true;
END;
$$;

-- Function to delete channel permission
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
  user_role server_role;
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
  
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = channel_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can delete channel permissions';
  END IF;
  
  -- Delete permission
  DELETE FROM channel_permissions WHERE id = _permission_id;
  
  RETURN true;
END;
$$;
