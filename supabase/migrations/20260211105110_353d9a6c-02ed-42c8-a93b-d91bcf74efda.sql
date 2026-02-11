
CREATE OR REPLACE FUNCTION public.reorder_server_roles(
  _server_id UUID,
  _user_id UUID,
  _ordered_role_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  i INT;
BEGIN
  -- Verify user has permission (correct parameter order: user_id, server_id, permission)
  IF NOT check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION 'Permission denied: cannot reorder roles';
  END IF;

  -- Update positions based on array order
  FOR i IN 1..array_length(_ordered_role_ids, 1) LOOP
    UPDATE server_roles
    SET position = i - 1
    WHERE id = _ordered_role_ids[i]
      AND server_id = _server_id;
  END LOOP;
END;
$$;
