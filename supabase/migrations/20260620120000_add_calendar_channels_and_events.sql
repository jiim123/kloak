ALTER TYPE public.channel_type ADD VALUE IF NOT EXISTS 'calendar';

ALTER TABLE public.servers
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

UPDATE public.servers
SET timezone = 'UTC'
WHERE timezone IS NULL OR timezone = '';

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  server_id uuid NOT NULL REFERENCES public.servers(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  color text NOT NULL DEFAULT '#0ea5e9',
  description text,
  location text,
  url text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  is_all_day boolean NOT NULL DEFAULT false,
  recurrence text NOT NULL DEFAULT 'once',
  allow_rsvps boolean NOT NULL DEFAULT true,
  limit_attendance boolean NOT NULL DEFAULT false,
  attendance_limit integer,
  restrict_roles boolean NOT NULL DEFAULT false,
  allowed_role_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_events_title_length CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
  CONSTRAINT calendar_events_color_valid CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  CONSTRAINT calendar_events_time_order CHECK (ends_at > starts_at),
  CONSTRAINT calendar_events_recurrence_valid CHECK (recurrence IN ('once', 'daily', 'weekly', 'monthly')),
  CONSTRAINT calendar_events_attendance_limit_valid CHECK (attendance_limit IS NULL OR attendance_limit > 0)
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_channel_starts_at
  ON public.calendar_events(channel_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_server_starts_at
  ON public.calendar_events(server_id, starts_at);

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT '#0ea5e9';

CREATE TABLE IF NOT EXISTS public.calendar_event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'going',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_event_rsvps_status_valid CHECK (status IN ('going')),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_rsvps_event_id
  ON public.calendar_event_rsvps(event_id);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Calendar events viewable by channel members" ON public.calendar_events;
CREATE POLICY "Calendar events viewable by channel members"
  ON public.calendar_events
  FOR SELECT
  USING (public.can_access_channel(channel_id, (SELECT public.requesting_user_id())));

DROP POLICY IF EXISTS "Calendar RSVPs viewable by channel members" ON public.calendar_event_rsvps;
CREATE POLICY "Calendar RSVPs viewable by channel members"
  ON public.calendar_event_rsvps
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.calendar_events ce
      WHERE ce.id = calendar_event_rsvps.event_id
        AND public.can_access_channel(ce.channel_id, (SELECT public.requesting_user_id()))
    )
  );

