-- Align check_user_server_permission with check_user_permission logic
-- Both functions should use the same evaluation order: role_permissions table first, then base defaults

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
  role_result boolean;
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
  SELECT COALESCE(ARRAY_AGG(DISTINCT smr.role_id) FILTER (WHERE smr.role_id IS NOT NULL), ARRAY[]::uuid[]) 
  INTO user_custom_role_ids
  FROM server_member_roles smr
  JOIN server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = _server_id;

  -- ========================================================
  -- STEP 1: SERVER-WIDE ROLE PERMISSIONS (from role_permissions table)
  -- ========================================================
  -- Check role_permissions table first (same logic as channel function)
  
  SELECT rp.allowed INTO role_result
  FROM role_permissions rp
  WHERE rp.server_id = _server_id
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
  -- STEP 2: DEFAULT BASE PERMISSIONS (Fallback)
  -- ========================================================
  -- If no explicit role permission exists in the DB, fallback to code-defined defaults
  
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
    WHEN 'manage_emojis' THEN RETURN user_base_role IN ('owner', 'admin');
    ELSE RETURN false;
  END CASE;

END;
$$;
