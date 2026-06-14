-- Profile and server reports.

CREATE TABLE IF NOT EXISTS public.entity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('profile', 'server')),
  entity_id uuid NOT NULL,
  reporter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reported_server_id uuid REFERENCES public.servers(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 80),
  details text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entity_reports_details_len CHECK (details IS NULL OR char_length(details) <= 1000),
  CONSTRAINT entity_reports_resolution_note_len CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000),
  CONSTRAINT entity_reports_profile_target CHECK (
    (entity_type = 'profile' AND reported_user_id IS NOT NULL AND reported_server_id IS NULL)
    OR (entity_type = 'server' AND reported_server_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_entity_reports_status_created
  ON public.entity_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entity_reports_reported_user
  ON public.entity_reports (reported_user_id, created_at DESC)
  WHERE reported_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entity_reports_reported_server
  ON public.entity_reports (reported_server_id, created_at DESC)
  WHERE reported_server_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_reports_unique_reporter_entity
  ON public.entity_reports (entity_type, entity_id, reporter_id)
  WHERE reporter_id IS NOT NULL;

ALTER TABLE public.entity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_reports FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_reports'
      AND policyname = 'Users can create entity reports'
  ) THEN
    CREATE POLICY "Users can create entity reports"
      ON public.entity_reports
      FOR INSERT
      WITH CHECK (reporter_id = public.requesting_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'entity_reports'
      AND policyname = 'Platform admins can read entity reports'
  ) THEN
    CREATE POLICY "Platform admins can read entity reports"
      ON public.entity_reports
      FOR SELECT
      USING (public.is_platform_admin(public.requesting_user_id()));
  END IF;
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

CREATE OR REPLACE FUNCTION public.get_admin_entity_reports(_admin_user_id uuid, _status text DEFAULT 'open')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NOT public.is_platform_admin(_admin_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'entity_type', r.entity_type,
          'entity_id', r.entity_id,
          'reason', r.reason,
          'details', r.details,
          'snapshot', r.snapshot,
          'status', r.status,
          'resolution_note', r.resolution_note,
          'created_at', r.created_at,
          'reviewed_at', r.reviewed_at,
          'reported_user', CASE WHEN reported.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', reported.id,
            'username', reported.username,
            'display_name', reported.display_name,
            'avatar_url', reported.avatar_url
          ) END,
          'reported_server', CASE WHEN server.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', server.id,
            'name', server.name,
            'icon_url', server.icon_url,
            'owner_id', server.owner_id
          ) END,
          'reporter', CASE WHEN reporter.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', reporter.id,
            'username', reporter.username,
            'display_name', reporter.display_name,
            'avatar_url', reporter.avatar_url
          ) END,
          'reviewer', CASE WHEN reviewer.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', reviewer.id,
            'username', reviewer.username,
            'display_name', reviewer.display_name
          ) END
        )
        ORDER BY r.created_at DESC
      )
      FROM public.entity_reports r
      LEFT JOIN public.users reported ON reported.id = r.reported_user_id
      LEFT JOIN public.servers server ON server.id = r.reported_server_id
      LEFT JOIN public.users reporter ON reporter.id = r.reporter_id
      LEFT JOIN public.users reviewer ON reviewer.id = r.reviewed_by
      WHERE (_status IS NULL OR _status = 'all' OR r.status = _status)
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.report_profile(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.report_server(uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_entity_reports(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_profile(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_server(uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_entity_reports(uuid, text) TO anon, authenticated, service_role;
