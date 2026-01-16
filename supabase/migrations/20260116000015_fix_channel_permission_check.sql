-- Fix channel permission check to properly handle channel overrides
-- The issue: Channel overrides should always be checked regardless of custom roles
-- Channel overrides take absolute precedence over role permissions
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
  has_custom_permission boolean := NULL;
  channel_override boolean := NULL;
  custom_role_deny boolean := false;
  custom_role_allow boolean := false;
  has_any_custom_roles boolean := false;
BEGIN
  -- Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user's base role
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
  SELECT ARRAY_AGG(DISTINCT smr.role_id) INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Check if user has any custom roles
  has_any_custom_roles := (user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0);
  
  -- IMPORTANT: Check channel-specific overrides FIRST (these take absolute precedence)
  -- Check for both base role and custom roles
  SELECT cp.allowed INTO channel_override
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND (
      (cp.role_name = user_base_role) OR
      (cp.role_id = ANY(COALESCE(user_custom_role_ids, ARRAY[]::uuid[])))
    )
  ORDER BY 
    CASE WHEN cp.allowed = false THEN 1 ELSE 2 END, -- Deny takes precedence over allow
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END -- Custom roles checked first
  LIMIT 1;
  
  -- Channel override takes absolute precedence - return immediately if found
  IF channel_override IS NOT NULL THEN
    RETURN channel_override;
  END IF;
  
  -- If user has custom roles, they ONLY get permissions from custom roles
  -- Base role permissions are NOT used
  IF has_any_custom_roles THEN
    -- view_channels is always allowed (minimal permission to see channels)
    IF _permission = 'view_channels' THEN
      RETURN true;
    END IF;
    
    -- Check custom role permissions from database
    -- Check for explicit deny (takes precedence)
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.server_id = channel_server_id
        AND rp.permission = _permission
        AND rp.allowed = false
    ) INTO custom_role_deny;
    
    -- Check for explicit allow
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.server_id = channel_server_id
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
    
    -- Fall back to base role permission
    RETURN has_base_permission;
  END IF;
END;
$$;
