-- Create a server-level permission check function (no channel required)
CREATE OR REPLACE FUNCTION public.check_user_server_permission(
  _user_id uuid,
  _server_id uuid,
  _permission permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_base_role server_role;
  user_custom_role_ids uuid[];
  has_base_permission boolean := false;
  has_custom_permission boolean := NULL;
  custom_role_deny boolean := false;
  custom_role_allow boolean := false;
  has_any_custom_roles boolean := false;
BEGIN
  -- Get user's base role
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = _server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Owner always has all permissions
  IF user_base_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Get user's custom role IDs
  SELECT ARRAY_AGG(DISTINCT smr.role_id) INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = _server_id;
  
  -- Check if user has any custom roles
  has_any_custom_roles := (user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0);
  
  -- If user has custom roles, they ONLY get permissions from custom roles
  IF has_any_custom_roles THEN
    -- view_channels is always allowed (minimal permission)
    IF _permission = 'view_channels' THEN
      RETURN true;
    END IF;
    
    -- Check custom role permissions from database
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.server_id = _server_id
        AND rp.permission = _permission
        AND rp.allowed = false
    ) INTO custom_role_deny;
    
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.server_id = _server_id
        AND rp.permission = _permission
        AND rp.allowed = true
    ) INTO custom_role_allow;
    
    -- Deny takes precedence over allow
    IF custom_role_deny THEN
      has_custom_permission := false;
    ELSIF custom_role_allow THEN
      has_custom_permission := true;
    END IF;
    
    -- If custom role has explicit permission setting, use it
    IF has_custom_permission IS NOT NULL THEN
      RETURN has_custom_permission;
    END IF;
    
    -- No custom role permission set - user with custom roles has NO permissions by default
    RETURN false;
  ELSE
    -- No custom roles - use base role permissions
    IF _permission = 'view_channels' THEN
      has_base_permission := true;
    ELSIF _permission = 'send_messages' THEN
      has_base_permission := user_base_role IN ('owner', 'admin', 'moderator', 'member');
    ELSIF _permission = 'add_reactions' THEN
      has_base_permission := user_base_role IN ('owner', 'admin', 'moderator', 'member');
    ELSIF _permission = 'manage_messages' THEN
      has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
    ELSIF _permission = 'pin_messages' THEN
      has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
    ELSIF _permission = 'manage_channels' THEN
      has_base_permission := user_base_role IN ('owner', 'admin');
    ELSIF _permission = 'kick_members' THEN
      has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
    ELSIF _permission = 'ban_members' THEN
      has_base_permission := user_base_role IN ('owner', 'admin');
    ELSIF _permission = 'mute_members' THEN
      has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
    ELSIF _permission = 'manage_nicknames' THEN
      has_base_permission := user_base_role IN ('owner', 'admin', 'moderator');
    ELSIF _permission = 'manage_roles' THEN
      has_base_permission := user_base_role IN ('owner', 'admin');
    ELSIF _permission = 'manage_server' THEN
      has_base_permission := user_base_role = 'owner';
    ELSIF _permission = 'manage_invites' THEN
      has_base_permission := user_base_role IN ('owner', 'admin');
    ELSIF _permission = 'transfer_ownership' THEN
      has_base_permission := user_base_role = 'owner';
    END IF;
    
    RETURN has_base_permission;
  END IF;
END;
$$;

-- Update kick_member to use permission check
CREATE OR REPLACE FUNCTION public.kick_member(
  _server_id uuid,
  _user_id uuid,
  _target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  -- Get the requesting user's role
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  -- Get the target user's role
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'kick_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot kick owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot kick the server owner';
  END IF;
  
  -- Check role hierarchy (owner > admin > moderator > member)
  -- Users can only kick users with lower base roles
  IF user_role = 'moderator' AND target_role IN ('admin', 'moderator', 'owner') THEN
    RAISE EXCEPTION 'Cannot kick users with equal or higher role';
  END IF;
  
  IF user_role = 'admin' AND target_role IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Cannot kick users with equal or higher role';
  END IF;
  
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;

-- Update ban_member to use permission check
CREATE OR REPLACE FUNCTION public.ban_member(
  _server_id uuid,
  _user_id uuid,
  _target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot ban owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot ban the server owner';
  END IF;
  
  -- Check role hierarchy
  IF user_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot ban users with equal role';
  END IF;
  
  -- If target is already a member, update to banned
  IF target_role IS NOT NULL THEN
    UPDATE server_members SET is_banned = true WHERE server_id = _server_id AND user_id = _target_user_id;
  ELSE
    -- Add as banned member
    INSERT INTO server_members (server_id, user_id, role, is_banned)
    VALUES (_server_id, _target_user_id, 'member', true);
  END IF;
  
  RETURN true;
END;
$$;

-- Update unban_member to use permission check
CREATE OR REPLACE FUNCTION public.unban_member(
  _server_id uuid,
  _user_id uuid,
  _target_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = true;
  RETURN true;
END;
$$;

-- Update toggle_mute_member to use permission check
CREATE OR REPLACE FUNCTION public.toggle_mute_member(
  _server_id uuid,
  _user_id uuid,
  _target_user_id uuid,
  _muted boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'mute_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot mute owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot mute the server owner';
  END IF;
  
  -- Check role hierarchy
  IF user_role = 'moderator' AND target_role IN ('admin', 'moderator', 'owner') THEN
    RAISE EXCEPTION 'Cannot mute users with equal or higher role';
  END IF;
  
  IF user_role = 'admin' AND target_role IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Cannot mute users with equal or higher role';
  END IF;
  
  UPDATE server_members SET is_muted = _muted WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;

-- Update update_member_nickname to use permission check
CREATE OR REPLACE FUNCTION public.update_member_nickname(
  _server_id uuid,
  _user_id uuid,
  _target_user_id uuid,
  _nickname text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  target_role text;
BEGIN
  -- Users can always change their own nickname
  IF _user_id = _target_user_id THEN
    UPDATE server_members SET nickname = _nickname WHERE server_id = _server_id AND user_id = _user_id;
    RETURN true;
  END IF;
  
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF target_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_nicknames') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot change owner's nickname unless you are the owner
  IF target_role = 'owner' AND user_role != 'owner' THEN
    RAISE EXCEPTION 'Cannot change the server owner nickname';
  END IF;
  
  UPDATE server_members SET nickname = _nickname WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;

-- Update get_banned_members to use permission check
CREATE OR REPLACE FUNCTION public.get_banned_members(_server_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  RETURN (
    SELECT json_agg(
      json_build_object(
        'id', sm.id,
        'user_id', sm.user_id,
        'joined_at', sm.joined_at,
        'user', json_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar_url', u.avatar_url
        )
      )
    )
    FROM server_members sm
    JOIN users u ON u.id = sm.user_id
    WHERE sm.server_id = _server_id AND sm.is_banned = true
  );
END;
$$;
