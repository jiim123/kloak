-- Fetch role/nickname styling metadata for a bounded set of message authors.
-- This avoids loading the full offline member roster while preserving message role colors.

CREATE OR REPLACE FUNCTION public.get_message_author_styles_secure(
  _server_id uuid,
  _user_id uuid,
  _target_user_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN '[]'::json;
  END IF;

  IF COALESCE(array_length(_target_user_ids, 1), 0) = 0 THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'user_id', sm.user_id,
          'role', sm.role,
          'nickname', sm.nickname,
          'roles', COALESCE(
            (
              SELECT json_agg(
                json_build_object(
                  'id', sr.id,
                  'server_id', sr.server_id,
                  'name', sr.name,
                  'color', sr.color,
                  'icon', sr.icon,
                  'position', sr.position,
                  'created_at', sr.created_at
                )
                ORDER BY sr.position ASC
              )
              FROM public.server_member_roles smr
              JOIN public.server_roles sr ON sr.id = smr.role_id
              WHERE smr.member_id = sm.id
            ),
            '[]'::json
          )
        )
      )
      FROM public.server_members sm
      WHERE sm.server_id = _server_id
        AND sm.user_id = ANY(_target_user_ids)
        AND COALESCE(sm.is_banned, false) = false
    ),
    '[]'::json
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_message_author_styles_secure(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_message_author_styles_secure(uuid, uuid, uuid[]) TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;

