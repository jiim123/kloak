
-- Enforce single role per member: clean up existing multi-role assignments
-- Keep only the highest-priority (lowest position) non-@everyone role per member
-- If member only has @everyone, keep that

-- Step 1: Remove duplicate role assignments, keeping only the highest-priority role per member
DELETE FROM public.server_member_roles
WHERE id IN (
  SELECT smr.id
  FROM public.server_member_roles smr
  JOIN public.server_roles sr ON sr.id = smr.role_id
  JOIN public.server_members sm ON sm.id = smr.member_id
  WHERE smr.id NOT IN (
    -- Keep the one role with lowest position per member (excluding @everyone)
    SELECT DISTINCT ON (smr2.member_id) smr2.id
    FROM public.server_member_roles smr2
    JOIN public.server_roles sr2 ON sr2.id = smr2.role_id
    WHERE sr2.name != '@everyone'
    ORDER BY smr2.member_id, sr2.position ASC NULLS LAST, smr2.created_at ASC
  )
  AND sr.name != '@everyone'
);

-- Step 2: Add unique constraint on member_id to enforce single role
-- But we need to allow @everyone + one custom role, so instead enforce at the function level
-- Actually, let's just enforce it in the RPC functions since @everyone is always present

-- Step 3: Update assign_role_to_member to replace existing non-@everyone roles
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
  _everyone_role_id uuid;
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

  -- Fetch actor base role
  SELECT role INTO _actor_base_role
  FROM public.server_members
  WHERE server_id = _member_server_id AND user_id = _user_id;

  -- Owners bypass permission checks
  IF _actor_base_role != 'owner' THEN
    IF NOT public.check_user_server_permission(_user_id, _member_server_id, 'manage_roles') THEN
      RAISE EXCEPTION 'Only admins and owners can assign roles';
    END IF;
  END IF;

  -- Find the @everyone role for this server
  SELECT id INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = _member_server_id AND name = '@everyone';

  -- SINGLE ROLE ENFORCEMENT: Remove ALL existing non-@everyone roles for this member
  DELETE FROM public.server_member_roles
  WHERE member_id = _member_id
    AND role_id IS DISTINCT FROM _everyone_role_id;

  -- If assigning @everyone, just ensure it exists
  IF _role_id = _everyone_role_id THEN
    INSERT INTO public.server_member_roles (member_id, role_id)
    VALUES (_member_id, _role_id)
    ON CONFLICT DO NOTHING;
  ELSE
    -- Assign the new role (replaces any previous non-@everyone role)
    INSERT INTO public.server_member_roles (member_id, role_id)
    VALUES (_member_id, _role_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Step 4: Update remove_role_from_member - already fixed in previous migration,
-- just ensure it works with single-role model (member falls back to @everyone)
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
  _everyone_role_id uuid;
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
    
    -- Ensure member still has @everyone role after removal
    SELECT id INTO _everyone_role_id
    FROM public.server_roles
    WHERE server_id = _server_id AND name = '@everyone';
    
    IF _everyone_role_id IS NOT NULL THEN
      INSERT INTO public.server_member_roles (member_id, role_id)
      VALUES (_member_id, _everyone_role_id)
      ON CONFLICT DO NOTHING;
    END IF;
    RETURN;
  END IF;

  -- Non-owners need manage_roles permission
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Only admins and owners can remove roles';
  END IF;

  -- Hierarchy check
  SELECT role INTO _target_role
  FROM public.server_members
  WHERE server_id = _server_id AND user_id = _target_user_id;

  IF _target_role IS NOT NULL AND _actor_base_role >= _target_role THEN
    RAISE EXCEPTION 'You cannot remove roles from a member with equal or higher rank';
  END IF;

  -- Role power check
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

  -- Ensure member still has @everyone role after removal
  SELECT id INTO _everyone_role_id
  FROM public.server_roles
  WHERE server_id = _server_id AND name = '@everyone';

  IF _everyone_role_id IS NOT NULL THEN
    INSERT INTO public.server_member_roles (member_id, role_id)
    VALUES (_member_id, _everyone_role_id)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;