CREATE OR REPLACE FUNCTION public.get_user_servers(_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NOT verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
    FROM (
      SELECT
        s.id,
        s.name,
        s.owner_id,
        s.invite_code,
        s.icon_url,
        s.banner_url,
        s.is_published,
        s.is_verified,
        s.is_nsfw,
        s.about,
        s.timezone,
        s.system_channel_join_id,
        s.system_channel_leave_id,
        s.enable_join_messages,
        s.enable_leave_messages,
        s.min_account_age_days,
        s.created_at,
        sm.role,
        sm.nickname,
        sm.joined_at,
        sm.is_muted,
        sm.position
      FROM public.servers s
      INNER JOIN public.server_members sm ON sm.server_id = s.id
      WHERE sm.user_id = _user_id
        AND (sm.is_banned IS NULL OR sm.is_banned = false)
      ORDER BY sm.position ASC NULLS LAST, s.name ASC
    ) t
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_server(_server_id uuid, _user_id uuid, _updates jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_owner boolean := false;
  _user_role public.server_role;
  _updated_server public.servers%ROWTYPE;
  _headers json;
  _request_host text;
  _legacy_server_media_prefix text;
  _bunny_server_media_prefix text := 'https://kloakcdn.b-cdn.net/server-icons/';
  _allowed_fields text[] := ARRAY[
    'name',
    'icon_url',
    'banner_url',
    'is_published',
    'is_nsfw',
    'about',
    'timezone',
    'min_account_age_days',
    'system_channel_join_id',
    'system_channel_leave_id',
    'enable_join_messages',
    'enable_leave_messages'
  ];
  _field text;
  _v_name text;
  _v_about text;
  _v_icon_url text;
  _v_banner_url text;
  _v_timezone text;
  _v_system_channel_join_id uuid;
  _v_system_channel_leave_id uuid;
  _v_enable_join_messages boolean;
  _v_enable_leave_messages boolean;
  _v_min_account_age_days integer;
  _publication_eligibility json;
  _can_publish boolean := false;
BEGIN
  IF NOT public.verify_request_identity(_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF _updates IS NULL OR jsonb_typeof(_updates) <> 'object' THEN
    RETURN json_build_object('success', false, 'error', 'Invalid updates payload');
  END IF;

  FOR _field IN SELECT jsonb_object_keys(_updates)
  LOOP
    IF NOT (_field = ANY (_allowed_fields)) THEN
      RETURN json_build_object('success', false, 'error', format('Unsupported server field: %s', _field));
    END IF;
  END LOOP;

  SELECT (s.owner_id = _user_id)
    INTO _is_owner
  FROM public.servers s
  WHERE s.id = _server_id;

  IF _is_owner IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  SELECT sm.role INTO _user_role
  FROM public.server_members sm
  WHERE sm.server_id = _server_id
    AND sm.user_id = _user_id
    AND sm.is_banned = false;

  IF NOT _is_owner THEN
    IF _user_role IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Not a member of this server');
    END IF;

    IF _user_role <> 'admin' THEN
      RETURN json_build_object('success', false, 'error', 'Insufficient permissions');
    END IF;
  END IF;

  IF (_updates ? 'is_published') AND ((_updates->>'is_published')::boolean = true) THEN
    SELECT public.get_server_publication_eligibility(_server_id, _user_id)
      INTO _publication_eligibility;

    _can_publish := COALESCE((_publication_eligibility->>'eligible')::boolean, false);

    IF NOT _can_publish THEN
      RETURN json_build_object('success', false, 'error', 'Server does not meet public server requirements', 'publication_eligibility', _publication_eligibility);
    END IF;
  END IF;

  _v_name := NULLIF(trim(_updates->>'name'), '');
  _v_about := NULLIF(trim(_updates->>'about'), '');
  _v_icon_url := NULLIF(trim(_updates->>'icon_url'), '');
  _v_banner_url := NULLIF(trim(_updates->>'banner_url'), '');
  _v_timezone := COALESCE(NULLIF(trim(_updates->>'timezone'), ''), 'UTC');

  IF (_updates ? 'name') THEN
    IF _v_name IS NULL THEN
      RETURN json_build_object('success', false, 'error', 'Server name cannot be empty');
    END IF;
    IF char_length(_v_name) > 50 THEN
      RETURN json_build_object('success', false, 'error', 'Server name must be 50 characters or fewer');
    END IF;
  END IF;

  IF (_updates ? 'about') AND _v_about IS NOT NULL AND char_length(_v_about) > 500 THEN
    RETURN json_build_object('success', false, 'error', 'About server must be 500 characters or fewer');
  END IF;

  IF (_updates ? 'timezone') AND NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = _v_timezone) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid timezone');
  END IF;

  BEGIN
    _headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN OTHERS THEN
    _headers := '{}'::json;
  END;

  _request_host := lower(split_part(COALESCE(NULLIF(trim(_headers->>'x-forwarded-host'), ''), NULLIF(trim(_headers->>'host'), '')), ':', 1));

  IF _request_host IS NULL OR _request_host = '' THEN
    RETURN json_build_object('success', false, 'error', 'Unable to validate media URL host');
  END IF;

  _legacy_server_media_prefix := 'https://' || _request_host || '/storage/v1/object/public/server-icons/';

  IF (_updates ? 'icon_url') AND _v_icon_url IS NOT NULL THEN
    IF char_length(_v_icon_url) > 2048 OR _v_icon_url !~* '^https?://[^[:space:]]+$' OR _v_icon_url !~ '^[ -~]+$' THEN
      RETURN json_build_object('success', false, 'error', 'Server icon URL is invalid');
    END IF;
    IF strpos(lower(_v_icon_url), _legacy_server_media_prefix) <> 1
       AND strpos(lower(_v_icon_url), _bunny_server_media_prefix) <> 1 THEN
      RETURN json_build_object('success', false, 'error', 'Server icon URL must be from this project''s server-icons bucket');
    END IF;
  END IF;

  IF (_updates ? 'banner_url') AND _v_banner_url IS NOT NULL AND _v_banner_url <> '/default_server_banner.png' THEN
    IF char_length(_v_banner_url) > 2048 OR _v_banner_url !~* '^https?://[^[:space:]]+$' OR _v_banner_url !~ '^[ -~]+$' THEN
      RETURN json_build_object('success', false, 'error', 'Server banner URL is invalid');
    END IF;
    IF strpos(lower(_v_banner_url), _legacy_server_media_prefix) <> 1
       AND strpos(lower(_v_banner_url), _bunny_server_media_prefix) <> 1 THEN
      RETURN json_build_object('success', false, 'error', 'Server banner URL must be from this project''s server-icons bucket');
    END IF;
  END IF;

  IF (_updates ? 'system_channel_join_id') THEN
    IF _updates->'system_channel_join_id' IS NULL OR _updates->>'system_channel_join_id' IN ('', 'null', 'none') THEN
      _v_system_channel_join_id := NULL;
    ELSIF (_updates->>'system_channel_join_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN json_build_object('success', false, 'error', 'Join message channel ID is invalid');
    ELSE
      _v_system_channel_join_id := (_updates->>'system_channel_join_id')::uuid;
    END IF;
  END IF;

  IF (_updates ? 'system_channel_leave_id') THEN
    IF _updates->'system_channel_leave_id' IS NULL OR _updates->>'system_channel_leave_id' IN ('', 'null', 'none') THEN
      _v_system_channel_leave_id := NULL;
    ELSIF (_updates->>'system_channel_leave_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
      RETURN json_build_object('success', false, 'error', 'Leave message channel ID is invalid');
    ELSE
      _v_system_channel_leave_id := (_updates->>'system_channel_leave_id')::uuid;
    END IF;
  END IF;

  IF (_updates ? 'system_channel_join_id') AND _v_system_channel_join_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.channels c WHERE c.id = _v_system_channel_join_id AND c.server_id = _server_id AND c.type IN ('text', 'announcement', 'forum', 'media')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Join message channel must belong to this server');
  END IF;

  IF (_updates ? 'system_channel_leave_id') AND _v_system_channel_leave_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.channels c WHERE c.id = _v_system_channel_leave_id AND c.server_id = _server_id AND c.type IN ('text', 'announcement', 'forum', 'media')
  ) THEN
    RETURN json_build_object('success', false, 'error', 'Leave message channel must belong to this server');
  END IF;

  _v_enable_join_messages := CASE WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean ELSE NULL END;
  _v_enable_leave_messages := CASE WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean ELSE NULL END;

  _v_min_account_age_days := NULL;
  IF (_updates ? 'min_account_age_days') THEN
    IF _updates->'min_account_age_days' IS NULL OR _updates->>'min_account_age_days' IN ('', 'null', 'none') THEN
      _v_min_account_age_days := 0;
    ELSIF (_updates->>'min_account_age_days') !~ '^[0-9]+$' THEN
      RETURN json_build_object('success', false, 'error', 'Minimum account age must be a non-negative integer');
    ELSE
      _v_min_account_age_days := (_updates->>'min_account_age_days')::integer;
    END IF;

    IF _v_min_account_age_days < 0 OR _v_min_account_age_days > 36500 THEN
      RETURN json_build_object('success', false, 'error', 'Minimum account age must be between 0 and 36500 days');
    END IF;
  END IF;

  IF COALESCE(_v_enable_join_messages, false) AND COALESCE(_v_system_channel_join_id, (SELECT s.system_channel_join_id FROM public.servers s WHERE s.id = _server_id)) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Join messages require a system channel');
  END IF;

  IF COALESCE(_v_enable_leave_messages, false) AND COALESCE(_v_system_channel_leave_id, (SELECT s.system_channel_leave_id FROM public.servers s WHERE s.id = _server_id)) IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Leave messages require a system channel');
  END IF;

  UPDATE public.servers
  SET
    name = CASE WHEN _updates ? 'name' THEN _v_name ELSE name END,
    icon_url = CASE WHEN _updates ? 'icon_url' THEN _v_icon_url ELSE icon_url END,
    banner_url = CASE WHEN _updates ? 'banner_url' THEN _v_banner_url ELSE banner_url END,
    about = CASE WHEN _updates ? 'about' THEN _v_about ELSE about END,
    timezone = CASE WHEN _updates ? 'timezone' THEN _v_timezone ELSE timezone END,
    is_published = CASE WHEN _updates ? 'is_published' THEN (_updates->>'is_published')::boolean ELSE is_published END,
    is_nsfw = CASE WHEN _updates ? 'is_nsfw' THEN (_updates->>'is_nsfw')::boolean ELSE is_nsfw END,
    min_account_age_days = CASE WHEN _updates ? 'min_account_age_days' THEN _v_min_account_age_days ELSE min_account_age_days END,
    system_channel_join_id = CASE WHEN _updates ? 'system_channel_join_id' THEN _v_system_channel_join_id ELSE system_channel_join_id END,
    system_channel_leave_id = CASE WHEN _updates ? 'system_channel_leave_id' THEN _v_system_channel_leave_id ELSE system_channel_leave_id END,
    enable_join_messages = CASE WHEN _updates ? 'enable_join_messages' THEN (_updates->>'enable_join_messages')::boolean ELSE enable_join_messages END,
    enable_leave_messages = CASE WHEN _updates ? 'enable_leave_messages' THEN (_updates->>'enable_leave_messages')::boolean ELSE enable_leave_messages END
  WHERE id = _server_id
  RETURNING * INTO _updated_server;

  IF _updated_server.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Server not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'server', json_build_object(
      'id', _updated_server.id,
      'name', _updated_server.name,
      'icon_url', _updated_server.icon_url,
      'banner_url', _updated_server.banner_url,
      'about', _updated_server.about,
      'timezone', _updated_server.timezone,
      'is_published', _updated_server.is_published,
      'is_nsfw', _updated_server.is_nsfw,
      'min_account_age_days', _updated_server.min_account_age_days,
      'owner_id', _updated_server.owner_id,
      'created_at', _updated_server.created_at,
      'system_channel_join_id', _updated_server.system_channel_join_id,
      'system_channel_leave_id', _updated_server.system_channel_leave_id,
      'enable_join_messages', _updated_server.enable_join_messages,
      'enable_leave_messages', _updated_server.enable_leave_messages
    )
  );
END;
$function$;

DROP FUNCTION IF EXISTS public.create_calendar_event(uuid, uuid, uuid, text, text, text, text, timestamptz, timestamptz, text, boolean, text, boolean, boolean, integer, boolean, uuid[]);

CREATE OR REPLACE FUNCTION public.create_calendar_event(
  _channel_id uuid,
  _server_id uuid,
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

  IF NOT public.is_server_member(_server_id, _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Not a member of this server');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.channels c WHERE c.id = _channel_id AND c.server_id = _server_id AND c.type = 'calendar') THEN
    RETURN json_build_object('success', false, 'error', 'Calendar channel not found');
  END IF;

  IF NOT public.can_access_channel(_channel_id, _user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot access this channel');
  END IF;

  IF NOT public.check_user_permission(_user_id, _channel_id, 'send_messages'::public.permission_type) THEN
    RETURN json_build_object('success', false, 'error', 'Missing permission to create events');
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

  IF NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = COALESCE(NULLIF(_timezone, ''), 'UTC')) THEN
    RETURN json_build_object('success', false, 'error', 'Invalid timezone');
  END IF;

  INSERT INTO public.calendar_events (
    channel_id,
    server_id,
    created_by,
    title,
    color,
    description,
    location,
    url,
    starts_at,
    ends_at,
    timezone,
    is_all_day,
    recurrence,
    allow_rsvps,
    limit_attendance,
    attendance_limit,
    restrict_roles,
    allowed_role_ids
  )
  VALUES (
    _channel_id,
    _server_id,
    _user_id,
    trim(_title),
    COALESCE(_color, '#0ea5e9'),
    NULLIF(trim(COALESCE(_description, '')), ''),
    NULLIF(trim(COALESCE(_location, '')), ''),
    NULLIF(trim(COALESCE(_url, '')), ''),
    _starts_at,
    _ends_at,
    COALESCE(NULLIF(_timezone, ''), 'UTC'),
    COALESCE(_is_all_day, false),
    COALESCE(_recurrence, 'once'),
    COALESCE(_allow_rsvps, true),
    COALESCE(_allow_rsvps, true) AND COALESCE(_limit_attendance, false),
    CASE WHEN COALESCE(_allow_rsvps, true) AND COALESCE(_limit_attendance, false) THEN _attendance_limit ELSE NULL END,
    COALESCE(_allow_rsvps, true) AND COALESCE(_restrict_roles, false),
    CASE WHEN COALESCE(_allow_rsvps, true) AND COALESCE(_restrict_roles, false) THEN COALESCE(_allowed_role_ids, '{}') ELSE '{}' END
  )
  RETURNING * INTO _event;

  RETURN json_build_object('success', true, 'event', row_to_json(_event));
END;
$function$;

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
        COALESCE(rsvp_counts.count, 0) AS rsvp_count,
        viewer.status AS viewer_rsvp_status
      FROM public.calendar_events ce
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS count
        FROM public.calendar_event_rsvps cer
        WHERE cer.event_id = ce.id
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

  IF COALESCE(_status, 'none') = 'none' THEN
    DELETE FROM public.calendar_event_rsvps WHERE event_id = _event_id AND user_id = _user_id;
    RETURN json_build_object('success', true);
  END IF;

  IF _status <> 'going' THEN
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

  IF _event.limit_attendance AND _event.attendance_limit IS NOT NULL THEN
    SELECT count(*)::integer INTO _current_count
    FROM public.calendar_event_rsvps cer
    WHERE cer.event_id = _event_id
      AND cer.user_id <> _user_id;

    IF _current_count >= _event.attendance_limit THEN
      RETURN json_build_object('success', false, 'error', 'This event is full');
    END IF;
  END IF;

  INSERT INTO public.calendar_event_rsvps (event_id, user_id, status)
  VALUES (_event_id, _user_id, 'going')
  ON CONFLICT (event_id, user_id)
  DO UPDATE SET status = EXCLUDED.status, updated_at = now();

  RETURN json_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_calendar_event(uuid, uuid, uuid, text, text, text, text, text, timestamptz, timestamptz, text, boolean, text, boolean, boolean, integer, boolean, uuid[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_calendar_events(uuid, uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_calendar_event_rsvp(uuid, uuid, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_calendar_event(uuid, uuid, uuid, text, text, text, text, text, timestamptz, timestamptz, text, boolean, text, boolean, boolean, integer, boolean, uuid[]) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_calendar_events(uuid, uuid, timestamptz, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_calendar_event_rsvp(uuid, uuid, text) TO anon, authenticated, service_role;
