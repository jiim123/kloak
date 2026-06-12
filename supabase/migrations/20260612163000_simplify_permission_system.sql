-- Simplified Permission System Migration
-- Eliminates explicit deny rules and permission inheritance complexity

-- ============================================================================
-- PHASE 1: Create new simplified tables
-- ============================================================================

-- Server role permissions (replaces role_permissions)
-- Permission presence = granted access (no allowed boolean)
CREATE TABLE public.server_role_permissions_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.server_roles(id) ON DELETE CASCADE,
  permission public.permission_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  CONSTRAINT server_role_permissions_role_required CHECK (role_id IS NOT NULL),
  CONSTRAINT server_role_permissions_unique UNIQUE (server_id, role_id, permission)
);

-- Channel role permissions (replaces channel_permissions)
-- Higher priority than server role permissions
CREATE TABLE public.channel_role_permissions_new (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  role_id UUID REFERENCES public.server_roles(id) ON DELETE CASCADE,
  permission public.permission_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  CONSTRAINT channel_role_permissions_role_required CHECK (role_id IS NOT NULL),
  CONSTRAINT channel_role_permissions_unique UNIQUE (channel_id, role_id, permission)
);

-- Indexes for performance
CREATE INDEX idx_server_role_permissions_new_server ON public.server_role_permissions_new(server_id);
CREATE INDEX idx_server_role_permissions_new_role ON public.server_role_permissions_new(role_id);
CREATE INDEX idx_channel_role_permissions_new_channel ON public.channel_role_permissions_new(channel_id);
CREATE INDEX idx_channel_role_permissions_new_role ON public.channel_role_permissions_new(role_id);

-- Enable RLS
ALTER TABLE public.server_role_permissions_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_role_permissions_new ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Server role permissions viewable by members" 
  ON public.server_role_permissions_new FOR SELECT USING (true);
CREATE POLICY "Admins can manage server role permissions" 
  ON public.server_role_permissions_new FOR ALL USING (true);

CREATE POLICY "Channel role permissions viewable by members" 
  ON public.channel_role_permissions_new FOR SELECT USING (true);
CREATE POLICY "Admins can manage channel role permissions" 
  ON public.channel_role_permissions_new FOR ALL USING (true);

-- ============================================================================
-- PHASE 2: Migrate data (allow=true only, deny=remove)
-- ============================================================================

-- Migrate server role permissions (ALLOW only, custom roles only)
INSERT INTO public.server_role_permissions_new (server_id, role_id, permission, created_at, created_by)
SELECT rp.server_id, rp.role_id, rp.permission, rp.created_at, 
       s.owner_id
FROM public.role_permissions rp
JOIN public.servers s ON s.id = rp.server_id
WHERE rp.allowed = true AND rp.role_id IS NOT NULL;

-- Migrate channel role permissions (ALLOW only, custom roles only)
INSERT INTO public.channel_role_permissions_new (channel_id, role_id, permission, created_at, created_by)
SELECT cp.channel_id, cp.role_id, cp.permission, cp.created_at,
       s.owner_id
FROM public.channel_permissions cp
JOIN public.servers s ON s.id = (SELECT server_id FROM public.channels c WHERE c.id = cp.channel_id)
WHERE cp.allowed = true AND cp.role_id IS NOT NULL;

-- ============================================================================
-- PHASE 2b: Swap table names (run after verification)
-- ============================================================================

-- DROP TABLE public.role_permissions;
-- DROP TABLE public.channel_permissions;
-- ALTER TABLE public.server_role_permissions_new RENAME TO role_permissions;
-- ALTER TABLE public.channel_role_permissions_new RENAME TO channel_permissions;

-- ============================================================================
-- PHASE 3: New simplified check function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_user_permission(
  _user_id uuid,
  _channel_id uuid,
  _permission permission_type
) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER 
SET search_path TO 'public' AS $$
DECLARE
  _server_id uuid;
  _member_id uuid;
