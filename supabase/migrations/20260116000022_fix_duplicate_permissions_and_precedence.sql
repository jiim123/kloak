-- Fix duplicate channel permissions and update check_user_permission to handle precedence correctly
-- Issue: Multiple channel permissions for the same role/permission combination
-- Solution: Clean up duplicates and prioritize ALLOW over DENY when multiple exist

-- Step 1: Clean up duplicate channel permissions
-- Keep the most recent ALLOW if any exist, otherwise keep the most recent DENY
WITH duplicates AS (
  SELECT 
    channel_id,
    role_id,
    role_name,
    permission,
    COUNT(*) as count
  FROM channel_permissions
  GROUP BY channel_id, role_id, role_name, permission
  HAVING COUNT(*) > 1
),
to_delete AS (
  SELECT cp.id
  FROM channel_permissions cp
  INNER JOIN duplicates d ON 
    cp.channel_id = d.channel_id 
    AND (cp.role_id = d.role_id OR (cp.role_id IS NULL AND d.role_id IS NULL))
    AND (cp.role_name = d.role_name OR (cp.role_name IS NULL AND d.role_name IS NULL))
    AND cp.permission = d.permission
  WHERE cp.id NOT IN (
    -- Keep the most recent ALLOW, or if no ALLOW exists, keep the most recent DENY
    SELECT DISTINCT ON (cp2.channel_id, cp2.role_id, cp2.role_name, cp2.permission)
      cp2.id
    FROM channel_permissions cp2
    INNER JOIN duplicates d2 ON 
      cp2.channel_id = d2.channel_id 
      AND (cp2.role_id = d2.role_id OR (cp2.role_id IS NULL AND d2.role_id IS NULL))
      AND (cp2.role_name = d2.role_name OR (cp2.role_name IS NULL AND d2.role_name IS NULL))
      AND cp2.permission = d2.permission
    ORDER BY 
      cp2.channel_id, 
      cp2.role_id, 
      cp2.role_name, 
      cp2.permission,
      cp2.allowed DESC, -- ALLOW (true) comes before DENY (false)
      cp2.created_at DESC -- Most recent first
  )
)
DELETE FROM channel_permissions
WHERE id IN (SELECT id FROM to_delete);

-- Step 2: Clean up duplicate role permissions
WITH duplicates AS (
  SELECT 
    server_id,
    role_id,
    role_name,
    permission,
    COUNT(*) as count
  FROM role_permissions
  GROUP BY server_id, role_id, role_name, permission
  HAVING COUNT(*) > 1
),
to_delete AS (
  SELECT rp.id
  FROM role_permissions rp
  INNER JOIN duplicates d ON 
    rp.server_id = d.server_id 
    AND (rp.role_id = d.role_id OR (rp.role_id IS NULL AND d.role_id IS NULL))
    AND (rp.role_name = d.role_name OR (rp.role_name IS NULL AND d.role_name IS NULL))
    AND rp.permission = d.permission
  WHERE rp.id NOT IN (
    -- Keep the most recent ALLOW, or if no ALLOW exists, keep the most recent DENY
    SELECT DISTINCT ON (rp2.server_id, rp2.role_id, rp2.role_name, rp2.permission)
      rp2.id
    FROM role_permissions rp2
    INNER JOIN duplicates d2 ON 
      rp2.server_id = d2.server_id 
      AND (rp2.role_id = d2.role_id OR (rp2.role_id IS NULL AND d2.role_id IS NULL))
      AND (rp2.role_name = d2.role_name OR (rp2.role_name IS NULL AND d2.role_name IS NULL))
      AND rp2.permission = d2.permission
    ORDER BY 
      rp2.server_id, 
      rp2.role_id, 
      rp2.role_name, 
      rp2.permission,
      rp2.allowed DESC, -- ALLOW (true) comes before DENY (false)
      rp2.created_at DESC -- Most recent first
  )
)
DELETE FROM role_permissions
WHERE id IN (SELECT id FROM to_delete);

