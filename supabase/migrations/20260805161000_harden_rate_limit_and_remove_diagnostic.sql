-- Restore atomic rate limiting and remove the temporary diagnostic RPC.
--
-- Some existing rate-limit buckets use a 24-hour window. Cleanup must retain
-- those rows long enough for the window to remain enforceable.

CREATE OR REPLACE FUNCTION public.cleanup_stale_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _deleted integer;
BEGIN
  -- Keep a one-hour buffer beyond the longest 24-hour bucket.
  DELETE FROM public.auth_rate_limits
  WHERE window_start < now() - interval '25 hours';

  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$function$;

REVOKE ALL ON FUNCTION public.cleanup_stale_rate_limits() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _ip_hash text,
  _action text,
  _max_attempts integer,
  _window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  _allowed boolean;
  _now timestamptz := clock_timestamp();
BEGIN
  IF NULLIF(_ip_hash, '') IS NULL
     OR NULLIF(_action, '') IS NULL
     OR _max_attempts < 1
     OR _window_seconds < 1 THEN
    RETURN false;
  END IF;

  -- The conflict update locks and evaluates the bucket atomically. This
  -- prevents concurrent requests from bypassing the limit between a SELECT
  -- and a subsequent UPDATE.
  INSERT INTO public.auth_rate_limits AS rate_limit (
    ip_hash,
    action,
    attempts,
    window_start
  )
  VALUES (_ip_hash, _action, 1, _now)
  ON CONFLICT (ip_hash, action) DO UPDATE
  SET attempts = CASE
      WHEN rate_limit.window_start <= _now - (_window_seconds * interval '1 second')
        THEN 1
      WHEN rate_limit.attempts >= _max_attempts
        THEN rate_limit.attempts
      ELSE rate_limit.attempts + 1
    END,
    window_start = CASE
      WHEN rate_limit.window_start <= _now - (_window_seconds * interval '1 second')
        THEN _now
      ELSE rate_limit.window_start
    END
  RETURNING attempts <= _max_attempts INTO _allowed;

  RETURN COALESCE(_allowed, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer)
  TO service_role;

-- Cap the achievement count at the largest threshold. Exact counts are not
-- needed to decide any achievement and this avoids scanning every membership
-- for users with very large membership histories.
CREATE OR REPLACE FUNCTION public.check_server_join_achievements(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _server_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::integer INTO _server_count
  FROM (
    SELECT sm.server_id
    FROM public.server_members sm
    WHERE sm.user_id = _user_id
      AND sm.is_banned = false
      AND NOT EXISTS (
        SELECT 1
        FROM public.servers s
        WHERE s.id = sm.server_id
          AND s.owner_id = _user_id
      )
    LIMIT 51
  ) AS eligible_joins;

  IF _server_count >= 1 THEN
    PERFORM public.award_achievement(
      _user_id,
      'first_server_join',
      jsonb_build_object('server_count', _server_count)
    );
  END IF;
  IF _server_count >= 10 THEN
    PERFORM public.award_achievement(
      _user_id,
      'join_10_servers',
      jsonb_build_object('server_count', _server_count)
    );
  END IF;
  IF _server_count >= 50 THEN
    PERFORM public.award_achievement(
      _user_id,
      'join_50_servers',
      jsonb_build_object('server_count', _server_count)
    );
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_server_join_achievements(uuid)
  FROM PUBLIC, anon, authenticated;

-- The diagnostic endpoint was temporary and must not remain callable.
DROP FUNCTION IF EXISTS public.diag_join_server_perf(text, uuid);

ANALYZE public.auth_rate_limits;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
