-- Remove ambiguous RPC overloads that leak candidate signatures via PGRST203.
-- Keep one canonical signature per exposed RPC name.

-- -------------------------------------------------------------------
-- register_user: keep only 3-arg signature (_username, _key_hash, _banner_color)
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.register_user(text, text);

-- -------------------------------------------------------------------
-- create_server_role: keep only 5-arg signature with optional icon.
-- This covers both previous 4-arg and 5-arg call styles without overloading.
-- -------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_server_role(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.create_server_role(
  _server_id uuid,
  _user_id uuid,
  _name text,
  _color text DEFAULT '#5865F2',
  _icon text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_role_id uuid;
BEGIN
  IF NOT public.check_user_server_permission(_user_id, _server_id, 'manage_roles') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Forbidden';
  END IF;

  INSERT INTO public.server_roles (server_id, name, color, icon, position)
  VALUES (
    _server_id,
    _name,
    _color,
    _icon,
    COALESCE((SELECT MAX(position) FROM public.server_roles WHERE server_id = _server_id), 0) + 1
  )
  RETURNING id INTO new_role_id;

  RETURN (
    SELECT json_build_object(
      'id', sr.id,
      'server_id', sr.server_id,
      'name', sr.name,
      'color', sr.color,
      'icon', sr.icon,
      'position', sr.position,
      'created_at', sr.created_at
    )
    FROM public.server_roles sr
    WHERE sr.id = new_role_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_server_role(uuid, uuid, text, text, text) TO anon, authenticated;
