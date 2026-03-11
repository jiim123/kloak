CREATE OR REPLACE FUNCTION public.get_server_surface_secure(
  _server_id uuid,
  _user_id uuid DEFAULT NULL::uuid
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid;
BEGIN
  _caller := public.requesting_user_id();

  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF _user_id IS NOT NULL AND _user_id <> _caller THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _caller) THEN
    RETURN json_build_object(
      'categories', '[]'::json,
      'channels', '[]'::json,
      'roles', '[]'::json,
      'role_permissions', '[]'::json,
      'member_count', 0,
      'emojis', '[]'::json
    );
  END IF;

  RETURN json_build_object(
    'categories', COALESCE(public.get_server_categories(_server_id, _caller), '[]'::json),
    'channels', COALESCE(public.get_server_channels(_server_id, _caller), '[]'::json),
    'roles', COALESCE(public.get_server_roles_secure(_server_id, _caller), '[]'::json),
    'role_permissions', COALESCE(public.get_role_permissions(_server_id), '[]'::json),
    'member_count', COALESCE(public.get_server_member_count_secure(_server_id, _caller), 0),
    'emojis',
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', se.id,
              'name', se.name,
              'file_path', se.file_path
            )
            ORDER BY se.created_at ASC
          )
          FROM public.server_emojis se
          WHERE se.server_id = _server_id
        ),
        '[]'::json
      )
  );
END;
$function$;
