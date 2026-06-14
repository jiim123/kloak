-- Include the reported message snapshot in user-facing punishment notices.

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
            'message_content', r.message_content,
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
