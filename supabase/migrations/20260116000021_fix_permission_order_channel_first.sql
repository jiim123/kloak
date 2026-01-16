-- Fix permission check order: CHANNEL PERMISSIONS FIRST, then ROLE PERMISSIONS
-- Channel permissions (overrides) always take precedence over role permissions
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
  channel_override_allowed boolean;
  has_role_permission boolean := false;
BEGIN
  -- Step 1: Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Step 2: Get user's base role
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Step 3: Owner always has all permissions
  IF user_base_role = 'owner' THEN
    RETURN true;
  END IF;
  
  -- Step 4: Get user's custom role IDs
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- ============================================
  -- STEP 5: CHECK CHANNEL PERMISSIONS FIRST
  -- ============================================
  -- Channel permissions (overrides) take ABSOLUTE precedence
  -- Check for base role channel override
  SELECT cp.allowed INTO channel_override_allowed
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.role_name = user_base_role
    AND cp.role_id IS NULL
  LIMIT 1;
  
  -- If not found for base role, check custom role channel overrides
  IF channel_override_allowed IS NULL AND user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT cp.allowed INTO channel_override_allowed
    FROM channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.role_id = ANY(user_custom_role_ids)
      AND cp.role_name IS NULL
    ORDER BY 
      CASE WHEN cp.allowed = false THEN 1 ELSE 2 END -- Deny takes precedence over allow
    LIMIT 1;
  END IF;
  
  -- If channel override exists, return it immediately (channel permissions take precedence)
  IF channel_override_allowed IS NOT NULL THEN
    RETURN channel_override_allowed;
  END IF;
  
  -- ============================================
  -- STEP 6: NO CHANNEL OVERRIDE - CHECK ROLE PERMISSIONS
  -- ============================================
  -- Only check role permissions if no channel override exists
  
  -- If user has custom roles, check custom role permissions
  IF user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0 THEN
    -- User has custom roles - check custom role permissions from role_permissions table
    -- view_channels is always allowed (minimal permission)
    IF _permission = 'view_channels' THEN
      RETURN true;
    END IF;
    
    -- Check for explicit deny in custom role permissions (takes precedence)
    IF EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.server_id = channel_server_id
        AND rp.permission = _permission
        AND rp.allowed = false
    ) THEN
      RETURN false;
    END IF;
    
    -- Check for explicit allow in custom role permissions
    IF EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = ANY(user_custom_role_ids)
        AND rp.server_id = channel_server_id
        AND rp.permission = _permission
        AND rp.allowed = true
    ) THEN
      RETURN true;
    END IF;
    
    -- No custom role permission set - user with custom roles has NO permissions by default
    RETURN false;
  ELSE
    -- No custom roles - use base role default permissions
    CASE _permission
      WHEN 'view_channels' THEN has_role_permission := true;
      WHEN 'send_messages' THEN has_role_permission := user_base_role IN ('owner', 'admin', 'moderator', 'member');
      WHEN 'add_reactions' THEN has_role_permission := user_base_role IN ('owner', 'admin', 'moderator', 'member');
      WHEN 'manage_messages' THEN has_role_permission := user_base_role IN ('owner', 'admin', 'moderator');
      WHEN 'pin_messages' THEN has_role_permission := user_base_role IN ('owner', 'admin', 'moderator');
      WHEN 'manage_channels' THEN has_role_permission := user_base_role IN ('owner', 'admin');
      WHEN 'kick_members' THEN has_role_permission := user_base_role IN ('owner', 'admin', 'moderator');
      WHEN 'ban_members' THEN has_role_permission := user_base_role IN ('owner', 'admin');
      WHEN 'mute_members' THEN has_role_permission := user_base_role IN ('owner', 'admin', 'moderator');
      WHEN 'manage_nicknames' THEN has_role_permission := user_base_role IN ('owner', 'admin', 'moderator');
      WHEN 'manage_roles' THEN has_role_permission := user_base_role IN ('owner', 'admin');
      WHEN 'manage_server' THEN has_role_permission := user_base_role = 'owner';
      WHEN 'manage_invites' THEN has_role_permission := user_base_role IN ('owner', 'admin');
      WHEN 'transfer_ownership' THEN has_role_permission := user_base_role = 'owner';
      ELSE has_role_permission := false;
    END CASE;
    
    RETURN has_role_permission;
  END IF;
END;
$$;
