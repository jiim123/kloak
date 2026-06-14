-- Let the admin inbox load and resolve profile/server reports.

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

CREATE OR REPLACE FUNCTION public.apply_admin_entity_report_action(
  _admin_user_id uuid,
  _report_id uuid,
  _action_type text,
  _note text DEFAULT NULL,
  _reason text DEFAULT NULL,
  _expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  _report public.entity_reports%ROWTYPE;
  _punishment_type text := NULL;
  _action_reason text;
BEGIN
  IF NOT public.is_platform_admin(_admin_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _action_type := lower(trim(_action_type));
  _note := NULLIF(left(trim(COALESCE(_note, '')), 1000), '');
  _action_reason := NULLIF(left(trim(COALESCE(_reason, '')), 160), '');

  SELECT * INTO _report
  FROM public.entity_reports
  WHERE id = _report_id
  FOR UPDATE;

  IF _report.id IS NULL THEN
    RAISE EXCEPTION 'Report not found';
  END IF;
  IF _action_type = 'delete_message' THEN
    RAISE EXCEPTION 'Delete message is not supported for this report type';
  END IF;

  IF _action_type = 'dismiss' THEN
    UPDATE public.entity_reports
    SET status = 'dismissed',
        reviewed_by = _admin_user_id,
        reviewed_at = now(),
        resolution_note = COALESCE(_note, 'Dismissed: no platform action needed')
    WHERE id = _report_id;
  ELSIF _action_type IN ('warn', 'restrict_24h', 'restrict_7d', 'suspend_24h', 'suspend_7d', 'ban') THEN
    IF _report.reported_user_id IS NULL THEN
      RAISE EXCEPTION 'No target user is available for this report';
    END IF;

    _punishment_type := CASE
      WHEN _action_type = 'warn' THEN 'warn'
      WHEN _action_type IN ('restrict_24h', 'restrict_7d') THEN 'restrict_messages'
      WHEN _action_type IN ('suspend_24h', 'suspend_7d') THEN 'suspend'
      ELSE 'ban'
    END;

    IF _expires_at IS NULL THEN
      _expires_at := CASE
        WHEN _action_type IN ('restrict_24h', 'suspend_24h') THEN now() + interval '24 hours'
        WHEN _action_type IN ('restrict_7d', 'suspend_7d') THEN now() + interval '7 days'
        ELSE NULL
      END;
    END IF;

    INSERT INTO public.user_punishments (
      user_id,
      action_type,
      reason,
      details,
      created_by,
      expires_at
    )
    VALUES (
      _report.reported_user_id,
      _punishment_type,
      COALESCE(_action_reason, _report.reason),
      COALESCE(_note, _report.details),
      _admin_user_id,
      _expires_at
    );

    UPDATE public.entity_reports
    SET status = 'actioned',
        reviewed_by = _admin_user_id,
        reviewed_at = now(),
        resolution_note = COALESCE(_note, 'Action applied: ' || _action_type)
    WHERE id = _report_id;
  ELSE
    RAISE EXCEPTION 'Unsupported action type';
  END IF;

  INSERT INTO public.admin_moderation_actions (
    admin_user_id,
    target_user_id,
    action_type,
    details
  )
  VALUES (
    _admin_user_id,
    _report.reported_user_id,
    _action_type,
    jsonb_build_object(
      'note', _note,
      'entity_report_id', _report.id,
      'entity_type', _report.entity_type,
      'entity_id', _report.entity_id
    )
  );

  RETURN jsonb_build_object('success', true, 'action_type', _action_type);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_admin_entity_report_action(uuid, uuid, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_admin_entity_report_action(uuid, uuid, text, text, text, timestamptz) TO anon, authenticated, service_role;
