-- Add user-specific channel permission overrides
-- This allows setting permissions for individual users in channels (highest priority)

-- Add user_id column to channel_permissions table
ALTER TABLE public.channel_permissions
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

-- Drop existing partial unique indexes
DROP INDEX IF EXISTS public.cp_custom_role_unique;
DROP INDEX IF EXISTS public.cp_base_role_unique;

-- Drop any existing check constraints
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.channel_permissions'::regclass 
          AND contype = 'c'
          AND (conname LIKE '%role%' OR conname LIKE '%target%' OR conname LIKE '%check%')
    ) LOOP
        EXECUTE 'ALTER TABLE public.channel_permissions DROP CONSTRAINT ' || r.conname;
    END LOOP;
END $$;

-- Add new check constraint: exactly one of role_id, role_name, or user_id must be set
ALTER TABLE public.channel_permissions
ADD CONSTRAINT channel_permissions_target_check CHECK (
  (role_id IS NOT NULL AND role_name IS NULL AND user_id IS NULL) OR 
  (role_id IS NULL AND role_name IS NOT NULL AND user_id IS NULL) OR
  (role_id IS NULL AND role_name IS NULL AND user_id IS NOT NULL)
);

-- Create new partial unique indexes that include user_id
CREATE UNIQUE INDEX cp_custom_role_unique ON public.channel_permissions (channel_id, role_id, permission) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX cp_base_role_unique ON public.channel_permissions (channel_id, role_name, permission) WHERE role_name IS NOT NULL;
CREATE UNIQUE INDEX cp_user_unique ON public.channel_permissions (channel_id, user_id, permission) WHERE user_id IS NOT NULL;

-- Create index for user-specific permission lookups
CREATE INDEX IF NOT EXISTS idx_channel_permissions_user_id ON public.channel_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_permissions_channel_user ON public.channel_permissions(channel_id, user_id);

-- Update check_user_permission to check user-specific overrides first (highest priority)
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
  user_override_result boolean;
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
  -- STEP 0: USER-SPECIFIC OVERRIDES (Highest Priority)
  -- ========================================================
  -- Check for user-specific channel overrides first
  SELECT cp.allowed INTO user_override_result
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id = _user_id
    AND cp.role_id IS NULL
    AND cp.role_name IS NULL
  LIMIT 1;

  -- IF a user-specific override was found, it determines the result immediately
  IF user_override_result IS NOT NULL THEN
    RETURN user_override_result;
  END IF;

  -- ========================================================
  -- STEP 1: CHANNEL ROLE OVERRIDES
  -- ========================================================
  -- Precedence within channel role overrides:
  -- 1. Custom Role DENY (wins over everything else at this level)
  -- 2. Custom Role ALLOW
  -- 3. Base Role DENY
  -- 4. Base Role ALLOW
  
  SELECT cp.allowed INTO channel_result
  FROM channel_permissions cp
  WHERE cp.channel_id = _channel_id
    AND cp.permission = _permission
    AND cp.user_id IS NULL
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

  -- IF a channel role override was found, it determines the result immediately
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

-- Update set_channel_permission to accept optional user_id
CREATE OR REPLACE FUNCTION public.set_channel_permission(
  _channel_id uuid,
  _user_id uuid,
  _permission permission_type,
  _allowed boolean,
  _role_id uuid DEFAULT NULL,
  _role_name server_role DEFAULT NULL,
  _target_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role server_role;
  channel_server_id uuid;
  new_permission_id uuid;
BEGIN
  -- Get channel's server_id
  SELECT server_id INTO channel_server_id
  FROM channels
  WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  -- Check if user is admin or owner
  SELECT role INTO user_role
  FROM server_members
  WHERE server_id = channel_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can manage channel permissions';
  END IF;
  
  -- Validate that exactly one target is provided: role_id, role_name, or target_user_id
  IF (_role_id IS NOT NULL)::int + (_role_name IS NOT NULL)::int + (_target_user_id IS NOT NULL)::int != 1 THEN
    RAISE EXCEPTION 'Exactly one of role_id, role_name, or target_user_id must be provided';
  END IF;
  
  -- If role_id is provided, verify it belongs to the server
  IF _role_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM server_roles WHERE id = _role_id AND server_id = channel_server_id) THEN
      RAISE EXCEPTION 'Role not found in this server';
    END IF;
  END IF;
  
  -- If target_user_id is provided, verify they are a member
  IF _target_user_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM server_members WHERE server_id = channel_server_id AND user_id = _target_user_id) THEN
      RAISE EXCEPTION 'Target user is not a member of this server';
    END IF;
  END IF;
  
  -- Delete existing matching permission first to avoid conflicts with partial indexes
  DELETE FROM channel_permissions
  WHERE channel_id = _channel_id
    AND permission = _permission
    AND (
      (_role_id IS NOT NULL AND role_id = _role_id AND role_name IS NULL AND user_id IS NULL) OR
      (_role_name IS NOT NULL AND role_name = _role_name AND role_id IS NULL AND user_id IS NULL) OR
      (_target_user_id IS NOT NULL AND user_id = _target_user_id AND role_id IS NULL AND role_name IS NULL)
    );
  
  -- Insert the new permission
  INSERT INTO channel_permissions (channel_id, role_id, role_name, user_id, permission, allowed)
  VALUES (_channel_id, _role_id, _role_name, _target_user_id, _permission, _allowed);
  
  -- Return the permission
  SELECT id INTO new_permission_id
  FROM channel_permissions
  WHERE channel_id = _channel_id
    AND (role_id = _role_id OR (role_id IS NULL AND _role_id IS NULL))
    AND (role_name = _role_name OR (role_name IS NULL AND _role_name IS NULL))
    AND (user_id = _target_user_id OR (user_id IS NULL AND _target_user_id IS NULL))
    AND permission = _permission;
  
  RETURN (
    SELECT json_build_object(
      'id', cp.id,
      'channel_id', cp.channel_id,
      'role_id', cp.role_id,
      'role_name', cp.role_name,
      'user_id', cp.user_id,
      'permission', cp.permission,
      'allowed', cp.allowed,
      'created_at', cp.created_at
    )
    FROM channel_permissions cp
    WHERE cp.id = new_permission_id
  );
END;
$$;

-- Update delete_channel_permission to handle user permissions
-- (No changes needed - it already works by ID, which is fine)
