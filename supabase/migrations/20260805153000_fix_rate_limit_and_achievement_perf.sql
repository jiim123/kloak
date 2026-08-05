-- Fix statement timeout on join_server_by_invite (part 2).
-- Root causes found via diagnostics:
--   1. check_rate_limit: auth_rate_limits table has no cleanup, accrues millions
--      of rows over time.  Each PK INSERT/UPDATE must traverse a deep B-tree,
--      and constant UPDATEs create heap bloat.
--   2. check_server_join_achievements: the JOIN + s.owner_id <> causes the
--      planner to scan servers instead of starting from server_members by user_id.
--
-- Fixes:
--   1. Add scheduled cleanup for stale auth_rate_limits rows (older than 25 hr).
--   2. Make check_rate_limit atomic under concurrency.
--   3. Restructure check_server_join_achievements to use EXISTS so the planner
--      starts from the highly-selective user_id index on server_members.

-- ============================================================================
-- 1. PERIODIC CLEANUP FOR auth_rate_limits
-- ============================================================================
-- Rate-limit windows include a 24-hour bucket; retain rows for 25 hours.
-- Call this via pg_cron every 15 minutes.

CREATE OR REPLACE FUNCTION public.cleanup_stale_rate_limits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  _deleted integer;
BEGIN
  DELETE FROM public.auth_rate_limits
  WHERE window_start < now() - interval '25 hours';
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cleanup_stale_rate_limits() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 2. ATOMIC check_rate_limit
-- ============================================================================
-- Use one upsert so concurrent calls cannot bypass the limit between a SELECT
-- and a subsequent UPDATE.

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _ip_hash text,
  _action text,
  _max_attempts int,
  _window_seconds int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  INSERT INTO public.auth_rate_limits AS rate_limit (
    ip_hash, action, attempts, window_start
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
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, text, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, int, int) TO service_role;

-- ============================================================================
-- 3. FIXED check_server_join_achievements (avoid servers scan)
-- ============================================================================
-- The JOIN + s.owner_id <> _user_id caused the planner to scan servers first
-- when it had poor statistics.  Using NOT EXISTS with the owner_id index on
-- servers forces the planner to start from server_members by user_id.

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

  SELECT count(*)::int INTO _server_count
  FROM public.server_members sm
  WHERE sm.user_id = _user_id
    AND COALESCE(sm.is_banned, false) = false
    AND NOT EXISTS (
      SELECT 1 FROM public.servers s
      WHERE s.id = sm.server_id AND s.owner_id = _user_id
    );

  IF _server_count >= 1 THEN
    PERFORM public.award_achievement(_user_id, 'first_server_join', jsonb_build_object('server_count', _server_count));
  END IF;
  IF _server_count >= 10 THEN
    PERFORM public.award_achievement(_user_id, 'join_10_servers', jsonb_build_object('server_count', _server_count));
  END IF;
  IF _server_count >= 50 THEN
    PERFORM public.award_achievement(_user_id, 'join_50_servers', jsonb_build_object('server_count', _server_count));
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_server_join_achievements(uuid) FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 4. ONE-TIME CLEANUP: prune existing stale rate-limit rows
-- ============================================================================
SELECT public.cleanup_stale_rate_limits() AS stale_rows_deleted;

-- ============================================================================
-- 5. Setup pg_cron job for periodic cleanup (if pg_cron extension is available)
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'cleanup-auth-rate-limits',
      '*/15 * * * *',
      'SELECT public.cleanup_stale_rate_limits();'
    );
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;
