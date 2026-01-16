-- Nuke and rebuild permission constraints to be absolutely sure they are clean
-- and update functions to use a more robust pattern

-- Drop all possible unique constraints/indexes from role_permissions
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all unique constraints
    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'public.role_permissions'::regclass AND contype = 'u') LOOP
        EXECUTE 'ALTER TABLE public.role_permissions DROP CONSTRAINT ' || r.conname;
    END LOOP;
    -- Drop all unique indexes that might be interfering (excluding primary keys)
    FOR r IN (
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'role_permissions' 
          AND schemaname = 'public' 
          AND (indexname LIKE '%unique%' OR indexname LIKE '%key%')
          AND indexname NOT LIKE '%pkey%' -- DO NOT DROP PRIMARY KEY
    ) LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || r.indexname;
    END LOOP;
END $$;

-- Drop all possible unique constraints/indexes from channel_permissions
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    -- Drop all unique constraints
    FOR r IN (SELECT conname FROM pg_constraint WHERE conrelid = 'public.channel_permissions'::regclass AND contype = 'u') LOOP
        EXECUTE 'ALTER TABLE public.channel_permissions DROP CONSTRAINT ' || r.conname;
    END LOOP;
    -- Drop all unique indexes that might be interfering (excluding primary keys)
    FOR r IN (
        SELECT indexname 
        FROM pg_indexes 
        WHERE tablename = 'channel_permissions' 
          AND schemaname = 'public' 
          AND (indexname LIKE '%unique%' OR indexname LIKE '%key%')
          AND indexname NOT LIKE '%pkey%' -- DO NOT DROP PRIMARY KEY
    ) LOOP
        EXECUTE 'DROP INDEX IF EXISTS public.' || r.indexname;
    END LOOP;
END $$;

-- Now create CLEAN partial unique indexes
-- For role_permissions
CREATE UNIQUE INDEX rp_custom_role_unique ON public.role_permissions (server_id, role_id, permission) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX rp_base_role_unique ON public.role_permissions (server_id, role_name, permission) WHERE role_name IS NOT NULL;

-- For channel_permissions
CREATE UNIQUE INDEX cp_custom_role_unique ON public.channel_permissions (channel_id, role_id, permission) WHERE role_id IS NOT NULL;
CREATE UNIQUE INDEX cp_base_role_unique ON public.channel_permissions (channel_id, role_name, permission) WHERE role_name IS NOT NULL;

-- Update the RPC functions to use DELETE then INSERT instead of ON CONFLICT
-- This is much more reliable when dealing with partial indexes and NULLs

CREATE OR REPLACE FUNCTION public.set_role_permission(
  _server_id uuid,
  _user_id uuid,
  _permission permission_type,
  _role_id uuid DEFAULT NULL,
  _role_name server_role DEFAULT NULL,
  _allowed boolean DEFAULT true
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role server_role;
  new_permission_id uuid;
BEGIN
  -- Check if user is admin or owner
  SELECT role INTO user_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can manage role permissions';
  END IF;
  
  -- Delete existing matching permission first to avoid conflicts
  DELETE FROM role_permissions
  WHERE server_id = _server_id
    AND (role_id = _role_id OR (_role_id IS NULL AND role_id IS NULL))
    AND (role_name = _role_name OR (_role_name IS NULL AND role_name IS NULL))
    AND permission = _permission;
  
  -- Insert the new permission
  INSERT INTO role_permissions (server_id, role_id, role_name, permission, allowed)
  VALUES (_server_id, _role_id, _role_name, _permission, _allowed)
  RETURNING id INTO new_permission_id;
  
  RETURN (
    SELECT json_build_object(
      'id', rp.id,
      'server_id', rp.server_id,
      'role_id', rp.role_id,
      'role_name', rp.role_name,
      'permission', rp.permission,
      'allowed', rp.allowed,
      'created_at', rp.created_at
    )
    FROM role_permissions rp
    WHERE rp.id = new_permission_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_channel_permission(
  _channel_id uuid,
  _user_id uuid,
  _permission permission_type,
  _allowed boolean,
  _role_id uuid DEFAULT NULL,
  _role_name server_role DEFAULT NULL
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
  SELECT server_id INTO channel_server_id FROM channels WHERE id = _channel_id;
  
  IF channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;
  
  -- Check if user is admin or owner
  SELECT role INTO user_role FROM server_members
  WHERE server_id = channel_server_id AND user_id = _user_id;
  
  IF user_role IS NULL OR (user_role != 'owner' AND user_role != 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can manage channel permissions';
  END IF;
  
  -- Delete existing matching permission first to avoid conflicts
  DELETE FROM channel_permissions
  WHERE channel_id = _channel_id
    AND (role_id = _role_id OR (_role_id IS NULL AND role_id IS NULL))
    AND (role_name = _role_name OR (_role_name IS NULL AND role_name IS NULL))
    AND permission = _permission;
  
  -- Insert the new permission
  INSERT INTO channel_permissions (channel_id, role_id, role_name, permission, allowed)
  VALUES (_channel_id, _role_id, _role_name, _permission, _allowed)
  RETURNING id INTO new_permission_id;
  
  RETURN (
    SELECT json_build_object(
      'id', cp.id,
      'channel_id', cp.channel_id,
      'role_id', cp.role_id,
      'role_name', cp.role_name,
      'permission', cp.permission,
      'allowed', cp.allowed,
      'created_at', cp.created_at
    )
    FROM channel_permissions cp
    WHERE cp.id = new_permission_id
  );
END;
$$;