-- Step 3: Update check_user_permission to prioritize ALLOW over DENY
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
  ORDER BY cp.allowed DESC, cp.created_at DESC -- Prioritize ALLOW over DENY, then most recent
  LIMIT 1;
  
  -- If not found for base role, check custom role channel overrides
  IF channel_override_allowed IS NULL AND user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT cp.allowed INTO channel_override_allowed
    FROM channel_permissions cp
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.role_id = ANY(user_custom_role_ids)
      AND cp.role_name IS NULL
    ORDER BY cp.allowed DESC, cp.created_at DESC -- Prioritize ALLOW over DENY, then most recent
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

-- Step 4: Create a debug function to show permission resolution details
CREATE OR REPLACE FUNCTION public.debug_user_permission(
  _user_id uuid,
  _channel_id uuid,
  _permission permission_type
)
RETURNS json
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
  channel_override_source text;
  role_permission_allowed boolean;
  role_permission_source text;
  default_permission boolean;
  final_result boolean;
  debug_info json;
BEGIN
  -- Step 1: Get channel's server
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RETURN json_build_object(
      'error', 'Channel not found',
      'has_permission', false
    );
  END IF;
  
  -- Step 2: Get user's base role
  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN json_build_object(
      'error', 'User not a member of this server',
      'has_permission', false
    );
  END IF;
  
  -- Step 3: Owner always has all permissions
  IF user_base_role = 'owner' THEN
    RETURN json_build_object(
      'has_permission', true,
      'source', 'owner_override',
      'base_role', user_base_role,
      'custom_roles', '[]'::json,
      'channel_override', null,
      'role_permission', null,
      'default_permission', null
    );
  END IF;
  
  -- Step 4: Get user's custom role IDs
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;
  
  -- Step 5: Check channel permissions
  -- Check for base role channel override
  SELECT cp.allowed, 'base_role: ' || user_base_role::text 
  INTO channel_override_allowed, channel_override_source
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.role_name = user_base_role
    AND cp.role_id IS NULL
  ORDER BY cp.allowed DESC, cp.created_at DESC
  LIMIT 1;
  
  -- If not found for base role, check custom role channel overrides
  IF channel_override_allowed IS NULL AND user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0 THEN
    SELECT cp.allowed, 'custom_role: ' || sr.name 
    INTO channel_override_allowed, channel_override_source
    FROM channel_permissions cp
    JOIN server_roles sr ON sr.id = cp.role_id
    WHERE cp.channel_id = _channel_id
      AND cp.permission = _permission
      AND cp.role_id = ANY(user_custom_role_ids)
      AND cp.role_name IS NULL
    ORDER BY cp.allowed DESC, cp.created_at DESC
    LIMIT 1;
  END IF;
  
  -- Step 6: Check role permissions (only if no channel override)
  IF channel_override_allowed IS NULL THEN
    IF user_custom_role_ids IS NOT NULL AND array_length(user_custom_role_ids, 1) > 0 THEN
      -- view_channels is always allowed
      IF _permission = 'view_channels' THEN
        role_permission_allowed := true;
        role_permission_source := 'default_view_channels';
      ELSE
        -- Check for explicit deny
        IF EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = ANY(user_custom_role_ids)
            AND rp.server_id = channel_server_id
            AND rp.permission = _permission
            AND rp.allowed = false
        ) THEN
          role_permission_allowed := false;
          SELECT 'custom_role_deny: ' || sr.name INTO role_permission_source
          FROM role_permissions rp
          JOIN server_roles sr ON sr.id = rp.role_id
          WHERE rp.role_id = ANY(user_custom_role_ids)
            AND rp.server_id = channel_server_id
            AND rp.permission = _permission
            AND rp.allowed = false
          LIMIT 1;
        -- Check for explicit allow
        ELSIF EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = ANY(user_custom_role_ids)
            AND rp.server_id = channel_server_id
            AND rp.permission = _permission
            AND rp.allowed = true
        ) THEN
          role_permission_allowed := true;
          SELECT 'custom_role_allow: ' || sr.name INTO role_permission_source
          FROM role_permissions rp
          JOIN server_roles sr ON sr.id = rp.role_id
          WHERE rp.role_id = ANY(user_custom_role_ids)
            AND rp.server_id = channel_server_id
            AND rp.permission = _permission
            AND rp.allowed = true
          LIMIT 1;
        ELSE
          role_permission_allowed := false;
          role_permission_source := 'no_custom_role_permission';
        END IF;
      END IF;
    ELSE
      -- Use base role default permissions
      CASE _permission
        WHEN 'view_channels' THEN default_permission := true;
        WHEN 'send_messages' THEN default_permission := user_base_role IN ('owner', 'admin', 'moderator', 'member');
        WHEN 'add_reactions' THEN default_permission := user_base_role IN ('owner', 'admin', 'moderator', 'member');
        WHEN 'manage_messages' THEN default_permission := user_base_role IN ('owner', 'admin', 'moderator');
        WHEN 'pin_messages' THEN default_permission := user_base_role IN ('owner', 'admin', 'moderator');
        WHEN 'manage_channels' THEN default_permission := user_base_role IN ('owner', 'admin');
        WHEN 'kick_members' THEN default_permission := user_base_role IN ('owner', 'admin', 'moderator');
        WHEN 'ban_members' THEN default_permission := user_base_role IN ('owner', 'admin');
        WHEN 'mute_members' THEN default_permission := user_base_role IN ('owner', 'admin', 'moderator');
        WHEN 'manage_nicknames' THEN default_permission := user_base_role IN ('owner', 'admin', 'moderator');
        WHEN 'manage_roles' THEN default_permission := user_base_role IN ('owner', 'admin');
        WHEN 'manage_server' THEN default_permission := user_base_role = 'owner';
        WHEN 'manage_invites' THEN default_permission := user_base_role IN ('owner', 'admin');
        WHEN 'transfer_ownership' THEN default_permission := user_base_role = 'owner';
        ELSE default_permission := false;
      END CASE;
      role_permission_source := 'base_role_default: ' || user_base_role::text;
    END IF;
  END IF;
  
  -- Determine final result
  IF channel_override_allowed IS NOT NULL THEN
    final_result := channel_override_allowed;
  ELSIF role_permission_allowed IS NOT NULL THEN
    final_result := role_permission_allowed;
  ELSE
    final_result := COALESCE(default_permission, false);
  END IF;
  
  -- Build debug info
  RETURN json_build_object(
    'has_permission', final_result,
    'source', COALESCE(
      CASE WHEN channel_override_allowed IS NOT NULL THEN 'channel_override' END,
      CASE WHEN role_permission_allowed IS NOT NULL THEN 'role_permission' END,
      'default_permission'
    ),
    'base_role', user_base_role,
    'custom_roles', (
      SELECT COALESCE(json_agg(json_build_object('id', sr.id, 'name', sr.name)), '[]'::json)
      FROM server_roles sr
      WHERE sr.id = ANY(user_custom_role_ids)
    ),
    'channel_override', CASE 
      WHEN channel_override_allowed IS NOT NULL THEN 
        json_build_object('allowed', channel_override_allowed, 'source', channel_override_source)
      ELSE null
    END,
    'role_permission', CASE 
      WHEN role_permission_allowed IS NOT NULL THEN 
        json_build_object('allowed', role_permission_allowed, 'source', role_permission_source)
      ELSE null
    END,
    'default_permission', CASE 
      WHEN default_permission IS NOT NULL THEN 
        json_build_object('allowed', default_permission, 'source', role_permission_source)
      ELSE null
    END
  );
END;
$$;
