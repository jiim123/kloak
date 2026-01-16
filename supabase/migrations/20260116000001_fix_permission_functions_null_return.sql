-- Fix get_role_permissions to return empty array instead of NULL
CREATE OR REPLACE FUNCTION public.get_role_permissions(_server_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', rp.id,
          'server_id', rp.server_id,
          'role_id', rp.role_id,
          'role_name', rp.role_name,
          'permission', rp.permission,
          'allowed', rp.allowed,
          'created_at', rp.created_at
        )
      )
      FROM role_permissions rp
      WHERE rp.server_id = _server_id
      ORDER BY rp.created_at ASC
    ),
    '[]'::json
  );
END;
$$;

-- Fix get_channel_permissions to return empty array instead of NULL
CREATE OR REPLACE FUNCTION public.get_channel_permissions(_channel_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id', cp.id,
          'channel_id', cp.channel_id,
          'role_id', cp.role_id,
          'role_name', cp.role_name,
          'permission', cp.permission,
          'allowed', cp.allowed,
          'created_at', cp.created_at
        )
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
      ORDER BY cp.created_at ASC
    ),
    '[]'::json
  );
END;
$$;
