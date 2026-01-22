-- Update kick_member to create a notification for the kicked user
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
  server_name text;
BEGIN
  -- Get the requesting user's role
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  -- Get the target user's role
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id;
  
  -- Get server name for notification
  SELECT name INTO server_name FROM servers WHERE id = _server_id;
  
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
  IF user_role = 'moderator' AND target_role IN ('admin', 'moderator', 'owner') THEN
    RAISE EXCEPTION 'Cannot kick users with equal or higher role';
  END IF;
  
  IF user_role = 'admin' AND target_role IN ('admin', 'owner') THEN
    RAISE EXCEPTION 'Cannot kick users with equal or higher role';
  END IF;
  
  -- Create notification for the kicked user
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    _target_user_id,
    'server_invite',
    'You have been kicked',
    'You have been kicked from ' || COALESCE(server_name, 'a server'),
    NULL
  );
  
  DELETE FROM server_members WHERE server_id = _server_id AND user_id = _target_user_id;
  RETURN true;
END;
$$;

-- Update ban_member to create a notification for the banned user
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
  server_name text;
BEGIN
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;
  
  SELECT role INTO target_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _target_user_id;
  
  -- Get server name for notification
  SELECT name INTO server_name FROM servers WHERE id = _server_id;
  
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
  
  -- Create notification for the banned user
  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    _target_user_id,
    'server_invite',
    'You have been banned',
    'You have been banned from ' || COALESCE(server_name, 'a server'),
    NULL
  );
  
  -- If target is already a member, update to banned
  IF target_role IS NOT NULL THEN
    UPDATE server_members SET is_banned = true WHERE server_id = _server_id AND user_id = _target_user_id;
  ELSE
    -- Add as banned member (for pre-emptive bans)
    INSERT INTO server_members (server_id, user_id, is_banned, role)
    VALUES (_server_id, _target_user_id, true, 'member');
  END IF;
  
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kick_member(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ban_member(uuid, uuid, uuid) TO anon, authenticated;