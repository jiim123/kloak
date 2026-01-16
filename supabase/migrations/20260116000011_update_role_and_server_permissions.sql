-- Update role and server RPC functions to use permission checks

-- Update create_server_role to use permission check
CREATE OR REPLACE FUNCTION public.create_server_role(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _color text DEFAULT '#5865F2'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role_id uuid;
  result json;
BEGIN
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Get max position and add 1
  INSERT INTO server_roles (server_id, name, color, position)
  VALUES (
    _server_id,
    _name,
    _color,
    COALESCE((SELECT MAX(position) FROM server_roles WHERE server_id = _server_id), 0) + 1
  )
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

-- Update update_server_role to use permission check
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
  role_server_id uuid;
BEGIN
  -- Get role's server_id
  SELECT server_id INTO role_server_id
  FROM server_roles
  WHERE id = _role_id;
  
  IF role_server_id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, role_server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied';
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

-- Update delete_server_role to use permission check
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
  role_server_id uuid;
BEGIN
  -- Get role's server_id
  SELECT server_id INTO role_server_id
  FROM server_roles
  WHERE id = _role_id;
  
  IF role_server_id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, role_server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Delete role permissions first
  DELETE FROM role_permissions WHERE role_id = _role_id;
  
  -- Delete member role assignments
  DELETE FROM server_member_roles WHERE role_id = _role_id;
  
  -- Delete the role
  DELETE FROM server_roles WHERE id = _role_id;
  
  RETURN true;
END;
$$;

-- Update update_server to use permission check
CREATE OR REPLACE FUNCTION public.update_server(
  _server_id UUID,
  _user_id UUID,
  _updates JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _updated_server servers%ROWTYPE;
BEGIN
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RETURN json_build_object('success', false, 'error', 'Permission denied');
  END IF;

  -- Update server with provided fields
  UPDATE servers
  SET
    name = COALESCE(_updates->>'name', name),
    icon_url = CASE 
      WHEN _updates ? 'icon_url' THEN _updates->>'icon_url'
      ELSE icon_url
    END,
    banner_url = CASE
      WHEN _updates ? 'banner_url' THEN _updates->>'banner_url'
      ELSE banner_url
    END
  WHERE id = _server_id
  RETURNING * INTO _updated_server;

  IF _updated_server.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'server', json_build_object(
      'id', _updated_server.id,
      'name', _updated_server.name,
      'icon_url', _updated_server.icon_url,
      'banner_url', _updated_server.banner_url,
      'owner_id', _updated_server.owner_id,
      'invite_code', _updated_server.invite_code,
      'created_at', _updated_server.created_at
    )
  );
END;
$$;

-- Update delete_server to use permission check
CREATE OR REPLACE FUNCTION public.delete_server(
  _server_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permission using database-backed permission system
  -- Only users with manage_server permission (which only owner has by default) can delete
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_server') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Delete in order: messages -> channels -> categories -> members -> server
  DELETE FROM messages WHERE channel_id IN (SELECT id FROM channels WHERE server_id = _server_id);
  DELETE FROM channels WHERE server_id = _server_id;
  DELETE FROM channel_categories WHERE server_id = _server_id;
  DELETE FROM server_members WHERE server_id = _server_id;
  DELETE FROM servers WHERE id = _server_id;
  
  RETURN true;
END;
$$;
