ALTER TABLE public.calendar_event_rsvps
  DROP CONSTRAINT IF EXISTS calendar_event_rsvps_status_valid;

ALTER TABLE public.calendar_event_rsvps
  ADD CONSTRAINT calendar_event_rsvps_status_valid
  CHECK (status IN ('going', 'maybe', 'declined'));

CREATE OR REPLACE FUNCTION public.get_calendar_events(
  _channel_id uuid,
  _user_id uuid,
  _starts_after timestamptz DEFAULT NULL,
  _starts_before timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF NOT public.can_access_channel(_channel_id, _user_id) THEN
    RAISE EXCEPTION 'Cannot access this channel';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.starts_at), '[]'::json)
    FROM (
      SELECT
        ce.*,
        COALESCE(rsvp_counts.going_count, 0) AS rsvp_count,
        viewer.status AS viewer_rsvp_status
      FROM public.calendar_events ce
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS going_count
        FROM public.calendar_event_rsvps cer
        WHERE cer.event_id = ce.id
          AND cer.status = 'going'
      ) rsvp_counts ON true
      LEFT JOIN public.calendar_event_rsvps viewer
        ON viewer.event_id = ce.id
       AND viewer.user_id = _user_id
      WHERE ce.channel_id = _channel_id
        AND (_starts_after IS NULL OR ce.ends_at >= _starts_after)
        AND (_starts_before IS NULL OR ce.starts_at <= _starts_before)
      ORDER BY ce.starts_at ASC
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_calendar_event_rsvp(_event_id uuid, _user_id uuid, _status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _event public.calendar_events%ROWTYPE;
  _member_id uuid;
  _current_count integer;
  _normalized_status text;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO _event
  FROM public.calendar_events ce
  WHERE ce.id = _event_id;

  IF _event.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF NOT _event.allow_rsvps THEN
    RETURN json_build_object('success', false, 'error', 'RSVPs are disabled for this event');
  END IF;

  IF NOT public.can_access_channel(_event.channel_id, _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot access this event');
  END IF;

  _normalized_status := lower(COALESCE(trim(_status), 'none'));

  IF _normalized_status = 'none' THEN
    DELETE FROM public.calendar_event_rsvps WHERE event_id = _event_id AND user_id = _user_id;
    RETURN json_build_object('success', true);
  END IF;

  IF _normalized_status NOT IN ('going', 'maybe', 'declined') THEN
    RETURN json_build_object('success', false, 'error', 'Unsupported RSVP status');
  END IF;

  SELECT sm.id INTO _member_id
  FROM public.server_members sm
  WHERE sm.server_id = _event.server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF _member_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not a member of this server');
  END IF;

  IF _event.restrict_roles AND cardinality(_event.allowed_role_ids) > 0 AND NOT EXISTS (
    SELECT 1
    FROM public.server_member_roles smr
    WHERE smr.member_id = _member_id
      AND smr.role_id = ANY (_event.allowed_role_ids)
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Your role cannot RSVP to this event');
  END IF;

  IF _normalized_status = 'going' AND _event.limit_attendance AND _event.attendance_limit IS NOT NULL THEN
    SELECT count(*)::integer INTO _current_count
    FROM public.calendar_event_rsvps cer
    WHERE cer.event_id = _event_id
      AND cer.user_id <> _user_id
      AND cer.status = 'going';

    IF _current_count >= _event.attendance_limit THEN
      RETURN json_build_object('success', false, 'error', 'This event is full');
    END IF;
  END IF;

  INSERT INTO public.calendar_event_rsvps (event_id, user_id, status)
  VALUES (_event_id, _user_id, _normalized_status)
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status, updated_at = now();

  RETURN json_build_object('success', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_calendar_event_details(_event_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN (
    SELECT row_to_json(t)
    FROM (
      SELECT
        ce.*,
        COALESCE(rsvp_counts.going_count, 0) AS going_count,
        COALESCE(rsvp_counts.maybe_count, 0) AS maybe_count,
        COALESCE(rsvp_counts.declined_count, 0) AS declined_count,
        viewer.status AS viewer_rsvp_status,
        (ce.created_by = _user_id OR public.check_user_permission(_user_id, ce.channel_id, 'manage_messages'::public.permission_type)) AS viewer_can_manage,
        json_build_object(
          'id', creator.id,
          'username', creator.username,
          'display_name', creator.display_name,
          'avatar_url', creator.avatar_url,
          'banner_color', creator.banner_color
        ) AS creator,
        COALESCE(going_attendees.users, '[]'::json) AS attendees,
        COALESCE(maybe_attendees.users, '[]'::json) AS maybe_attendees,
        COALESCE(declined_attendees.users, '[]'::json) AS declined_attendees,
        COALESCE(comment_counts.comment_count, 0) AS comment_count
      FROM public.calendar_events ce
      JOIN public.users creator ON creator.id = ce.created_by
      LEFT JOIN LATERAL (
        SELECT
          count(*) FILTER (WHERE cer.status = 'going')::integer AS going_count,
          count(*) FILTER (WHERE cer.status = 'maybe')::integer AS maybe_count,
          count(*) FILTER (WHERE cer.status = 'declined')::integer AS declined_count
        FROM public.calendar_event_rsvps cer
        WHERE cer.event_id = ce.id
      ) rsvp_counts ON true
      LEFT JOIN public.calendar_event_rsvps viewer
        ON viewer.event_id = ce.id
       AND viewer.user_id = _user_id
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color
          )
          ORDER BY cer.created_at ASC
        ) AS users
        FROM public.calendar_event_rsvps cer
        JOIN public.users u ON u.id = cer.user_id
        WHERE cer.event_id = ce.id
          AND cer.status = 'going'
      ) going_attendees ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color
          )
          ORDER BY cer.created_at ASC
        ) AS users
        FROM public.calendar_event_rsvps cer
        JOIN public.users u ON u.id = cer.user_id
        WHERE cer.event_id = ce.id
          AND cer.status = 'maybe'
      ) maybe_attendees ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'id', u.id,
            'username', u.username,
            'display_name', u.display_name,
            'avatar_url', u.avatar_url,
            'banner_color', u.banner_color
          )
          ORDER BY cer.created_at ASC
        ) AS users
        FROM public.calendar_event_rsvps cer
        JOIN public.users u ON u.id = cer.user_id
        WHERE cer.event_id = ce.id
          AND cer.status = 'declined'
      ) declined_attendees ON true
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS comment_count
        FROM public.calendar_event_comments cec
        WHERE cec.event_id = ce.id
      ) comment_counts ON true
      WHERE ce.id = _event_id
        AND public.can_access_channel(ce.channel_id, _user_id)
    ) t
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_calendar_event(
  _event_id uuid,
  _user_id uuid,
  _title text,
  _color text DEFAULT '#0ea5e9',
  _description text DEFAULT NULL,
  _location text DEFAULT NULL,
  _url text DEFAULT NULL,
  _starts_at timestamptz DEFAULT NULL,
  _ends_at timestamptz DEFAULT NULL,
  _timezone text DEFAULT 'UTC',
  _is_all_day boolean DEFAULT false,
  _recurrence text DEFAULT 'once',
  _allow_rsvps boolean DEFAULT true,
  _limit_attendance boolean DEFAULT false,
  _attendance_limit integer DEFAULT NULL,
  _restrict_roles boolean DEFAULT false,
  _allowed_role_ids uuid[] DEFAULT '{}'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _event public.calendar_events%ROWTYPE;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO _event
  FROM public.calendar_events
  WHERE id = _event_id;

  IF _event.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF NOT public.can_access_channel(_event.channel_id, _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot access this event');
  END IF;

  IF _event.created_by <> _user_id
     AND NOT public.check_user_permission(_user_id, _event.channel_id, 'manage_messages'::public.permission_type) THEN
    RETURN json_build_object('success', false, 'error', 'Missing permission to edit this event');
  END IF;

  IF _starts_at IS NULL OR _ends_at IS NULL OR _ends_at <= _starts_at THEN
    RETURN json_build_object('success', false, 'error', 'Invalid event time');
  END IF;

  IF trim(COALESCE(_title, '')) = '' OR char_length(trim(_title)) > 120 THEN
    RETURN json_build_object('success', false, 'error', 'Event name must be 1-120 characters');
  END IF;

  IF COALESCE(_color, '#0ea5e9') !~ '^#[0-9a-fA-F]{6}$' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid event color');
  END IF;

  IF COALESCE(_recurrence, 'once') NOT IN ('once', 'daily', 'weekly', 'monthly') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid recurrence');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = COALESCE(NULLIF(_timezone, ''), 'UTC')) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid timezone');
  END IF;

  UPDATE public.calendar_events
  SET
    title = trim(_title),
    color = COALESCE(_color, '#0ea5e9'),
    description = NULLIF(trim(COALESCE(_description, '')), ''),
    location = NULLIF(trim(COALESCE(_location, '')), ''),
    url = NULLIF(trim(COALESCE(_url, '')), ''),
    starts_at = _starts_at,
    ends_at = _ends_at,
    timezone = COALESCE(NULLIF(_timezone, ''), 'UTC'),
    is_all_day = COALESCE(_is_all_day, false),
    recurrence = COALESCE(_recurrence, 'once'),
    allow_rsvps = COALESCE(_allow_rsvps, true),
    limit_attendance = COALESCE(_allow_rsvps, true) AND COALESCE(_limit_attendance, false),
    attendance_limit = CASE
      WHEN COALESCE(_allow_rsvps, true) AND COALESCE(_limit_attendance, false) THEN _attendance_limit
      ELSE NULL
    END,
    restrict_roles = COALESCE(_allow_rsvps, true) AND COALESCE(_restrict_roles, false),
    allowed_role_ids = CASE
      WHEN COALESCE(_allow_rsvps, true) AND COALESCE(_restrict_roles, false) THEN COALESCE(_allowed_role_ids, '{}')
      ELSE '{}'
    END,
    updated_at = now()
  WHERE id = _event_id
  RETURNING * INTO _event;

  RETURN json_build_object('success', true, 'event', row_to_json(_event));
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_calendar_event(_event_id uuid, _user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _event public.calendar_events%ROWTYPE;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO _event
  FROM public.calendar_events
  WHERE id = _event_id;

  IF _event.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Event not found');
  END IF;

  IF NOT public.can_access_channel(_event.channel_id, _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot access this event');
  END IF;

  IF _event.created_by <> _user_id
     AND NOT public.check_user_permission(_user_id, _event.channel_id, 'manage_messages'::public.permission_type) THEN
    RETURN json_build_object('success', false, 'error', 'Missing permission to delete this event');
  END IF;

  DELETE FROM public.calendar_events
  WHERE id = _event_id;

  RETURN json_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.update_calendar_event(uuid, uuid, text, text, text, text, text, timestamptz, timestamptz, text, boolean, text, boolean, boolean, integer, boolean, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_calendar_event(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.update_calendar_event(uuid, uuid, text, text, text, text, text, timestamptz, timestamptz, text, boolean, text, boolean, boolean, integer, boolean, uuid[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_calendar_event(uuid, uuid) TO anon, authenticated, service_role;