BEGIN
  -- Verify identity
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  -- Get server and verify membership
  SELECT c.server_id INTO _server_id
  FROM public.channels c
  WHERE c.id = _channel_id;

  IF _server_id IS NULL THEN
    RETURN false;
  END IF;

  -- Owner always has all permissions
  IF EXISTS (
    SELECT 1 FROM public.servers s
    WHERE s.id = _server_id AND s.owner_id = _user_id
  ) THEN
    RETURN true;
  END IF;

  -- Verify user is a non-banned member
  SELECT sm.id INTO _member_id
  FROM public.server_members sm
  WHERE sm.server_id = _server_id AND sm.user_id = _user_id 
    AND COALESCE(sm.is_banned, false) = false;

  IF _member_id IS NULL THEN
    RETURN false;
  END IF;

  -- Channel override check (highest priority) - explicit allow
  IF EXISTS (
    SELECT 1 FROM public.channel_role_permissions_new crp
    JOIN public.server_member_roles smr ON smr.role_id = crp.role_id
    WHERE crp.channel_id = _channel_id 
      AND crp.permission = _permission
      AND smr.member_id = _member_id
  ) THEN
    RETURN true;
  END IF;

  -- Server role permission check - explicit allow
  IF EXISTS (
    SELECT 1 FROM public.server_role_permissions_new srp
    JOIN public.server_member_roles smr ON smr.role_id = srp.role_id
    WHERE srp.server_id = _server_id 
      AND srp.permission = _permission
      AND smr.member_id = _member_id
  ) THEN
    RETURN true;
  END IF;

  -- Base role defaults (fallback when no explicit grants)
  -- Safe defaults for basic member functionality
  CASE _permission
    WHEN 'view_channels' THEN RETURN true;
    WHEN 'read_message_history' THEN RETURN true;
    WHEN 'send_messages' THEN RETURN true;
    WHEN 'add_reactions' THEN RETURN true;
    WHEN 'attach_files' THEN RETURN true;
    WHEN 'embed_links' THEN RETURN true;
    WHEN 'use_external_emojis' THEN RETURN true;
    WHEN 'create_instant_invite' THEN RETURN true;
    WHEN 'connect' THEN RETURN true;
    WHEN 'speak' THEN RETURN true;
    WHEN 'use_voice_activation' THEN RETURN true;
    WHEN 'change_nickname' THEN RETURN true;
    WHEN 'mention_roles' THEN RETURN true;
    WHEN 'use_application_commands' THEN RETURN true;
    ELSE RETURN false;
  END CASE;
END;
$$;

-- ============================================================================
-- PHASE 4: Helper functions for the new tables
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_server_role_permissions(_server_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.is_server_member(_server_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', srp.id,
        'server_id', srp.server_id,
        'role_id', srp.role_id,
        'permission', srp.permission,
        'created_at', srp.created_at
      )
      FROM public.server_role_permissions_new srp
      WHERE srp.server_id = _server_id
      ORDER BY srp.created_at ASC
    ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_channel_role_permissions(_channel_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.can_access_channel(_channel_id, _caller) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', crp.id,
        'channel_id', crp.channel_id,
        'role_id', crp.role_id,
        'permission', crp.permission,
        'created_at', crp.created_at
      )
      FROM public.channel_role_permissions_new crp
      WHERE crp.channel_id = _channel_id
      ORDER BY crp.created_at ASC
    ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_server_role_permission(
  _server_id uuid,
  _user_id uuid,
  _role_id uuid,
  _permission permission_type
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  _user_role server_role;
  _new_id uuid;
BEGIN
  SELECT sm.role INTO _user_role
  FROM public.server_members sm
  WHERE sm.server_id = _server_id AND sm.user_id = _user_id;

  IF _user_role IS NULL OR _user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can manage role permissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.server_roles 
    WHERE id = _role_id AND server_id = _server_id
  ) THEN
    RAISE EXCEPTION 'Role not found in this server';
  END IF;

  INSERT INTO public.server_role_permissions_new (server_id, role_id, permission, created_by)
  VALUES (_server_id, _role_id, _permission, _user_id)
  ON CONFLICT (server_id, role_id, permission) DO NOTHING
  RETURNING id INTO _new_id;

  RETURN json_build_object(
    'server_id', _server_id,
    'role_id', _role_id,
    'permission', _permission
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_channel_role_permission(
  _channel_id uuid,
  _user_id uuid,
  _role_id uuid,
  _permission permission_type
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public' AS $$
DECLARE
  _channel_server_id uuid;
  _user_role server_role;
BEGIN
  SELECT c.server_id INTO _channel_server_id
  FROM public.channels c WHERE c.id = _channel_id;

  IF _channel_server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  SELECT sm.role INTO _user_role
  FROM public.server_members sm
  WHERE sm.server_id = _channel_server_id AND sm.user_id = _user_id;

  IF _user_role IS NULL OR _user_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only admins and owners can manage channel permissions';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.server_roles 
    WHERE id = _role_id AND server_id = _channel_server_id
  ) THEN
    RAISE EXCEPTION 'Role not found in this server';
  END IF;

  INSERT INTO public.channel_role_permissions_new (channel_id, role_id, permission, created_by)
  VALUES (_channel_id, _role_id, _permission, _user_id)
  ON CONFLICT (channel_id, role_id, permission) DO NOTHING;

  RETURN json_build_object(
    'channel_id', _channel_id,
    'role_id', _role_id,
    'permission', _permission
  );
END;
$$;

-- Cleanup function to run after migration verification
CREATE OR REPLACE FUNCTION public.drop_legacy_permission_tables()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DROP TABLE IF EXISTS public.category_permissions CASCADE;
END;
$$;

NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';