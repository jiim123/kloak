-- Platform admin reports and punishments.
-- Keep this allowlist in sync with src/lib/adminAccess.ts until admin roles move into the database.

CREATE TABLE IF NOT EXISTS public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_type text NOT NULL CHECK (message_type IN ('channel', 'dm')),
  message_id uuid NOT NULL,
  reported_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 80),
  details text,
  message_content text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  reviewed_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT message_reports_details_len CHECK (details IS NULL OR char_length(details) <= 1000),
  CONSTRAINT message_reports_resolution_note_len CHECK (resolution_note IS NULL OR char_length(resolution_note) <= 1000)
);

CREATE INDEX IF NOT EXISTS idx_message_reports_status_created
  ON public.message_reports (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_reports_reported_user
  ON public.message_reports (reported_user_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reports_unique_reporter_message
  ON public.message_reports (message_type, message_id, reporter_id)
  WHERE reporter_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_punishments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action_type text NOT NULL CHECK (action_type IN ('warn', 'restrict_messages', 'suspend', 'ban')),
  reason text NOT NULL,
  details text,
  report_id uuid REFERENCES public.message_reports(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  acknowledged_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_punishments_details_len CHECK (details IS NULL OR char_length(details) <= 1000),
  CONSTRAINT user_punishments_expiry_valid CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_user_punishments_active
  ON public.user_punishments (user_id, action_type, starts_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.user_punishments
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

CREATE TABLE IF NOT EXISTS public.admin_moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  target_user_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  report_id uuid REFERENCES public.message_reports(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_moderation_actions_report
  ON public.admin_moderation_actions (report_id, created_at DESC);

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_punishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_punishments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.admin_moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_moderation_actions FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.platform_admin_usernames()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT ARRAY[
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.platform_admin_user_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT ARRAY[
    'c3108f3f-d4ca-49c5-9dbf-bd83f9316db6'::uuid
  ]::uuid[];
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _username text;
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RETURN false;
  END IF;

  SELECT lower(username) INTO _username
  FROM public.users
  WHERE id = _user_id;

  RETURN _user_id = ANY(public.platform_admin_user_ids())
    OR _username = ANY(public.platform_admin_usernames());
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_reports'
      AND policyname = 'Users can create message reports'
  ) THEN
    CREATE POLICY "Users can create message reports"
      ON public.message_reports
      FOR INSERT
      WITH CHECK (reporter_id = public.requesting_user_id());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'message_reports'
      AND policyname = 'Platform admins can read reports'
  ) THEN
    CREATE POLICY "Platform admins can read reports"
      ON public.message_reports
      FOR SELECT
      USING (public.is_platform_admin(public.requesting_user_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_punishments'
      AND policyname = 'Platform admins can read punishments'
  ) THEN
    CREATE POLICY "Platform admins can read punishments"
      ON public.user_punishments
      FOR SELECT
      USING (public.is_platform_admin(public.requesting_user_id()));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'admin_moderation_actions'
      AND policyname = 'Platform admins can read moderation actions'
  ) THEN
    CREATE POLICY "Platform admins can read moderation actions"
      ON public.admin_moderation_actions
      FOR SELECT
      USING (public.is_platform_admin(public.requesting_user_id()));
  END IF;
END;
$$;

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

CREATE OR REPLACE FUNCTION public.get_admin_message_reports(_admin_user_id uuid, _status text DEFAULT 'open')
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
          'message_type', r.message_type,
          'message_id', r.message_id,
          'reason', r.reason,
          'details', r.details,
          'message_content', r.message_content,
          'context', r.context,
          'status', r.status,
          'resolution_note', r.resolution_note,
          'created_at', r.created_at,
          'reviewed_at', r.reviewed_at,
          'reported_user', jsonb_build_object(
            'id', reported.id,
            'username', reported.username,
            'display_name', reported.display_name,
            'avatar_url', reported.avatar_url
          ),
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
          ) END,
          'active_punishments', COALESCE(
            (
              SELECT jsonb_agg(jsonb_build_object(
                'id', p.id,
                'action_type', p.action_type,
                'reason', p.reason,
                'expires_at', p.expires_at,
                'created_at', p.created_at
              ) ORDER BY p.created_at DESC)
              FROM public.user_punishments p
              WHERE p.user_id = r.reported_user_id
                AND p.revoked_at IS NULL
                AND p.action_type IN ('restrict_messages', 'suspend', 'ban')
                AND (p.expires_at IS NULL OR p.expires_at > now())
            ),
            '[]'::jsonb
          )
        )
        ORDER BY r.created_at DESC
      )
      FROM public.message_reports r
      JOIN public.users reported ON reported.id = r.reported_user_id
      LEFT JOIN public.users reporter ON reporter.id = r.reporter_id
      LEFT JOIN public.users reviewer ON reviewer.id = r.reviewed_by
      WHERE (_status IS NULL OR _status = 'all' OR r.status = _status)
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_admin_report_action(
  _admin_user_id uuid,
  _report_id uuid,
  _action_type text,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _report public.message_reports%ROWTYPE;
  _expires_at timestamptz := NULL;
  _punishment_type text := NULL;
  _details jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.is_platform_admin(_admin_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _action_type := lower(trim(_action_type));
  _note := NULLIF(left(trim(COALESCE(_note, '')), 1000), '');

  SELECT * INTO _report
  FROM public.message_reports
  WHERE id = _report_id
  FOR UPDATE;

  IF _report.id IS NULL THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  IF _action_type = 'dismiss' THEN
    UPDATE public.message_reports
    SET status = 'dismissed',
        reviewed_by = _admin_user_id,
        reviewed_at = now(),
        resolution_note = COALESCE(_note, 'Dismissed: no platform action needed')
    WHERE id = _report_id;
  ELSIF _action_type = 'delete_message' THEN
    IF _report.message_type = 'channel' THEN
      DELETE FROM public.messages WHERE id = _report.message_id;
    ELSE
      DELETE FROM public.direct_messages WHERE id = _report.message_id;
    END IF;
    UPDATE public.message_reports
    SET status = 'actioned',
        reviewed_by = _admin_user_id,
        reviewed_at = now(),
        resolution_note = COALESCE(_note, 'Message removed')
    WHERE id = _report_id;
  ELSIF _action_type IN ('warn', 'restrict_24h', 'restrict_7d', 'suspend_24h', 'suspend_7d', 'ban') THEN
    _punishment_type := CASE
      WHEN _action_type = 'warn' THEN 'warn'
      WHEN _action_type IN ('restrict_24h', 'restrict_7d') THEN 'restrict_messages'
      WHEN _action_type IN ('suspend_24h', 'suspend_7d') THEN 'suspend'
      ELSE 'ban'
    END;

    _expires_at := CASE
      WHEN _action_type IN ('restrict_24h', 'suspend_24h') THEN now() + interval '24 hours'
      WHEN _action_type IN ('restrict_7d', 'suspend_7d') THEN now() + interval '7 days'
      ELSE NULL
    END;

    INSERT INTO public.user_punishments (
      user_id,
      action_type,
      reason,
      details,
      report_id,
      created_by,
      expires_at
    )
    VALUES (
      _report.reported_user_id,
      _punishment_type,
      _report.reason,
      COALESCE(_note, _report.details),
      _report.id,
      _admin_user_id,
      _expires_at
    );

    UPDATE public.message_reports
    SET status = 'actioned',
        reviewed_by = _admin_user_id,
        reviewed_at = now(),
        resolution_note = COALESCE(_note, 'Action applied: ' || _action_type)
    WHERE id = _report_id;
  ELSE
    RAISE EXCEPTION 'Unsupported action type';
  END IF;

  _details := jsonb_build_object(
    'note', _note,
    'message_type', _report.message_type,
    'message_id', _report.message_id
  );

  INSERT INTO public.admin_moderation_actions (
    admin_user_id,
    target_user_id,
    report_id,
    action_type,
    details
  )
  VALUES (
    _admin_user_id,
    _report.reported_user_id,
    _report.id,
    _action_type,
    _details
  );

  RETURN jsonb_build_object('success', true, 'action_type', _action_type);
END;
$$;

CREATE OR REPLACE FUNCTION public.revoke_user_punishment(
  _admin_user_id uuid,
  _punishment_id uuid,
  _note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _target_user_id uuid;
BEGIN
  IF NOT public.is_platform_admin(_admin_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.user_punishments
  SET revoked_at = now(),
      revoked_by = _admin_user_id
  WHERE id = _punishment_id
    AND revoked_at IS NULL
  RETURNING user_id INTO _target_user_id;

  IF _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Punishment not found or already revoked';
  END IF;

  INSERT INTO public.admin_moderation_actions (admin_user_id, target_user_id, action_type, details)
  VALUES (_admin_user_id, _target_user_id, 'revoke_punishment', jsonb_build_object('punishment_id', _punishment_id, 'note', _note));

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_unacknowledged_punishments(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', p.id,
          'action_type', p.action_type,
          'reason', p.reason,
          'details', p.details,
          'starts_at', p.starts_at,
          'expires_at', p.expires_at,
          'created_at', p.created_at,
          'report', CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object(
            'id', r.id,
            'reason', r.reason,
            'message_type', r.message_type,
            'created_at', r.created_at
          ) END
        )
        ORDER BY p.created_at ASC
      )
      FROM public.user_punishments p
      LEFT JOIN public.message_reports r ON r.id = p.report_id
      WHERE p.user_id = _user_id
        AND p.revoked_at IS NULL
        AND p.acknowledged_at IS NULL
        AND (
          p.action_type = 'warn'
          OR p.expires_at IS NULL
          OR p.expires_at > now()
        )
    ),
    '[]'::jsonb
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.acknowledge_my_punishments(_user_id uuid, _punishment_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _ids uuid[];
BEGIN
  IF _user_id IS NULL OR NOT public.verify_request_identity(_user_id) THEN
    RAISE EXCEPTION 'Unauthorized: identity mismatch';
  END IF;

  _ids := COALESCE(_punishment_ids, ARRAY[]::uuid[]);

  UPDATE public.user_punishments
  SET acknowledged_at = now()
  WHERE user_id = _user_id
    AND acknowledged_at IS NULL
    AND id = ANY(_ids);

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_channel_message_punishment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_punishments p
    WHERE p.user_id = NEW.user_id
      AND p.revoked_at IS NULL
      AND p.action_type IN ('restrict_messages', 'suspend', 'ban')
      AND (p.expires_at IS NULL OR p.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Account is restricted from sending messages';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_dm_message_punishment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.user_punishments p
    WHERE p.user_id = NEW.sender_id
      AND p.revoked_at IS NULL
      AND p.action_type IN ('restrict_messages', 'suspend', 'ban')
      AND (p.expires_at IS NULL OR p.expires_at > now())
  ) THEN
    RAISE EXCEPTION 'Account is restricted from sending messages';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_user_message_punishment ON public.messages;
CREATE TRIGGER trg_enforce_user_message_punishment
  BEFORE INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_channel_message_punishment();

DROP TRIGGER IF EXISTS trg_enforce_user_dm_punishment ON public.direct_messages;
CREATE TRIGGER trg_enforce_user_dm_punishment
  BEFORE INSERT ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_dm_message_punishment();

CREATE OR REPLACE FUNCTION public.login_user(_key_hash text) RETURNS json
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $_$
DECLARE
  result json;
  _user_id uuid;
  _dummy_hash text := 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
  _client_id text;
  _key_bucket text;
  _punishment record;
BEGIN
  _client_id := public.request_client_identifier();

  IF _key_hash IS NULL OR length(_key_hash) != 64 OR _key_hash !~ '^[a-fA-F0-9]{64}$' THEN
    IF _client_id <> 'unknown'
       AND NOT public.check_rate_limit(_client_id, 'login_user_invalid', 30, 60) THEN
      RAISE EXCEPTION 'Rate limited: login temporarily blocked';
    END IF;
    PERFORM pg_sleep(0.1);
    RETURN NULL;
  END IF;

  _key_bucket := left(lower(_key_hash), 16);
  IF NOT public.check_rate_limit(_key_bucket, 'login_user_keyhash', 20, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many login attempts';
  END IF;

  IF _client_id <> 'unknown'
     AND NOT public.check_rate_limit(_client_id, 'login_user_client', 60, 60) THEN
    RAISE EXCEPTION 'Rate limited: too many login attempts';
  END IF;

  SELECT ua.user_id INTO _user_id
  FROM public.user_auth ua
  WHERE ua.key_hash = _key_hash
  LIMIT 1;

  IF _user_id IS NULL THEN
    PERFORM key_hash FROM public.user_auth WHERE key_hash = _dummy_hash LIMIT 1;
    RETURN NULL;
  END IF;

  SELECT action_type, expires_at INTO _punishment
  FROM public.user_punishments
  WHERE user_id = _user_id
    AND revoked_at IS NULL
    AND action_type IN ('suspend', 'ban')
    AND acknowledged_at IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY starts_at DESC
  LIMIT 1;

  IF _punishment.action_type = 'ban' THEN
    RAISE EXCEPTION 'Account banned';
  ELSIF _punishment.action_type = 'suspend' THEN
    RAISE EXCEPTION 'Account suspended until %', _punishment.expires_at;
  END IF;

  SELECT json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'avatar_url', u.avatar_url,
    'banner_url', u.banner_url,
    'avatar_decoration', u.avatar_decoration,
    'profile_effect', u.profile_effect,
    'banner_color', u.banner_color,
    'profile_theme_primary', u.profile_theme_primary,
    'profile_theme_accent', u.profile_theme_accent,
    'bio', u.bio,
    'status', u.status,
    'custom_status', u.custom_status,
    'allow_nsfw', u.allow_nsfw,
    'created_at', u.created_at,
    'last_seen', u.last_seen
  ) INTO result
  FROM public.users u
  WHERE u.id = _user_id;

  IF result IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.users
  SET status = 'online',
      last_seen = now()
  WHERE id = _user_id;

  RETURN result;
END;
$_$;

REVOKE EXECUTE ON FUNCTION public.report_message(text, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_message_reports(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.apply_admin_report_action(uuid, uuid, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.revoke_user_punishment(uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_unacknowledged_punishments(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.acknowledge_my_punishments(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_message(text, uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_message_reports(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_admin_report_action(uuid, uuid, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_user_punishment(uuid, uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_unacknowledged_punishments(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acknowledge_my_punishments(uuid, uuid[]) TO anon, authenticated, service_role;
