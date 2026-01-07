-- Create a secure function to create a server with all related records
-- This bypasses RLS since the app uses custom secret key auth
CREATE OR REPLACE FUNCTION public.create_server_with_owner(
  _name text,
  _owner_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_server_id uuid;
  new_invite_code char(8);
  result json;
BEGIN
  -- Generate invite code
  new_invite_code := generate_invite_code();
  
  -- Create the server
  INSERT INTO servers (name, owner_id, invite_code)
  VALUES (_name, _owner_id, new_invite_code)
  RETURNING id INTO new_server_id;
  
  -- Add owner as member with owner role
  INSERT INTO server_members (server_id, user_id, role)
  VALUES (new_server_id, _owner_id, 'owner');
  
  -- Create default #general channel
  INSERT INTO channels (server_id, name, type, position)
  VALUES (new_server_id, 'general', 'text', 0);
  
  -- Return the created server data
  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', s.invite_code,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'created_at', s.created_at
  ) INTO result
  FROM servers s WHERE s.id = new_server_id;
  
  RETURN result;
END;
$$;

-- Create a function to join a server (bypasses RLS)
CREATE OR REPLACE FUNCTION public.join_server_by_invite(
  _invite_code text,
  _user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_server_id uuid;
  existing_member record;
  result json;
BEGIN
  -- Find server by invite code
  SELECT id INTO target_server_id
  FROM servers
  WHERE invite_code = upper(_invite_code);
  
  IF target_server_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;
  
  -- Check if already a member
  SELECT * INTO existing_member
  FROM server_members
  WHERE server_id = target_server_id AND user_id = _user_id;
  
  IF existing_member IS NOT NULL THEN
    IF existing_member.is_banned THEN
      RAISE EXCEPTION 'You are banned from this server';
    END IF;
    RAISE EXCEPTION 'You are already a member of this server';
  END IF;
  
  -- Join server
  INSERT INTO server_members (server_id, user_id, role)
  VALUES (target_server_id, _user_id, 'member');
  
  -- Return the server data
  SELECT json_build_object(
    'id', s.id,
    'name', s.name,
    'owner_id', s.owner_id,
    'invite_code', s.invite_code,
    'icon_url', s.icon_url,
    'banner_url', s.banner_url,
    'created_at', s.created_at
  ) INTO result
  FROM servers s WHERE s.id = target_server_id;
  
  RETURN result;
END;
$$;

-- Create a function to fetch user's servers (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_servers(_user_id uuid)
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
        'id', s.id,
        'name', s.name,
        'owner_id', s.owner_id,
        'invite_code', s.invite_code,
        'icon_url', s.icon_url,
        'banner_url', s.banner_url,
        'created_at', s.created_at,
        'role', sm.role,
        'nickname', sm.nickname,
        'joined_at', sm.joined_at
      )
    )
    FROM server_members sm
    JOIN servers s ON s.id = sm.server_id
    WHERE sm.user_id = _user_id AND sm.is_banned = false
  );
END;
$$;