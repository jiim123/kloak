-- Rate limit platform report submissions at the database boundary.
-- The RPCs call the limiter before their upsert so repeated updates to the
-- same report still count. Triggers cover direct REST inserts into report tables.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_report_submission_rate_limit(
  _reporter_id uuid,
  _report_kind text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _scope text;
  _kind text;
BEGIN
  IF _reporter_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  _kind := lower(trim(COALESCE(_report_kind, 'report')));
  IF _kind NOT IN ('message', 'profile', 'server', 'entity') THEN
    _kind := 'report';
  END IF;

  _scope := _reporter_id::text;

  IF NOT public.check_rate_limit(_scope, 'report_submit_burst', 5, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many reports submitted. Please wait a minute.';
  END IF;

  IF NOT public.check_rate_limit(_scope, 'report_submit_hourly', 30, 3600) THEN
    RAISE EXCEPTION 'Rate limited: report submission quota reached. Try again later.';
  END IF;

  IF NOT public.check_rate_limit(_scope, 'report_submit_daily', 100, 86400) THEN
    RAISE EXCEPTION 'Rate limited: daily report submission quota reached.';
  END IF;

  IF NOT public.check_rate_limit(_scope, 'report_submit_' || _kind || '_hourly', 20, 3600) THEN
    RAISE EXCEPTION 'Rate limited: too many reports of this type.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_message_report_insert_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF COALESCE(current_setting('app.report_rate_limit_checked', true), '') <> '1' THEN
    PERFORM public.enforce_report_submission_rate_limit(NEW.reporter_id, 'message');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_entity_report_insert_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF COALESCE(current_setting('app.report_rate_limit_checked', true), '') <> '1' THEN
    PERFORM public.enforce_report_submission_rate_limit(
      NEW.reporter_id,
      CASE
        WHEN NEW.entity_type IN ('profile', 'server') THEN NEW.entity_type
        ELSE 'entity'
      END
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_message_report_insert ON public.message_reports;
CREATE TRIGGER trg_rate_limit_message_report_insert
  BEFORE INSERT ON public.message_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_message_report_insert_rate_limit();

DROP TRIGGER IF EXISTS trg_rate_limit_entity_report_insert ON public.entity_reports;
CREATE TRIGGER trg_rate_limit_entity_report_insert
  BEFORE INSERT ON public.entity_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_entity_report_insert_rate_limit();

DROP POLICY IF EXISTS "Users can create message reports" ON public.message_reports;
DROP POLICY IF EXISTS "Users can create entity reports" ON public.entity_reports;

REVOKE INSERT, UPDATE, DELETE ON public.message_reports FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.entity_reports FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.report_message(
  _message_type text,
  _message_id uuid,
  _reason text,
  _details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _reporter_id uuid;
  _reported_user_id uuid;
  _content text;
  _context jsonb := '{}'::jsonb;
BEGIN
  _reporter_id := public.requesting_user_id();
  IF _reporter_id IS NULL OR NOT public.verify_request_identity(_reporter_id) THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.enforce_report_submission_rate_limit(_reporter_id, 'message');
  PERFORM set_config('app.report_rate_limit_checked', '1', true);

  _message_type := lower(trim(_message_type));
  _reason := left(trim(COALESCE(_reason, '')), 80);
  _details := NULLIF(left(trim(COALESCE(_details, '')), 1000), '');

  IF _message_type NOT IN ('channel', 'dm') THEN
    RAISE EXCEPTION 'Invalid message type';
  END IF;
  IF char_length(_reason) < 2 THEN
    RAISE EXCEPTION 'Report reason is required';
  END IF;

  IF _message_type = 'channel' THEN
    SELECT m.user_id, m.content,
           jsonb_build_object('channel_id', m.channel_id, 'server_id', c.server_id, 'created_at', m.created_at)
      INTO _reported_user_id, _content, _context
    FROM public.messages m
    JOIN public.channels c ON c.id = m.channel_id
    WHERE m.id = _message_id
      AND public.can_access_channel(m.channel_id, _reporter_id);
  ELSE
    SELECT dm.sender_id, dm.content,
           jsonb_build_object('conversation_id', dm.conversation_id, 'created_at', dm.created_at)
      INTO _reported_user_id, _content, _context
    FROM public.direct_messages dm
    WHERE dm.id = _message_id
      AND EXISTS (
        SELECT 1
        FROM public.dm_participants dp
        WHERE dp.conversation_id = dm.conversation_id
          AND dp.user_id = _reporter_id
      );
  END IF;

  IF _reported_user_id IS NULL THEN
    RAISE EXCEPTION 'Message not found or not accessible';
  END IF;
  IF _reported_user_id = _reporter_id THEN
    RAISE EXCEPTION 'You cannot report your own message';
  END IF;

  INSERT INTO public.message_reports (
    message_type,
    message_id,
    reported_user_id,
    reporter_id,
    reason,
    details,
    message_content,
    context
  )
  VALUES (
    _message_type,
    _message_id,
    _reported_user_id,
    _reporter_id,
    _reason,
    _details,
    left(_content, 4000),
    _context
  )
  ON CONFLICT (message_type, message_id, reporter_id)
  WHERE reporter_id IS NOT NULL
  DO UPDATE SET
    reason = EXCLUDED.reason,
    details = EXCLUDED.details,
    status = 'open',
    created_at = now()
  RETURNING jsonb_build_object('id', id, 'status', status) INTO _context;

  RETURN _context;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_profile(
  _reported_user_id uuid,
  _reason text,
  _details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _reporter_id uuid;
  _snapshot jsonb;
BEGIN
  _reporter_id := public.requesting_user_id();
  IF _reporter_id IS NULL OR NOT public.verify_request_identity(_reporter_id) THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.enforce_report_submission_rate_limit(_reporter_id, 'profile');
  PERFORM set_config('app.report_rate_limit_checked', '1', true);

  _reason := left(trim(COALESCE(_reason, '')), 80);
  _details := NULLIF(left(trim(COALESCE(_details, '')), 1000), '');

  IF char_length(_reason) < 2 THEN
    RAISE EXCEPTION 'Report reason is required';
  END IF;
  IF _reported_user_id = _reporter_id THEN
    RAISE EXCEPTION 'You cannot report your own profile';
  END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'bio', left(COALESCE(u.bio, ''), 1000),
    'tagline', left(COALESCE(u.tagline, ''), 200),
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'created_at', u.created_at
  )
  INTO _snapshot
  FROM public.users u
  WHERE u.id = _reported_user_id;

  IF _snapshot IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  INSERT INTO public.entity_reports (
    entity_type,
    entity_id,
    reporter_id,
    reported_user_id,
    reason,
    details,
    snapshot
  )
  VALUES (
    'profile',
    _reported_user_id,
    _reporter_id,
    _reported_user_id,
    _reason,
    _details,
    _snapshot
  )
  ON CONFLICT (entity_type, entity_id, reporter_id)
  WHERE reporter_id IS NOT NULL
  DO UPDATE SET
    reason = EXCLUDED.reason,
    details = EXCLUDED.details,
    snapshot = EXCLUDED.snapshot,
    status = 'open',
    created_at = now()
  RETURNING jsonb_build_object('id', id, 'status', status) INTO _snapshot;

  RETURN _snapshot;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_server(
  _server_id uuid,
  _reason text,
  _details text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _reporter_id uuid;
  _owner_id uuid;
  _snapshot jsonb;
BEGIN
  _reporter_id := public.requesting_user_id();
  IF _reporter_id IS NULL OR NOT public.verify_request_identity(_reporter_id) THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.enforce_report_submission_rate_limit(_reporter_id, 'server');
  PERFORM set_config('app.report_rate_limit_checked', '1', true);

  _reason := left(trim(COALESCE(_reason, '')), 80);
  _details := NULLIF(left(trim(COALESCE(_details, '')), 1000), '');

  IF char_length(_reason) < 2 THEN
    RAISE EXCEPTION 'Report reason is required';
  END IF;

  SELECT s.owner_id,
         jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'owner_id', s.owner_id,
           'about', left(COALESCE(s.about, ''), 1000),
           'is_published', COALESCE(s.is_published, false),
           'is_verified', COALESCE(s.is_verified, false),
           'is_nsfw', COALESCE(s.is_nsfw, false),
           'icon_url', s.icon_url,
           'banner_url', s.banner_url,
           'created_at', s.created_at
         )
  INTO _owner_id, _snapshot
  FROM public.servers s
  WHERE s.id = _server_id;

  IF _snapshot IS NULL THEN
    RAISE EXCEPTION 'Server not found';
  END IF;
  IF _owner_id = _reporter_id THEN
    RAISE EXCEPTION 'You cannot report your own server';
  END IF;

  INSERT INTO public.entity_reports (
    entity_type,
    entity_id,
    reporter_id,
    reported_user_id,
    reported_server_id,
    reason,
    details,
    snapshot
  )
  VALUES (
    'server',
    _server_id,
    _reporter_id,
    _owner_id,
    _server_id,
    _reason,
    _details,
    _snapshot
  )
  ON CONFLICT (entity_type, entity_id, reporter_id)
  WHERE reporter_id IS NOT NULL
  DO UPDATE SET
    reason = EXCLUDED.reason,
    details = EXCLUDED.details,
    snapshot = EXCLUDED.snapshot,
    status = 'open',
    created_at = now()
  RETURNING jsonb_build_object('id', id, 'status', status) INTO _snapshot;

  RETURN _snapshot;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_report_submission_rate_limit(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_message_report_insert_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_entity_report_insert_rate_limit() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enforce_report_submission_rate_limit(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_message_report_insert_rate_limit() TO service_role;
GRANT EXECUTE ON FUNCTION public.enforce_entity_report_insert_rate_limit() TO service_role;

REVOKE EXECUTE ON FUNCTION public.report_message(text, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_profile(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_server(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_message(text, uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_profile(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_server(uuid, text, text) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END;
$$;

COMMIT;




