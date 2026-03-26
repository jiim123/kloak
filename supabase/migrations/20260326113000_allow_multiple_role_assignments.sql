-- Allow members to hold multiple custom roles.
-- Security posture is unchanged: identity checks and permission checks remain in place.

CREATE OR REPLACE FUNCTION public.assign_role_to_member(_user_id uuid, _member_id uuid, _role_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _member_server_id uuid;
  _role_server_id uuid;
  _actor_base_role public.server_role;
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

  SELECT role INTO _actor_base_role
  FROM public.server_members
  WHERE server_id = _member_server_id AND user_id = _user_id;

  IF _actor_base_role != 'owner' THEN
    IF NOT public.check_user_server_permission(_user_id, _member_server_id, 'manage_roles') THEN
      RAISE EXCEPTION 'Only admins and owners can assign roles';
    END IF;
  END IF;

  INSERT INTO public.server_member_roles (member_id, role_id)
  VALUES (_member_id, _role_id)
  ON CONFLICT DO NOTHING;
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

  INSERT INTO public.server_member_roles (member_id, role_id)
  VALUES (_member_id, _role_id)
  ON CONFLICT DO NOTHING;
END;
$$;
