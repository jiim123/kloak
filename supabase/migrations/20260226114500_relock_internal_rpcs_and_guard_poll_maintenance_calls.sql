-- Re-lock internal maintenance/audit RPC execute surface and add identity-aware
-- guards for poll maintenance functions when invoked directly by end users.

-- -------------------------------------------------------------------
-- close_poll: allow internal/service invocations; enforce caller checks
-- for direct authenticated invocations.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.close_poll(_poll_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  poll_row record;
  poll_channel_id uuid;
  poll_creator_id uuid;
  caller_user_id uuid;
  opt_count int;
  i int;
  v int;
  max_votes int := 0;
  winner text := '';
  result_text text;
BEGIN
  caller_user_id := public.requesting_user_id();
  IF caller_user_id IS NOT NULL THEN
    IF NOT public.verify_request_identity(caller_user_id) THEN
      RAISE EXCEPTION 'Unauthorized: identity mismatch';
    END IF;

    SELECT p.channel_id, p.created_by
      INTO poll_channel_id, poll_creator_id
    FROM public.polls p
    WHERE p.id = _poll_id;

    IF poll_channel_id IS NULL THEN
      RETURN true;
    END IF;

    IF caller_user_id <> poll_creator_id
       AND NOT public.check_user_permission(caller_user_id, poll_channel_id, 'manage_messages'::public.permission_type) THEN
      RAISE EXCEPTION 'Forbidden';
    END IF;
  END IF;

  UPDATE public.polls
     SET is_closed = true
   WHERE id = _poll_id
     AND is_closed = false
  RETURNING * INTO poll_row;

  IF poll_row IS NULL THEN
    RETURN true;
  END IF;

  opt_count := jsonb_array_length(COALESCE(poll_row.results, '[]'::jsonb));

  IF opt_count > 0 AND COALESCE(poll_row.total_votes, 0) > 0 THEN
    FOR i IN 0..(opt_count - 1) LOOP
      v := COALESCE((poll_row.results ->> i)::int, 0);
      IF v > max_votes THEN
        max_votes := v;
        winner := COALESCE(poll_row.options[i + 1], 'Option ' || (i + 1));
      END IF;
    END LOOP;

    result_text := 'Poll ended: "' || poll_row.question || '" - Winner: ' || winner || ' (' || max_votes || ' vote' || CASE WHEN max_votes = 1 THEN '' ELSE 's' END || ')';
  ELSE
    result_text := 'Poll ended: "' || poll_row.question || '" - No votes were cast';
  END IF;

  INSERT INTO public.messages (channel_id, user_id, content, is_system_message, reply_to_id)
  VALUES (poll_row.channel_id, poll_row.created_by, result_text, true, poll_row.message_id);

  RETURN true;
END;
$function$;

-- -------------------------------------------------------------------
-- recompute_poll_results: allow internal/service invocations; enforce
-- caller identity and channel visibility for direct invocations.
-- -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_poll_results(_poll_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _options text[];
  _n integer;
  _results jsonb;
  _total integer;
  _poll_channel_id uuid;
  _caller_user_id uuid;
BEGIN
  _caller_user_id := public.requesting_user_id();
  IF _caller_user_id IS NOT NULL THEN
    IF NOT public.verify_request_identity(_caller_user_id) THEN
      RAISE EXCEPTION 'Unauthorized: identity mismatch';
    END IF;
  END IF;

  SELECT p.options, p.channel_id
    INTO _options, _poll_channel_id
  FROM public.polls p
  WHERE p.id = _poll_id;

  IF _options IS NULL THEN
    RAISE EXCEPTION 'Poll not found';
  END IF;

  IF _caller_user_id IS NOT NULL
     AND NOT public.can_access_channel(_poll_channel_id, _caller_user_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  _n := COALESCE(array_length(_options, 1), 0);

  SELECT jsonb_agg(COALESCE(v.cnt, 0) ORDER BY s.i)
    INTO _results
  FROM generate_series(0, GREATEST(_n - 1, 0)) AS s(i)
  LEFT JOIN (
    SELECT option_index, COUNT(*)::int AS cnt
    FROM public.poll_votes
    WHERE poll_id = _poll_id
    GROUP BY option_index
  ) v ON v.option_index = s.i;

  SELECT COUNT(*)::int INTO _total
  FROM public.poll_votes
  WHERE poll_id = _poll_id;

  UPDATE public.polls
  SET results = COALESCE(_results, '[]'::jsonb),
      total_votes = COALESCE(_total, 0)
  WHERE id = _poll_id;
END;
$function$;

-- -------------------------------------------------------------------
-- Re-lock sensitive/internal execute surface.
-- -------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.create_notification(uuid, notification_type, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_poll(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_poll_results(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_pow_challenges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.debug_request_headers() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_function_execute_surface() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_function_execute_surface_strict() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_table_dangerous_privileges() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.assert_no_dangerous_table_privileges() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_notification(uuid, notification_type, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.close_poll(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_poll_results(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_pow_challenges() TO service_role;
GRANT EXECUTE ON FUNCTION public.debug_request_headers() TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_function_execute_surface() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_function_execute_surface_strict() TO service_role;
GRANT EXECUTE ON FUNCTION public.audit_table_dangerous_privileges() TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_no_dangerous_table_privileges() TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
