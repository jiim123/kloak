
-- Drop ALL overloaded versions of set_channel_permission
DROP FUNCTION IF EXISTS public.set_channel_permission(uuid, uuid, permission_type, boolean, uuid, server_role);
DROP FUNCTION IF EXISTS public.set_channel_permission(uuid, uuid, permission_type, boolean, uuid, server_role, uuid);
DROP FUNCTION IF EXISTS public.set_channel_permission(uuid, uuid, permission_type, boolean, uuid, text, uuid);
DROP FUNCTION IF EXISTS public.set_channel_permission(uuid, uuid, permission_type, uuid, text, uuid, boolean);

-- Recreate a single, clean function matching what the client sends:
-- _channel_id, _user_id, _permission, _allowed, _role_id, _role_name, _target_user_id
CREATE OR REPLACE FUNCTION public.set_channel_permission(
  _channel_id uuid,
  _user_id uuid,
  _permission permission_type,
  _allowed boolean,
  _role_id uuid DEFAULT NULL,
  _role_name text DEFAULT NULL,
  _target_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id uuid;
BEGIN
  -- Get channel's server
  SELECT server_id INTO _server_id FROM channels WHERE id = _channel_id;
  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  -- Permission check: owner bypass or manage_channels
  IF NOT EXISTS (SELECT 1 FROM servers WHERE id = _server_id AND owner_id = _user_id) THEN
    IF NOT check_user_server_permission(_user_id, _server_id, 'manage_channels'::permission_type) THEN
      RAISE EXCEPTION 'You do not have permission to manage channel permissions';
    END IF;
  END IF;

  -- Upsert based on target type
  IF _target_user_id IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, user_id, permission, allowed)
    VALUES (_channel_id, _target_user_id, _permission, _allowed)
    ON CONFLICT (channel_id, user_id, permission) WHERE user_id IS NOT NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, role_id, permission, allowed)
    VALUES (_channel_id, _role_id, _permission, _allowed)
    ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL AND user_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO channel_permissions (channel_id, role_name, permission, allowed)
    VALUES (_channel_id, _role_name::server_role, _permission, _allowed)
    ON CONFLICT (channel_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL AND user_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided';
  END IF;
END;
$$;
