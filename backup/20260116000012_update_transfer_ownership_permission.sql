-- Update transfer_ownership to use permission check
CREATE OR REPLACE FUNCTION public.transfer_ownership(
  _server_id uuid,
  _user_id uuid,
  _new_owner_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_owner_role text;
BEGIN
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'transfer_ownership') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  SELECT role INTO new_owner_role FROM server_members 
  WHERE server_id = _server_id AND user_id = _new_owner_id AND is_banned = false;
  
  IF new_owner_role IS NULL THEN
    RAISE EXCEPTION 'Target user is not a member of this server';
  END IF;
  
  -- Update the new owner's role
  UPDATE server_members SET role = 'owner' WHERE server_id = _server_id AND user_id = _new_owner_id;
  
  -- Demote the old owner to admin
  UPDATE server_members SET role = 'admin' WHERE server_id = _server_id AND user_id = _user_id;
  
  -- Update the server's owner_id
  UPDATE servers SET owner_id = _new_owner_id WHERE id = _server_id;
  
  RETURN true;
END;
$$;
