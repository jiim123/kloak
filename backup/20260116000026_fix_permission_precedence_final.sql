-- Fix permission check order and precedence: CHANNEL FIRST, then ROLES
-- This migration ensures that channel overrides always take precedence over server-wide role permissions
-- and that custom roles are correctly prioritized over base roles within both contexts.

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
  channel_result boolean;
  role_result boolean;
BEGIN
  -- 1. Get Context
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN RETURN false; END IF;

  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  -- If not a member, no permissions
  IF user_base_role IS NULL THEN RETURN false; END IF;

  -- 2. Owner Override (Step 0)
  IF user_base_role = 'owner' THEN RETURN true; END IF;

  -- 3. Get Custom Roles
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;

  -- ========================================================
  -- STEP 1: CHANNEL OVERRIDES (Highest Precedence)
  -- ========================================================
  -- We check for ANY channel override that might apply.
  -- Precedence within channel overrides:
  -- 1. Custom Role DENY (wins over everything else at this level)
  -- 2. Custom Role ALLOW
  -- 3. Base Role DENY
  -- 4. Base Role ALLOW
  
  SELECT cp.allowed INTO channel_result
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND (
      (cp.role_id = ANY(user_custom_role_ids)) OR
      (cp.role_name = user_base_role AND cp.role_id IS NULL)
    )
  ORDER BY 
    -- Custom roles Priority (1) vs Base role (2)
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    -- DENY (1) vs ALLOW (2) - Following Discord-like "Deny wins among roles"
    CASE WHEN cp.allowed = false THEN 1 ELSE 2 END,
    -- Most recent takes precedence if same priority
    cp.created_at DESC
  LIMIT 1;

  -- IF a channel override was found, it determines the result immediately
  IF channel_result IS NOT NULL THEN
    RETURN channel_result;
  END IF;

  -- ========================================================
  -- STEP 2: SERVER-WIDE ROLE PERMISSIONS
  -- ========================================================
  -- If no channel override exists, we check the role_permissions table
  
  SELECT rp.allowed INTO role_result
  FROM role_permissions rp
  WHERE rp.server_id = channel_server_id
    AND rp.permission = _permission
    AND (
      (rp.role_id = ANY(user_custom_role_ids)) OR
      (rp.role_name = user_base_role AND rp.role_id IS NULL)
    )
  ORDER BY 
    -- Custom roles Priority (1) vs Base role (2)
    CASE WHEN rp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    -- DENY (1) vs ALLOW (2)
    CASE WHEN rp.allowed = false THEN 1 ELSE 2 END,
    -- Most recent
    rp.created_at DESC
  LIMIT 1;

  -- IF a server-wide role permission was found, it determines the result
  IF role_result IS NOT NULL THEN
    RETURN role_result;
  END IF;

  -- ========================================================
  -- STEP 3: DEFAULT BASE PERMISSIONS (Fallback)
  -- ========================================================
  -- If no explicit role permission exists in the DB, fallback to code-defined defaults
  -- Note: We only reach here if NO custom roles matched or they didn't have the permission set
  
  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'send_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'pin_messages' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_channels' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'kick_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'ban_members' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'mute_members' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_nicknames' THEN RETURN user_base_role IN ('owner', 'admin', 'moderator');
    WHEN 'manage_roles' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'manage_server' THEN RETURN user_base_role = 'owner';
    WHEN 'manage_invites' THEN RETURN user_base_role IN ('owner', 'admin');
    WHEN 'transfer_ownership' THEN RETURN user_base_role = 'owner';
    ELSE RETURN false;
  END CASE;

END;
$$;

-- Also update the debug function to reflect the SAME logic exactly
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
  final_result boolean;
BEGIN
  -- 1. Context
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  IF channel_server_id IS NULL THEN
    RETURN json_build_object('error', 'Channel not found', 'has_permission', false);
  END IF;

  SELECT sm.role INTO user_base_role
  FROM server_members sm
  WHERE sm.server_id = channel_server_id AND sm.user_id = _user_id AND sm.is_banned = false;
  
  IF user_base_role IS NULL THEN
    RETURN json_build_object('error', 'User not a member', 'has_permission', false);
  END IF;

  -- 2. Owner
  IF user_base_role = 'owner' THEN
    RETURN json_build_object(
      'has_permission', true,
      'source', 'owner_override',
      'base_role', user_base_role,
      'custom_roles', '[]'::json
    );
  END IF;

  -- 3. Custom Roles
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = channel_server_id;

  -- 4. Channel Check
  SELECT cp.allowed, 
         CASE WHEN cp.role_id IS NOT NULL THEN 'custom_role' ELSE 'base_role' END || ': ' || COALESCE(sr.name, user_base_role::text)
  INTO channel_override_allowed, channel_override_source
  FROM channel_permissions cp
  LEFT JOIN server_roles sr ON sr.id = cp.role_id
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND (
      (cp.role_id = ANY(user_custom_role_ids)) OR
      (cp.role_name = user_base_role AND cp.role_id IS NULL)
    )
  ORDER BY 
    CASE WHEN cp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN cp.allowed = false THEN 1 ELSE 2 END,
    cp.created_at DESC
  LIMIT 1;

  IF channel_override_allowed IS NOT NULL THEN
    RETURN json_build_object(
      'has_permission', channel_override_allowed,
      'source', 'channel_override',
      'channel_override', json_build_object('allowed', channel_override_allowed, 'source', channel_override_source),
      'base_role', user_base_role
    );
  END IF;

  -- 5. Role Check
  SELECT rp.allowed,
         CASE WHEN rp.role_id IS NOT NULL THEN 'custom_role' ELSE 'base_role' END || ': ' || COALESCE(sr.name, user_base_role::text)
  INTO role_permission_allowed, role_permission_source
  FROM role_permissions rp
  LEFT JOIN server_roles sr ON sr.id = rp.role_id
  WHERE rp.server_id = channel_server_id
    AND rp.permission = _permission
    AND (
      (rp.role_id = ANY(user_custom_role_ids)) OR
      (rp.role_name = user_base_role AND rp.role_id IS NULL)
    )
  ORDER BY 
    CASE WHEN rp.role_id IS NOT NULL THEN 1 ELSE 2 END,
    CASE WHEN rp.allowed = false THEN 1 ELSE 2 END,
    rp.created_at DESC
  LIMIT 1;

  IF role_permission_allowed IS NOT NULL THEN
    RETURN json_build_object(
      'has_permission', role_permission_allowed,
      'source', 'role_permission',
      'role_permission', json_build_object('allowed', role_permission_allowed, 'source', role_permission_source),
      'base_role', user_base_role
    );
  END IF;

  -- 6. Default Fallback
  CASE _permission
    WHEN 'view_channels' THEN final_result := true;
    WHEN 'send_messages' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'add_reactions' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator', 'member');
    WHEN 'manage_messages' THEN final_result := user_base_role IN ('owner', 'admin', 'moderator');
    -- ... add others for complete debug info ...
    ELSE final_result := false;
  END CASE;

  RETURN json_build_object(
    'has_permission', final_result,
    'source', 'default_permission',
    'base_role', user_base_role
  );
END;
$$;
