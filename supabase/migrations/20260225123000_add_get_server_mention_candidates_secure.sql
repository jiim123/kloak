-- Mention autocomplete should include all non-banned server members (including offline).

CREATE OR REPLACE FUNCTION public.get_server_mention_candidates_secure(
  _server_id uuid,
  _user_id uuid,
  _query text DEFAULT '',
  _limit integer DEFAULT 50
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _q text := lower(coalesce(trim(_query), ''));
  _safe_limit integer := greatest(1, least(coalesce(_limit, 50), 200));
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN '[]'::json;
  END IF;

  RETURN COALESCE(
    (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT
          sm.user_id AS id,
          sm.nickname,
          u.username,
          u.display_name,
          u.avatar_url,
          u.banner_color,
          u.status,
          u.last_seen
        FROM public.server_members sm
        JOIN public.users u ON u.id = sm.user_id
        WHERE sm.server_id = _server_id
          AND coalesce(sm.is_banned, false) = false
          AND (
            _q = ''
            OR lower(coalesce(sm.nickname, '')) LIKE ('%' || _q || '%')
            OR lower(coalesce(u.display_name, '')) LIKE ('%' || _q || '%')
            OR lower(coalesce(u.username, '')) LIKE ('%' || _q || '%')
          )
        ORDER BY
          CASE WHEN sm.user_id = _user_id THEN 0 ELSE 1 END,
          CASE WHEN coalesce(u.status::text, 'offline') = 'offline' THEN 1 ELSE 0 END,
          lower(coalesce(sm.nickname, u.display_name, u.username)) ASC
        LIMIT _safe_limit
      ) t
    ),
    '[]'::json
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_mention_candidates_secure(uuid, uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_mention_candidates_secure(uuid, uuid, text, integer) TO anon, authenticated;

