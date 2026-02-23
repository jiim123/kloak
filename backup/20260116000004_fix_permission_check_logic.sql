-- Fix permission check function to properly handle denied permissions
CREATE OR REPLACE FUNCTION public.check_user_permission(
  _user_id uuid,
  _channel_id uuid,
  _permission permission_type
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  channel_server_id uuid;
  user_base_role server_role;
  user_custom_role_ids uuid[];
  has_base_permission boolean := false;
  has_custom_permission boolean := NULL; -- NULL means no custom role permission set
  channel_override boolean := NULL;
BEGIN
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user's base role and custom roles
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Owner always has all permissions
  IF user_base_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Get user's custom role IDs
  SELECT ARRAY_AGG(smr.role_id) INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Check base role permissions (from enum defaults)
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
  
  -- Check custom role permissions from database
  -- First check if any custom role explicitly denies this permission
  IF user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0 THEN
    -- Check for explicit deny (takes precedence over allow)
    IF EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.permission = _permission
        AND rp.allowed = false
    ) THEN
      has_custom_permission := false;
    -- Check for explicit allow
    ELSIF EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.permission = _permission
        AND rp.allowed = true
    ) THEN
      has_custom_permission := true;
    END IF;
  END IF;
  
  -- Check channel-specific overrides (these take precedence over everything)
  SELECT cp.allowed INTO channel_override
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND (
      (cp.role_name = user_base_role) OR
      (cp.role_id = ANY(user_custom_role_ids))
    )
  ORDER BY 
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END
  LIMIT 1;
  
  -- Channel override takes precedence over everything
  IF channel_override IS NOT NULL THEN
    RETURN channel_override;
  END IF;
  
  -- If custom role has explicit permission setting, use it
  IF has_custom_permission IS NOT NULL THEN
    RETURN has_custom_permission;
  END IF;
  
  -- Fall back to base role permission
  RETURN has_base_permission;
END;
$$;
