-- Makes admin "delete message" reliably remove the reported row and notify live clients.
-- Safe to run after 20260621124000_add_admin_reason_and_warning_expiry.sql.

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
  _deleted_count integer := 0;
  _dm_conversation_id uuid := NULL;
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
      DELETE FROM public.messages
      WHERE id = _report.message_id;
      GET DIAGNOSTICS _deleted_count = ROW_COUNT;
    ELSE
      SELECT conversation_id INTO _dm_conversation_id
      FROM public.direct_messages
      WHERE id = _report.message_id;

      DELETE FROM public.direct_messages
      WHERE id = _report.message_id;
      GET DIAGNOSTICS _deleted_count = ROW_COUNT;

      IF _deleted_count > 0 AND _dm_conversation_id IS NOT NULL THEN
        PERFORM realtime.send(
          jsonb_build_object(
            'op', 'DELETE',
            'message', jsonb_build_object(
              'id', _report.message_id,
              'conversation_id', _dm_conversation_id
            )
          ),
          'message_deleted',
          'dm:' || _dm_conversation_id::text,
          false
        );
      END IF;
    END IF;

    UPDATE public.message_reports
    SET status = 'actioned',
        reviewed_by = _admin_user_id,
        reviewed_at = now(),
        resolution_note = COALESCE(
          _note,
          CASE
            WHEN _deleted_count > 0 THEN 'Message removed'
            ELSE 'Message was already removed'
          END
        )
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
    'message_id', _report.message_id,
    'deleted_count', _deleted_count
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
    'expires_at', _resolved_expires_at,
    'deleted_count', _deleted_count
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_admin_report_action_v2(uuid, uuid, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_admin_report_action_v2(uuid, uuid, text, text, text, timestamptz) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
