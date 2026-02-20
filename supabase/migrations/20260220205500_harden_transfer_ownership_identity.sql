-- Harden transfer_ownership RPC against caller-id spoofing.

CREATE OR REPLACE FUNCTION public.transfer_ownership(
  _server_id uuid,
  _current_owner_id uuid,
  _new_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner_member_id uuid;
  new_owner_member_id uuid;
  server_actual_owner uuid;
  caller_user_id uuid;
BEGIN
  caller_user_id := public.requesting_user_id();

  IF caller_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF caller_user_id <> _current_owner_id THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  SELECT owner_id INTO server_actual_owner
  FROM servers
  WHERE id = _server_id;

  IF server_actual_owner IS NULL OR server_actual_owner <> _current_owner_id THEN
    RAISE EXCEPTION 'Permission denied: only the server owner can transfer ownership';
  END IF;

  SELECT id INTO current_owner_member_id
  FROM server_members
  WHERE server_id = _server_id
    AND user_id = _current_owner_id
    AND COALESCE(is_banned, false) = false;

  SELECT id INTO new_owner_member_id
  FROM server_members
  WHERE server_id = _server_id
    AND user_id = _new_owner_id
    AND COALESCE(is_banned, false) = false;

  IF current_owner_member_id IS NULL OR new_owner_member_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  UPDATE server_members SET role = 'owner' WHERE id = new_owner_member_id;
  UPDATE server_members SET role = 'admin' WHERE id = current_owner_member_id;
  UPDATE servers SET owner_id = _new_owner_id WHERE id = _server_id;

  RETURN true;
END;
$$;
