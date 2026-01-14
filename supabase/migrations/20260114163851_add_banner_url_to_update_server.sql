-- Update the update_server RPC function to include banner_url
CREATE OR REPLACE FUNCTION public.update_server(
  _server_id UUID,
  _user_id UUID,
  _updates JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_role server_role;
  _updated_server servers%ROWTYPE;
BEGIN
  -- Check user's role in server
  SELECT role INTO _user_role
  FROM server_members
  WHERE server_id = _server_id AND user_id = _user_id AND is_banned = false;

  IF _user_role IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not a member of this server');
  END IF;

  -- Only owner and admin can update server settings
  IF _user_role NOT IN ('owner', 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
  END IF;

  -- Update server with provided fields
  UPDATE servers
  SET
    name = COALESCE(_updates->>'name', name),
    icon_url = CASE 
      WHEN _updates ? 'icon_url' THEN _updates->>'icon_url'
      ELSE icon_url
    END,
    banner_url = CASE 
      WHEN _updates ? 'banner_url' THEN _updates->>'banner_url'
      ELSE banner_url
    END
  WHERE id = _server_id
  RETURNING * INTO _updated_server;

  IF _updated_server.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'server', json_build_object(
      'id', _updated_server.id,
      'name', _updated_server.name,
      'icon_url', _updated_server.icon_url,
      'banner_url', _updated_server.banner_url,
      'owner_id', _updated_server.owner_id,
      'invite_code', _updated_server.invite_code,
      'created_at', _updated_server.created_at
    )
  );
END;
$$;
