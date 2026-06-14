-- Adds admin-selected punishment reasons and optional warning expiry.
-- This patch is safe to run after the base moderation migration.

CREATE OR REPLACE FUNCTION public.apply_admin_report_action_v2(
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
  _report public.message_reports%ROWTYPE;
  _resolved_expires_at timestamptz := NULL;
  _punishment_type text := NULL;
  _details jsonb := '{}'::jsonb;
  _resolved_reason text;
BEGIN
  IF NOT public.is_platform_admin(_admin_user_id) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  _action_type := lower(trim(_action_type));
  _note := NULLIF(left(trim(COALESCE(_note, '')), 1000), '');
  _resolved_reason := NULLIF(left(trim(COALESCE(_reason, '')), 160), '');

  SELECT * INTO _report
  FROM public.message_reports
  WHERE id = _report_id
  FOR UPDATE;

  IF _report.id IS NULL THEN
    RAISE EXCEPTION 'Report not found';
  END IF;

  _resolved_reason := COALESCE(_resolved_reason, _report.reason, 'Platform rules violation');

  IF _action_type = 'dismiss' THEN
    UPDATE public.message_reports
    SET status = 'dismissed',
        reviewed_by = _admin_user_id,
        reviewed_at = now(),
        resolution_note = COALESCE(_note, _resolved_reason, 'Dismissed: no platform action needed')
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
        resolution_note = COALESCE(_note, _resolved_reason, 'Message removed')
    WHERE id = _report_id;
  ELSIF _action_type IN ('warn', 'restrict_24h', 'restrict_7d', 'suspend_24h', 'suspend_7d', 'ban') THEN
    _punishment_type := CASE
      WHEN _action_type = 'warn' THEN 'warn'
      WHEN _action_type IN ('restrict_24h', 'restrict_7d') THEN 'restrict_messages'
      WHEN _action_type IN ('suspend_24h', 'suspend_7d') THEN 'suspend'
      ELSE 'ban'
    END;

    _resolved_expires_at := CASE
      WHEN _action_type = 'warn' THEN _expires_at
      WHEN _action_type IN ('restrict_24h', 'suspend_24h') THEN now() + interval '24 hours'
      WHEN _action_type IN ('restrict_7d', 'suspend_7d') THEN now() + interval '7 days'
      ELSE NULL
    END;

    IF _resolved_expires_at IS NOT NULL AND _resolved_expires_at <= now() THEN
      RAISE EXCEPTION 'Expiry must be in the future';
    END IF;

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
      _resolved_reason,
      _note,
      _report.id,
      _admin_user_id,
      _resolved_expires_at
    );

    UPDATE public.message_reports
    SET status = 'actioned',
        reviewed_by = _admin_user_id,
        reviewed_at = now(),
        resolution_note = COALESCE(_note, 'Action applied: ' || _action_type || ' - ' || _resolved_reason)
    WHERE id = _report_id;
  ELSE
    RAISE EXCEPTION 'Unsupported action type';
  END IF;

  _details := jsonb_build_object(
    'note', _note,
    'reason', _resolved_reason,
    'expires_at', _resolved_expires_at,
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

  RETURN jsonb_build_object(
    'success', true,
    'action_type', _action_type,
    'reason', _resolved_reason,
    'expires_at', _resolved_expires_at
  );
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
        AND (p.expires_at IS NULL OR p.expires_at > now())
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_admin_report_action_v2(uuid, uuid, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_admin_report_action_v2(uuid, uuid, text, text, text, timestamptz) TO anon, authenticated, service_role;
