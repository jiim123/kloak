CREATE OR REPLACE FUNCTION public.profile(
  _target_user_id uuid,
  _requesting_user_id uuid,
  _server_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _shared_server_ids json := '[]'::json;
BEGIN
  IF NOT public.verify_request_identity(_requesting_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.can_view_user(_target_user_id, _requesting_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF COALESCE(array_length(_server_ids, 1), 0) > 0 THEN
    SELECT COALESCE(json_agg(sm.server_id), '[]'::json)
      INTO _shared_server_ids
    FROM public.server_members sm
    WHERE sm.user_id = _target_user_id
      AND sm.server_id = ANY(_server_ids)
      AND COALESCE(sm.is_banned, false) = false;
  END IF;

  RETURN json_build_object(
    'user', (
      SELECT row_to_json(u)
      FROM (
        SELECT id, username, display_name, avatar_url, banner_url, avatar_decoration, profile_effect,
               banner_color, profile_theme_primary, profile_theme_accent, bio, status,
               custom_status, created_at, last_seen, pronouns, is_bot
        FROM public.users
        WHERE id = _target_user_id
        LIMIT 1
      ) u
    ),
    'badges', COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'id', b.id,
            'name', b.name,
            'icon_url', b.icon_url,
            'description', b.description
          )
        )
        FROM public.user_badges ub
        JOIN public.badges b ON b.id = ub.badge_id
        WHERE ub.user_id = _target_user_id
      ),
      '[]'::json
    ),
    'shared_server_ids', _shared_server_ids,
    'declined_at', (
      SELECT dfr.declined_at
      FROM public.declined_friend_requests dfr
      WHERE dfr.requester_id = _requesting_user_id
        AND dfr.addressee_id = _target_user_id
      ORDER BY dfr.declined_at DESC
      LIMIT 1
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.profile(uuid, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile(uuid, uuid, uuid[]) TO anon, authenticated;
