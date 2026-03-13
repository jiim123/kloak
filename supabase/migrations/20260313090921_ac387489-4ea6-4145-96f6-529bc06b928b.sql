CREATE OR REPLACE FUNCTION public.remove_role_from_member(
  _user_id uuid,
  _member_id uuid,
  _role_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _server_id uuid;
  _role_position integer;
  _actor_min_position integer;
  _actor_base_role public.server_role;
  _target_user_id uuid;
  _target_role public.server_role;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT sm.server_id, sm.user_id INTO _server_id, _target_user_id
  FROM public.server_members sm WHERE sm.id = _member_id;

  IF _server_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  -- Fetch actor base role FIRST
  SELECT role INTO _actor_base_role
  FROM public.server_members
  WHERE server_id = _server_id AND user_id = _user_id;

  -- Owners bypass ALL checks
  IF _actor_base_role = 'owner' THEN
    DELETE FROM public.server_member_roles WHERE member_id = _member_id AND role_id = _role_id;
    RETURN;
  END IF;

  -- Non-owners need manage_roles permission
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only admins and owners can remove roles';
  END IF;

  -- Hierarchy check: actor cannot remove roles from members who outrank them
  SELECT role INTO _target_role
  FROM public.server_members
  WHERE server_id = _server_id AND user_id = _target_user_id;

  IF _target_role IS NOT NULL AND _actor_base_role >= _target_role THEN
    RAISE EXCEPTION 'You cannot remove roles from a member with equal or higher rank';
  END IF;

  -- Role power check: actor cannot remove a role that outranks their own custom roles
  SELECT position INTO _role_position
  FROM public.server_roles WHERE id = _role_id;

  SELECT MIN(sr.position) INTO _actor_min_position
  FROM public.server_member_roles smr
  JOIN public.server_roles sr ON sr.id = smr.role_id
  JOIN public.server_members sm ON sm.id = smr.member_id
  WHERE sm.user_id = _user_id AND sm.server_id = _server_id;

  IF _actor_min_position IS NOT NULL AND _role_position < _actor_min_position THEN
    RAISE EXCEPTION 'You cannot remove a role that outranks your own';
  END IF;

  DELETE FROM public.server_member_roles WHERE member_id = _member_id AND role_id = _role_id;
END;
$$;