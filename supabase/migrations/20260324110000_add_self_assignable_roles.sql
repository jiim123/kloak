ALTER TABLE public.server_roles
ADD COLUMN IF NOT EXISTS is_self_assignable boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.get_server_roles_secure(_server_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t) ORDER BY t.position ASC)
      FROM (
        SELECT id, server_id, name, color, icon, is_self_assignable, position, created_at
        FROM public.server_roles
        WHERE server_id = _server_id
      ) t
    ),
    '[]'::json
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.create_server_role(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _color text DEFAULT '#5865F2'::text,
  _icon text DEFAULT NULL::text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_role_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  INSERT INTO public.server_roles (server_id, name, color, icon, is_self_assignable, position)
  VALUES (
    _server_id,
    _name,
    _color,
    _icon,
    false,
    COALESCE((SELECT MAX(position) FROM public.server_roles WHERE server_id = _server_id), 0) + 1
  )
  RETURNING id INTO new_role_id;

  RETURN (
    SELECT json_build_object(
      'id', sr.id,
      'server_id', sr.server_id,
      'name', sr.name,
      'color', sr.color,
      'icon', sr.icon,
      'is_self_assignable', sr.is_self_assignable,
      'position', sr.position,
      'created_at', sr.created_at
    )
    FROM public.server_roles sr
    WHERE sr.id = new_role_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_role_self_assignable(
  _role_id uuid,
  _user_id uuid,
  _is_self_assignable boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _server_id uuid;
  _role_name text;
  result json;
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

  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only users with manage_roles permission can update roles';
  END IF;

  IF _role_name = '@everyone' AND _is_self_assignable THEN
    RAISE EXCEPTION '@everyone cannot be self assignable';
  END IF;

  UPDATE public.server_roles
  SET is_self_assignable = COALESCE(_is_self_assignable, false)
  WHERE id = _role_id;

  SELECT row_to_json(r) INTO result
  FROM public.server_roles r
  WHERE r.id = _role_id;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_self_role(
  _user_id uuid,
  _server_id uuid,
  _role_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _member_id uuid;
  _role_server_id uuid;
  _role_name text;
  _is_self_assignable boolean;
  _everyone_role_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT id
  INTO _member_id
  FROM public.server_members
  WHERE user_id = _user_id
    AND server_id = _server_id
    AND COALESCE(is_banned, false) = false;

  IF _member_id IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  SELECT server_id, name, COALESCE(is_self_assignable, false)
  INTO _role_server_id, _role_name, _is_self_assignable
  FROM public.server_roles
  WHERE id = _role_id;

  IF _role_server_id IS NULL OR _role_server_id <> _server_id THEN
    RAISE EXCEPTION 'Role not found in server';
  END IF;

  IF _role_name = '@everyone' THEN
    RAISE EXCEPTION '@everyone cannot be self-assigned';
  END IF;

  IF NOT _is_self_assignable THEN
    RAISE EXCEPTION 'Role is not self assignable';
  END IF;

  SELECT id
  INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = _server_id
    AND name = '@everyone';

  DELETE FROM public.server_member_roles
  WHERE member_id = _member_id
    AND role_id IS DISTINCT FROM _everyone_role_id;

  INSERT INTO public.server_member_roles (member_id, role_id)
  VALUES (_member_id, _role_id)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_self_role(
  _user_id uuid,
  _server_id uuid,
  _role_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _member_id uuid;
  _role_server_id uuid;
  _role_name text;
  _is_self_assignable boolean;
  _everyone_role_id uuid;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT id
  INTO _member_id
  FROM public.server_members
  WHERE user_id = _user_id
    AND server_id = _server_id
    AND COALESCE(is_banned, false) = false;

  IF _member_id IS NULL THEN
    RAISE EXCEPTION 'Not a member of this server';
  END IF;

  SELECT server_id, name, COALESCE(is_self_assignable, false)
  INTO _role_server_id, _role_name, _is_self_assignable
  FROM public.server_roles
  WHERE id = _role_id;

  IF _role_server_id IS NULL OR _role_server_id <> _server_id THEN
    RAISE EXCEPTION 'Role not found in server';
  END IF;

  IF _role_name = '@everyone' THEN
    RAISE EXCEPTION '@everyone cannot be removed';
  END IF;

  IF NOT _is_self_assignable THEN
    RAISE EXCEPTION 'Role is not self assignable';
  END IF;

  DELETE FROM public.server_member_roles
  WHERE member_id = _member_id
    AND role_id = _role_id;

  SELECT id
  INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = _server_id
    AND name = '@everyone';

  IF _everyone_role_id IS NOT NULL THEN
    INSERT INTO public.server_member_roles (member_id, role_id)
    VALUES (_member_id, _everyone_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_role_self_assignable(uuid, uuid, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assign_self_role(uuid, uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_self_role(uuid, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_role_self_assignable(uuid, uuid, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_self_role(uuid, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.remove_self_role(uuid, uuid, uuid) TO anon, authenticated;
