-- Phase 6O:
-- Restore runtime execute for get_thread_summaries while hardening it with
-- caller identity and per-thread channel access checks.

CREATE OR REPLACE FUNCTION public.get_thread_summaries(
  _thread_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _caller uuid;
  result json;
BEGIN
  _caller := public.requesting_user_id();
  IF _caller IS NULL OR NOT public.verify_request_identity(_caller) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF _thread_ids IS NULL OR array_length(_thread_ids, 1) IS NULL THEN
    RETURN '[]'::json;
  END IF;

  WITH input AS (
    SELECT DISTINCT unnest(_thread_ids) AS thread_id
  ),
  visible_threads AS (
    SELECT i.thread_id, t.channel_id, t.created_at
    FROM input i
    JOIN public.threads t ON t.id = i.thread_id
    WHERE public.can_access_channel(t.channel_id, _caller)
  ),
  counts AS (
    SELECT tm.thread_id, COUNT(*)::int AS message_count
    FROM public.thread_messages tm
    WHERE tm.thread_id IN (SELECT vt.thread_id FROM visible_threads vt)
    GROUP BY tm.thread_id
  ),
  last_tm AS (
    SELECT DISTINCT ON (tm.thread_id)
      tm.thread_id,
      tm.created_at AS last_activity,
      tm.user_id AS last_user_id
    FROM public.thread_messages tm
    WHERE tm.thread_id IN (SELECT vt.thread_id FROM visible_threads vt)
    ORDER BY tm.thread_id, tm.created_at DESC
  )
  SELECT json_agg(
    json_build_object(
      'thread_id', vt.thread_id,
      'message_count', COALESCE(c.message_count, 0),
      'last_activity', COALESCE(l.last_activity, vt.created_at),
      'last_message_author', CASE
        WHEN l.last_user_id IS NULL THEN NULL
        ELSE (
          SELECT json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'avatar_decoration', u.avatar_decoration,
            'profile_effect', u.profile_effect,
            'banner_color', u.banner_color,
            'banner_url', u.banner_url,
            'profile_theme_primary', u.profile_theme_primary,
            'profile_theme_accent', u.profile_theme_accent,
            'bio', u.bio,
            'status', u.status,
            'custom_status', u.custom_status
          )
          FROM public.users u
          WHERE u.id = l.last_user_id
        )
      END
    )
    ORDER BY COALESCE(l.last_activity, vt.created_at) DESC NULLS LAST
  )
  INTO result
  FROM visible_threads vt
  LEFT JOIN counts c ON c.thread_id = vt.thread_id
  LEFT JOIN last_tm l ON l.thread_id = vt.thread_id;

  RETURN COALESCE(result, '[]'::json);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_thread_summaries(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_thread_summaries(uuid[]) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
