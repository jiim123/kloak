-- Create server_roles table
CREATE TABLE public.server_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color CHAR(7) NOT NULL DEFAULT '#5865F2',
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(server_id, name)
);

-- Create server_member_roles junction table
CREATE TABLE public.server_member_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.server_members(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.server_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(member_id, role_id)
);

-- Create indexes
CREATE INDEX idx_server_roles_server ON public.server_roles(server_id);
CREATE INDEX idx_server_roles_position ON public.server_roles(server_id, position);
CREATE INDEX idx_server_member_roles_member ON public.server_member_roles(member_id);
CREATE INDEX idx_server_member_roles_role ON public.server_member_roles(role_id);

-- Enable RLS
ALTER TABLE public.server_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.server_member_roles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for server_roles
CREATE POLICY "Server roles viewable by members" ON public.server_roles FOR SELECT USING (true);
CREATE POLICY "Admins can create roles" ON public.server_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can update roles" ON public.server_roles FOR UPDATE USING (true);
CREATE POLICY "Admins can delete roles" ON public.server_roles FOR DELETE USING (true);

-- RLS Policies for server_member_roles
CREATE POLICY "Member roles viewable by members" ON public.server_member_roles FOR SELECT USING (true);
CREATE POLICY "Admins can assign roles" ON public.server_member_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can remove roles" ON public.server_member_roles FOR DELETE USING (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_roles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.server_member_roles;

-- Function to get server roles
CREATE OR REPLACE FUNCTION public.get_server_roles(_server_id uuid)
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
        'id', sr.id,
        'server_id', sr.server_id,
        'name', sr.name,
        'color', sr.color,
        'position', sr.position,
        'created_at', sr.created_at
      )
    )
    FROM server_roles sr
    WHERE sr.server_id = _server_id
    ORDER BY sr.position ASC, sr.created_at ASC
  );
END;
$$;

-- Function to create a server role
CREATE OR REPLACE FUNCTION public.create_server_role(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _color text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role server_role;
  max_position integer;
  new_role_id uuid;
BEGIN
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can create roles';
  END IF;
  
  -- Get max position
  SELECT COALESCE(MAX(position), -1) + 1 INTO max_position
  FROM server_roles
  WHERE server_id = _server_id;
  
  -- Create role
  INSERT INTO server_roles (server_id, name, color, position)
  VALUES (_server_id, _name, _color, max_position)
  RETURNING id INTO new_role_id;
  
  RETURN (
    SELECT json_build_object(
      'id', sr.id,
      'server_id', sr.server_id,
      'name', sr.name,
      'color', sr.color,
      'position', sr.position,
      'created_at', sr.created_at
    )
    FROM server_roles sr
    WHERE sr.id = new_role_id
  );
END;
$$;

-- Function to update a server role
CREATE OR REPLACE FUNCTION public.update_server_role(
  _role_id uuid,
  _user_id uuid,
  _name text DEFAULT NULL,
  _color text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role server_role;
  role_server_id uuid;
BEGIN
  -- Get role's server_id
  SELECT server_id INTO role_server_id
  FROM server_roles
  WHERE id = _role_id;
  
  IF role_server_id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;
  
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = role_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can update roles';
  END IF;
  
  -- Update role
  UPDATE server_roles
  SET 
    name = COALESCE(_name, name),
    color = COALESCE(_color, color)
  WHERE id = _role_id;
  
  RETURN (
    SELECT json_build_object(
      'id', sr.id,
      'server_id', sr.server_id,
      'name', sr.name,
      'color', sr.color,
      'position', sr.position,
      'created_at', sr.created_at
    )
    FROM server_roles sr
    WHERE sr.id = _role_id
  );
END;
$$;

-- Function to delete a server role
CREATE OR REPLACE FUNCTION public.delete_server_role(
  _role_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role server_role;
  role_server_id uuid;
BEGIN
  -- Get role's server_id
  SELECT server_id INTO role_server_id
  FROM server_roles
  WHERE id = _role_id;
  
  IF role_server_id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;
  
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = role_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can delete roles';
  END IF;
  
  -- Delete role (cascade will remove member_role associations)
  DELETE FROM server_roles WHERE id = _role_id;
  
  RETURN true;
END;
$$;

-- Function to assign role to member
CREATE OR REPLACE FUNCTION public.assign_role_to_member(
  _member_id uuid,
  _role_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role server_role;
  member_server_id uuid;
  role_server_id uuid;
BEGIN
  -- Get member's server_id
  SELECT server_id INTO member_server_id
  FROM server_members
  WHERE id = _member_id;
  
  -- Get role's server_id
  SELECT server_id INTO role_server_id
  FROM server_roles
  WHERE id = _role_id;
  
  IF member_server_id IS NULL OR role_server_id IS NULL THEN
    RAISE EXCEPTION 'Member or role not found';
  END IF;
  
  IF member_server_id != role_server_id THEN
    RAISE EXCEPTION 'Member and role must be from the same server';
  END IF;
  
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = member_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can assign roles';
  END IF;
  
  -- Assign role (ignore if already assigned due to UNIQUE constraint)
  INSERT INTO server_member_roles (member_id, role_id)
  VALUES (_member_id, _role_id)
  ON CONFLICT (member_id, role_id) DO NOTHING;
  
  RETURN true;
END;
$$;

-- Function to remove role from member
CREATE OR REPLACE FUNCTION public.remove_role_from_member(
  _member_id uuid,
  _role_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role server_role;
  member_server_id uuid;
  role_server_id uuid;
BEGIN
  -- Get member's server_id
  SELECT server_id INTO member_server_id
  FROM server_members
  WHERE id = _member_id;
  
  -- Get role's server_id
  SELECT server_id INTO role_server_id
  FROM server_roles
  WHERE id = _role_id;
  
  IF member_server_id IS NULL OR role_server_id IS NULL THEN
    RAISE EXCEPTION 'Member or role not found';
  END IF;
  
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = member_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can remove roles';
  END IF;
  
  -- Remove role
  DELETE FROM server_member_roles
  WHERE member_id = _member_id AND role_id = _role_id;
  
  RETURN true;
END;
$$;

-- Update get_server_members to include roles
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
        ),
        'roles', COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', sr.id,
                'name', sr.name,
                'color', sr.color,
                'position', sr.position
              )
            )
            FROM server_member_roles smr
            JOIN server_roles sr ON sr.id = smr.role_id
            WHERE smr.member_id = sm.id
            ORDER BY sr.position ASC
          ),
          '[]'::json
        )
      )
    )
    FROM server_members sm
    JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id
  );
END;
$$;
