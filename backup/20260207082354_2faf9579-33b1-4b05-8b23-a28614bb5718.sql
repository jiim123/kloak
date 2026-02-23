
-- Drop existing transfer_ownership function to allow recreation with new parameter names
DROP FUNCTION IF EXISTS public.transfer_ownership(uuid, uuid, uuid);

-- =============================================
-- PHASE 3B: transfer_ownership RPC
-- =============================================
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
BEGIN
  SELECT owner_id INTO server_actual_owner FROM servers WHERE id = _server_id;
  IF server_actual_owner IS NULL OR server_actual_owner != _current_owner_id THEN
    RAISE EXCEPTION 'Permission denied: only the server owner can transfer ownership';
  END IF;
  SELECT id INTO current_owner_member_id FROM server_members WHERE server_id = _server_id AND user_id = _current_owner_id;
  SELECT id INTO new_owner_member_id FROM server_members WHERE server_id = _server_id AND user_id = _new_owner_id AND is_banned = false;
  IF current_owner_member_id IS NULL OR new_owner_member_id IS NULL THEN
    RAISE EXCEPTION 'Member not found';
  END IF;
  UPDATE server_members SET role = 'owner' WHERE id = new_owner_member_id;
  UPDATE server_members SET role = 'admin' WHERE id = current_owner_member_id;
  UPDATE servers SET owner_id = _new_owner_id WHERE id = _server_id;
  RETURN true;
END;
$$;
