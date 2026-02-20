-- Harden server governance abuse paths (non-admin disruption via direct RPC calls).
-- Focus: preserve expected Discord-like admin/mod flows while blocking privilege bypasses.

-- -------------------------------------------------------------------
-- Core permission check: banned members must never pass server permission checks.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_server_permission(
  _user_id uuid,
  _server_id uuid,
  _permission public.permission_type
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_owner boolean;
  _everyone_role_id uuid;
  _member_id uuid;
  _result boolean;
BEGIN
  SELECT (owner_id = _user_id) INTO _is_owner
  FROM public.servers
  WHERE id = _server_id;

  IF _is_owner THEN
    RETURN true;
  END IF;

  SELECT id INTO _member_id
  FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = _user_id
    AND COALESCE(is_banned, false) = false;

  IF _member_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT id INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = _server_id
    AND name = '@everyone';

  SELECT CASE
    WHEN bool_or(allowed = false) THEN false
    WHEN bool_or(allowed = true) THEN true
    ELSE NULL
  END INTO _result
  FROM public.role_permissions rp
  JOIN public.server_member_roles smr
    ON smr.role_id = rp.role_id
   AND smr.member_id = _member_id
  WHERE rp.permission = _permission;

  IF _result IS NOT NULL THEN
    RETURN _result;
  END IF;

  IF _everyone_role_id IS NOT NULL THEN
    SELECT allowed INTO _result
    FROM public.role_permissions
    WHERE role_id = _everyone_role_id
      AND permission = _permission
    LIMIT 1;

    IF _result IS NOT NULL THEN
      RETURN _result;
    END IF;
  END IF;

  RETURN false;
END;
$$;

-- -------------------------------------------------------------------
-- create_channel: disallow null _user_id bypass and enforce manage_channels.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_channel(
  _server_id uuid,
  _name text,
  _type text DEFAULT 'text',
  _user_id uuid DEFAULT NULL,
  _category_id uuid DEFAULT NULL,
  _position integer DEFAULT NULL,
  _icon text DEFAULT NULL,
  _is_private boolean DEFAULT false,
  _ghost_mode boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_channel public.channels%ROWTYPE;
  final_position integer;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: user_id required';
  END IF;

  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF _position IS NULL THEN
    SELECT COALESCE(MAX(position), -1) + 1
      INTO final_position
    FROM public.channels
    WHERE server_id = _server_id
      AND ((_category_id IS NULL AND category_id IS NULL) OR category_id = _category_id);
  ELSE
    final_position := _position;
  END IF;

  INSERT INTO public.channels (
    server_id, name, type, category_id, position, icon, is_private, ghost_mode, is_read_only
  )
  VALUES (
    _server_id, _name, _type::public.channel_type, _category_id, final_position, _icon,
    _is_private, _ghost_mode, false
  )
  RETURNING * INTO new_channel;

  IF _is_private THEN
    INSERT INTO public.channel_members (channel_id, user_id, added_by)
    VALUES (new_channel.id, _user_id, _user_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN row_to_json(new_channel);
END;
$$;

-- -------------------------------------------------------------------
-- update_channel / update_category: add missing manage_channels authorization.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_channel(_channel_id uuid, _user_id uuid, _updates text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id uuid;
  _parsed jsonb;
  _result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  _parsed := _updates::jsonb;

  UPDATE public.channels
  SET
    name = COALESCE(_parsed->>'name', name),
    topic = CASE WHEN _parsed ? 'topic' THEN (_parsed->>'topic') ELSE topic END,
    is_nsfw = COALESCE((_parsed->>'is_nsfw')::boolean, is_nsfw),
    slowmode_seconds = COALESCE((_parsed->>'slowmode_seconds')::int, slowmode_seconds),
    is_read_only = COALESCE((_parsed->>'is_read_only')::boolean, is_read_only),
    is_private = COALESCE((_parsed->>'is_private')::boolean, is_private),
    block_links = COALESCE((_parsed->>'block_links')::boolean, block_links),
    allowed_link_domains = CASE
      WHEN _parsed ? 'allowed_link_domains' THEN ARRAY(SELECT jsonb_array_elements_text(_parsed->'allowed_link_domains'))
      ELSE allowed_link_domains
    END,
    ghost_mode = CASE
      WHEN (_parsed->>'ghost_mode')::boolean = true THEN true
      ELSE ghost_mode
    END,
    icon = CASE WHEN _parsed ? 'icon' THEN (_parsed->>'icon') ELSE icon END
  WHERE id = _channel_id;

  SELECT jsonb_build_object(
    'id', c.id, 'server_id', c.server_id, 'category_id', c.category_id,
    'name', c.name, 'topic', c.topic, 'type', c.type, 'position', c.position,
    'is_nsfw', c.is_nsfw, 'slowmode_seconds', c.slowmode_seconds,
    'is_read_only', c.is_read_only, 'is_private', c.is_private,
    'block_links', c.block_links, 'allowed_link_domains', c.allowed_link_domains,
    'ghost_mode', c.ghost_mode, 'icon', c.icon, 'created_at', c.created_at
  ) INTO _result
  FROM public.channels c
  WHERE c.id = _channel_id;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_category(_category_id uuid, _user_id uuid, _updates text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id uuid;
  _parsed jsonb;
  _result jsonb;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channel_categories
  WHERE id = _category_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  _parsed := _updates::jsonb;

  UPDATE public.channel_categories
  SET name = COALESCE(_parsed->>'name', name)
  WHERE id = _category_id;

  SELECT jsonb_build_object(
    'id', cc.id, 'server_id', cc.server_id,
    'name', cc.name, 'position', cc.position, 'created_at', cc.created_at
  ) INTO _result
  FROM public.channel_categories cc
  WHERE cc.id = _category_id;

  RETURN _result;
END;
$$;

-- -------------------------------------------------------------------
-- move_channel_to_category: add caller identity + authorization checks.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.move_channel_to_category(
  _channel_id uuid,
  _server_id uuid,
  _category_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_position integer;
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_caller, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.channels
    WHERE id = _channel_id
      AND server_id = _server_id
  ) THEN
    RAISE EXCEPTION 'Channel not found in server';
  END IF;

  SELECT COALESCE(MAX(position), -1) + 1 INTO new_position
  FROM public.channels
  WHERE server_id = _server_id
    AND category_id IS NOT DISTINCT FROM _category_id;

  UPDATE public.channels
  SET category_id = _category_id, position = new_position
  WHERE id = _channel_id
    AND server_id = _server_id;

  RETURN true;
END;
$$;

-- -------------------------------------------------------------------
-- permission mutators: remove nullable user bypass.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_channel_permission(
  _channel_id uuid,
  _user_id uuid,
  _permission public.permission_type,
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
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'You do not have permission to manage channel permissions';
  END IF;

  IF _target_user_id IS NOT NULL THEN
    INSERT INTO public.channel_permissions (channel_id, user_id, permission, allowed)
    VALUES (_channel_id, _target_user_id, _permission, _allowed)
    ON CONFLICT (channel_id, user_id, permission) WHERE user_id IS NOT NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN
    INSERT INTO public.channel_permissions (channel_id, role_id, permission, allowed)
    VALUES (_channel_id, _role_id, _permission, _allowed)
    ON CONFLICT (channel_id, role_id, permission) WHERE role_id IS NOT NULL AND user_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO public.channel_permissions (channel_id, role_name, permission, allowed)
    VALUES (_channel_id, _role_name::public.server_role, _permission, _allowed)
    ON CONFLICT (channel_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL AND user_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_category_permission(
  _category_id uuid,
  _user_id uuid,
  _permission text,
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
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channel_categories
  WHERE id = _category_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'You do not have permission to manage category permissions';
  END IF;

  IF _target_user_id IS NOT NULL THEN
    INSERT INTO public.category_permissions (category_id, user_id, permission, allowed)
    VALUES (_category_id, _target_user_id, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_id IS NOT NULL THEN
    INSERT INTO public.category_permissions (category_id, role_id, permission, allowed)
    VALUES (_category_id, _role_id, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO public.category_permissions (category_id, role_name, permission, allowed)
    VALUES (_category_id, _role_name, _permission, _allowed)
    ON CONFLICT (category_id, role_id, role_name, user_id, permission)
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'One of role_id, role_name, or target_user_id must be provided';
  END IF;
END;
$$;

-- -------------------------------------------------------------------
-- Role/member governance: enforce actor permission through central checker.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_role_to_member(_user_id uuid, _member_id uuid, _role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _member_server_id uuid;
  _role_server_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _member_server_id
  FROM public.server_members
  WHERE id = _member_id;

  SELECT server_id INTO _role_server_id
  FROM public.server_roles
  WHERE id = _role_id;

  IF _member_server_id IS NULL OR _role_server_id IS NULL OR _member_server_id <> _role_server_id THEN
    RAISE EXCEPTION 'Invalid member/role combination';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _member_server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only admins and owners can assign roles';
  END IF;

  INSERT INTO public.server_member_roles (member_id, role_id)
  VALUES (_member_id, _role_id)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.ban_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'ban_members') THEN
    RAISE EXCEPTION 'You do not have permission to ban members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = _server_id AND owner_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot ban the server owner';
  END IF;

  UPDATE public.server_members
  SET is_banned = true
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.kick_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'kick_members') THEN
    RAISE EXCEPTION 'You do not have permission to kick members';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.servers
    WHERE id = _server_id AND owner_id = _target_user_id
  ) THEN
    RAISE EXCEPTION 'Cannot kick the server owner';
  END IF;

  DELETE FROM public.server_member_roles
  WHERE member_id IN (
    SELECT id FROM public.server_members
    WHERE server_id = _server_id AND user_id = _target_user_id
  );

  DELETE FROM public.server_members
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mute_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'mute_members') THEN
    RAISE EXCEPTION 'You do not have permission to mute members';
  END IF;

  UPDATE public.server_members
  SET is_muted = true
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unmute_member(_server_id uuid, _user_id uuid, _target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'mute_members') THEN
    RAISE EXCEPTION 'You do not have permission to unmute members';
  END IF;

  UPDATE public.server_members
  SET is_muted = false
  WHERE server_id = _server_id
    AND user_id = _target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_role_permission(
  _server_id uuid,
  _user_id uuid,
  _permission public.permission_type,
  _role_id uuid DEFAULT NULL,
  _role_name text DEFAULT NULL,
  _allowed boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only admins and owners can manage role permissions';
  END IF;

  IF _role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (server_id, role_id, permission, allowed)
    VALUES (_server_id, _role_id, _permission, _allowed)
    ON CONFLICT (server_id, role_id, permission) WHERE role_id IS NOT NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSIF _role_name IS NOT NULL THEN
    INSERT INTO public.role_permissions (server_id, role_name, permission, allowed)
    VALUES (_server_id, _role_name, _permission, _allowed)
    ON CONFLICT (server_id, role_name, permission) WHERE role_name IS NOT NULL AND role_id IS NULL
    DO UPDATE SET allowed = EXCLUDED.allowed;
  ELSE
    RAISE EXCEPTION 'Either role_id or role_name must be provided';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_channel(_channel_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channels
  WHERE id = _channel_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Only users with manage_channels permission can delete channels';
  END IF;

  DELETE FROM public.messages WHERE channel_id = _channel_id;
  DELETE FROM public.channels WHERE id = _channel_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_category(_category_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.channel_categories
  WHERE id = _category_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Category not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Only users with manage_channels permission can delete categories';
  END IF;

  UPDATE public.channels
  SET category_id = NULL
  WHERE category_id = _category_id;

  DELETE FROM public.channel_categories
  WHERE id = _category_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_server_role(
  _role_id uuid,
  _user_id uuid,
  _name text DEFAULT NULL,
  _color text DEFAULT NULL,
  _icon text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id uuid;
  result json;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id INTO _server_id
  FROM public.server_roles
  WHERE id = _role_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only users with manage_roles permission can update roles';
  END IF;

  UPDATE public.server_roles
  SET
    name = COALESCE(_name, name),
    color = COALESCE(_color, color),
    icon = _icon
  WHERE id = _role_id;

  SELECT row_to_json(r) INTO result
  FROM public.server_roles r
  WHERE r.id = _role_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_server_role(_role_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id uuid;
  _role_name text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT server_id, name
    INTO _server_id, _role_name
  FROM public.server_roles
  WHERE id = _role_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Role not found';
  END IF;

  IF _role_name = '@everyone' THEN
    RAISE EXCEPTION 'Cannot delete the @everyone role';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only users with manage_roles permission can delete roles';
  END IF;

  DELETE FROM public.server_member_roles WHERE role_id = _role_id;
  DELETE FROM public.role_permissions WHERE role_id = _role_id;
  DELETE FROM public.server_roles WHERE id = _role_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_channels(
  _server_id uuid,
  _user_id uuid,
  _channel_id uuid,
  _new_category_id uuid,
  _new_position integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _old_category_id uuid;
  _old_position integer;
  _rec record;
  _pos integer;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_channels') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT category_id, position INTO _old_category_id, _old_position
  FROM public.channels
  WHERE id = _channel_id
    AND server_id = _server_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Channel not found';
  END IF;

  _pos := 0;
  FOR _rec IN
    SELECT id
    FROM public.channels
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _old_category_id
    ORDER BY position, created_at
  LOOP
    UPDATE public.channels SET position = _pos WHERE id = _rec.id;
    _pos := _pos + 1;
  END LOOP;

  IF NOT (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    _pos := 0;
    FOR _rec IN
      SELECT id
      FROM public.channels
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
      ORDER BY position, created_at
    LOOP
      UPDATE public.channels SET position = _pos WHERE id = _rec.id;
      _pos := _pos + 1;
    END LOOP;
  END IF;

  SELECT position INTO _old_position
  FROM public.channels
  WHERE id = _channel_id
    AND server_id = _server_id;

  IF (_old_category_id IS NOT DISTINCT FROM _new_category_id) THEN
    IF _new_position > _old_position THEN
      UPDATE public.channels
      SET position = position - 1
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
        AND position > _old_position
        AND position <= _new_position
        AND id <> _channel_id;
    ELSIF _new_position < _old_position THEN
      UPDATE public.channels
      SET position = position + 1
      WHERE server_id = _server_id
        AND category_id IS NOT DISTINCT FROM _new_category_id
        AND position >= _new_position
        AND position < _old_position
        AND id <> _channel_id;
    END IF;
  ELSE
    UPDATE public.channels
    SET position = position - 1
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _old_category_id
      AND position > _old_position;

    UPDATE public.channels
    SET position = position + 1
    WHERE server_id = _server_id
      AND category_id IS NOT DISTINCT FROM _new_category_id
      AND position >= _new_position;
  END IF;

  UPDATE public.channels
  SET category_id = _new_category_id, position = _new_position
  WHERE id = _channel_id
    AND server_id = _server_id;
END;
$$;
