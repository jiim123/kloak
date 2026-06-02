CREATE OR REPLACE FUNCTION public.get_server_overview_secure(
  _server_id uuid,
  _user_id uuid,
  _announcement_limit integer DEFAULT 5,
  _forum_limit integer DEFAULT 4,
  _calendar_limit integer DEFAULT 4
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _now timestamptz := now();
  _range_end timestamptz := now() + interval '60 days';
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN json_build_object(
    'announcements',
    COALESCE(
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC)
        FROM (
          SELECT
            m.id,
            m.content,
            m.created_at,
            m.channel_id,
            c.name AS channel_name,
            row_to_json(u) AS "user"
          FROM public.messages m
          JOIN public.channels c ON c.id = m.channel_id
          JOIN public.users u ON u.id = m.user_id
          WHERE c.server_id = _server_id
            AND c.type = 'announcement'
            AND public.can_access_channel(c.id, _user_id)
          ORDER BY m.created_at DESC
          LIMIT LEAST(GREATEST(COALESCE(_announcement_limit, 5), 0), 20)
        ) t
      ),
      '[]'::json
    ),
    'forum_activity',
    COALESCE(
      (
        WITH recent_threads AS (
          SELECT
            t.id,
            t.message_id,
            t.channel_id,
            t.created_at,
            c.name AS channel_name
          FROM public.threads t
          JOIN public.channels c ON c.id = t.channel_id
          WHERE c.server_id = _server_id
            AND c.type = 'forum'
            AND public.can_access_channel(c.id, _user_id)
          ORDER BY t.created_at DESC
          LIMIT 24
        ),
        thread_counts AS (
          SELECT
            tm.thread_id,
            COUNT(*)::integer AS message_count
          FROM public.thread_messages tm
          JOIN recent_threads rt ON rt.id = tm.thread_id
          GROUP BY tm.thread_id
        ),
        last_thread_message AS (
          SELECT DISTINCT ON (tm.thread_id)
            tm.thread_id,
            tm.created_at AS last_activity
          FROM public.thread_messages tm
          JOIN recent_threads rt ON rt.id = tm.thread_id
          ORDER BY tm.thread_id, tm.created_at DESC
        ),
        cards AS (
          SELECT
            rt.id,
            rt.channel_id,
            rt.channel_name,
            rt.created_at,
            m.content,
            GREATEST(COALESCE(tc.message_count, 0) - 1, 0) AS reply_count,
            COALESCE(ltm.last_activity, rt.created_at) AS last_activity
          FROM recent_threads rt
          LEFT JOIN public.messages m ON m.id = rt.message_id
          LEFT JOIN thread_counts tc ON tc.thread_id = rt.id
          LEFT JOIN last_thread_message ltm ON ltm.thread_id = rt.id
        )
        SELECT json_agg(row_to_json(cards) ORDER BY cards.last_activity DESC)
        FROM (
          SELECT *
          FROM cards
          ORDER BY last_activity DESC
          LIMIT LEAST(GREATEST(COALESCE(_forum_limit, 4), 0), 20)
        ) cards
      ),
      '[]'::json
    ),
    'calendar_events',
    COALESCE(
      (
        SELECT json_agg(row_to_json(t) ORDER BY t.starts_at ASC)
        FROM (
          SELECT
            ce.id,
            ce.channel_id,
            ce.title,
            ce.color,
            ce.starts_at,
            ce.ends_at,
            ce.is_all_day,
            ce.allow_rsvps,
            COALESCE(rsvp_counts.going_count, 0) AS rsvp_count,
            viewer.status AS viewer_rsvp_status,
            c.name AS channel_name
          FROM public.calendar_events ce
          JOIN public.channels c ON c.id = ce.channel_id
          LEFT JOIN LATERAL (
            SELECT count(*)::integer AS going_count
            FROM public.calendar_event_rsvps cer
            WHERE cer.event_id = ce.id
              AND cer.status = 'going'
          ) rsvp_counts ON true
          LEFT JOIN public.calendar_event_rsvps viewer
            ON viewer.event_id = ce.id
           AND viewer.user_id = _user_id
          WHERE ce.server_id = _server_id
            AND c.type = 'calendar'
            AND ce.ends_at >= _now
            AND ce.starts_at <= _range_end
            AND public.can_access_channel(ce.channel_id, _user_id)
            AND public.check_user_permission(_user_id, ce.channel_id, 'view_events'::public.permission_type)
          ORDER BY ce.starts_at ASC
          LIMIT LEAST(GREATEST(COALESCE(_calendar_limit, 4), 0), 20)
        ) t
      ),
      '[]'::json
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_server_overview_secure(uuid, uuid, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_server_overview_secure(uuid, uuid, integer, integer, integer) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
