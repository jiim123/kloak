-- Create RPC function to regenerate invite code with permission check
-- Note: This replaces the direct database update in InviteModal
CREATE OR REPLACE FUNCTION public.regenerate_invite_code(
  _server_id uuid,
  _user_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code text;
BEGIN
  -- Check permission using database-backed permission system
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_invites') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Generate new invite code (8 characters, alphanumeric, excluding ambiguous chars)
  new_code := upper(
    substring(
      md5(random()::text || clock_timestamp()::text) 
      from 1 for 8
    )
  );
  
  -- Update server with new invite code
  UPDATE servers 
  SET invite_code = new_code 
  WHERE id = _server_id;
  
  RETURN new_code;
END;
$$;
