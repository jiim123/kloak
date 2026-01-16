-- Fix UNIQUE constraints for role_permissions and channel_permissions
-- The issue: UNIQUE(server_id, role_id, role_name, permission) doesn't work properly
-- because one of role_id or role_name is always NULL, and NULL != NULL in SQL

-- Step 1: Drop the old unique constraints
ALTER TABLE public.role_permissions DROP CONSTRAINT IF EXISTS role_permissions_server_id_role_id_role_name_permission_key;
ALTER TABLE public.channel_permissions DROP CONSTRAINT IF EXISTS channel_permissions_channel_id_role_id_role_name_permission_key;

-- Step 2: Create partial unique indexes that handle NULL properly
-- For role_permissions with role_id (custom roles)
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_custom_role_unique 
ON public.role_permissions (server_id, role_id, permission) 
WHERE role_id IS NOT NULL;

-- For role_permissions with role_name (base roles)
CREATE UNIQUE INDEX IF NOT EXISTS role_permissions_base_role_unique 
ON public.role_permissions (server_id, role_name, permission) 
WHERE role_name IS NOT NULL;

-- For channel_permissions with role_id (custom roles)
CREATE UNIQUE INDEX IF NOT EXISTS channel_permissions_custom_role_unique 
ON public.channel_permissions (channel_id, role_id, permission) 
WHERE role_id IS NOT NULL;

-- For channel_permissions with role_name (base roles)
CREATE UNIQUE INDEX IF NOT EXISTS channel_permissions_base_role_unique 
ON public.channel_permissions (channel_id, role_name, permission) 
WHERE role_name IS NOT NULL;
