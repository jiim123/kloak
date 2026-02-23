-- Update get_channel_permissions to include user_id in response

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
          'user_id', cp.user_id,
          'permission', cp.permission,
          'allowed', cp.allowed,
          'created_at', cp.created_at
        ) ORDER BY cp.created_at ASC
      )
      FROM channel_permissions cp
      WHERE cp.channel_id = _channel_id
    ),
    '[]'::json
  );
END;
$$;
