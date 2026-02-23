-- RPC function to kick a member from a server
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
  
  -- Only owner, admin, moderator can kick
  IF user_role NOT IN ('owner', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot kick owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot kick the server owner';
  END IF;
  
  -- Moderators can only kick members
  IF user_role = 'moderator' AND target_role IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Cannot kick users with equal or higher role';
  END IF;
  
  -- Admins cannot kick other admins or owner
  IF user_role = 'admin' AND target_role IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Cannot kick users with equal or higher role';
  END IF;
  
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;

-- RPC function to ban a member from a server
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
  
  -- Only owner and admin can ban
  IF user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot ban owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot ban the server owner';
  END IF;
  
  -- Admins cannot ban other admins
  IF user_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot ban users with equal role';
  END IF;
  
  -- If target is already a member, update to banned
  IF target_role IS NOT NULL THEN
    UPDATE server_members SET is_banned = true WHERE server_id = _server_id AND user_id = _target_user_id;
  ELSE
    -- Add as banned member (for users who were kicked but should be banned)
    INSERT INTO server_members (server_id, user_id, role, is_banned)
    VALUES (_server_id, _target_user_id, 'member', true);
  END IF;
  
  RETURN true;
END;
$$;

-- RPC function to unban a member
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
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  IF user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id AND is_banned = true;
  RETURN true;
END;
$$;

-- RPC function to mute/unmute a member
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
  
  -- Only owner, admin, moderator can mute
  IF user_role NOT IN ('owner', 'admin', 'moderator') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Cannot mute owner
  IF target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot mute the server owner';
  END IF;
  
  -- Moderators can only mute members
  IF user_role = 'moderator' AND target_role IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Cannot mute users with equal or higher role';
  END IF;
  
  -- Admins cannot mute other admins
  IF user_role = 'admin' AND target_role IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Cannot mute users with equal or higher role';
  END IF;
  
  UPDATE server_members SET is_muted = _muted WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;

-- RPC function to change a member's role
CREATE OR REPLACE FUNCTION public.change_member_role(
  _server_id uuid,
  _user_id uuid,
  _target_user_id uuid,
  _new_role server_role
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
  
  -- Cannot change to or from owner role (use transfer ownership instead)
  IF _new_role = 'owner' OR target_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot change owner role. Use transfer ownership instead.';
  END IF;
  
  -- Only owner can promote to admin
  IF _new_role = 'admin' AND user_role != 'owner' THEN
    RAISE EXCEPTION 'Only the server owner can promote to admin';
  END IF;
  
  -- Owner and admin can change roles (within their permission)
  IF user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Admins cannot change other admins' roles
  IF user_role = 'admin' AND target_role = 'admin' THEN
    RAISE EXCEPTION 'Cannot change role of users with equal role';
  END IF;
  
  UPDATE server_members SET role = _new_role WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;

-- RPC function to transfer server ownership
CREATE OR REPLACE FUNCTION public.transfer_ownership(
  _server_id uuid,
  _user_id uuid,
  _new_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
  new_owner_role text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO new_owner_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _new_owner_id AND is_banned = false;
  
  IF user_role != 'owner' THEN
    RAISE EXCEPTION 'Only the server owner can transfer ownership';
  END IF;
  
  IF new_owner_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Update the new owner's role
  UPDATE server_members SET role = 'owner' WHERE server_id = _server_id AND user_id = _new_owner_id;
  
  -- Demote the old owner to admin
  UPDATE server_members SET role = 'admin' WHERE server_id = _server_id AND user_id = _user_id;
  
  -- Update the server's owner_id
  UPDATE servers SET owner_id = _new_owner_id WHERE id = _server_id;
  
  RETURN true;
END;
$$;

-- RPC function to update member nickname
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
  
  -- Only owner, admin, moderator can change others' nicknames
  IF user_role NOT IN ('owner', 'admin', 'moderator') THEN
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

-- RPC function to leave a server
CREATE OR REPLACE FUNCTION public.leave_server(
  _server_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  IF user_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;
  
  IF user_role = 'owner' THEN
    RAISE EXCEPTION 'Server owner cannot leave. Transfer ownership first or delete the server.';
  END IF;
  
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _user_id;
  RETURN true;
END;
$$;

-- RPC function to delete a server
CREATE OR REPLACE FUNCTION public.delete_server(
  _server_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  IF user_role != 'owner' THEN
    RAISE EXCEPTION 'Only the server owner can delete the server';
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

-- RPC function to get banned members
CREATE OR REPLACE FUNCTION public.get_banned_members(_server_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  IF user_role NOT IN ('owner', 'admin') THEN
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