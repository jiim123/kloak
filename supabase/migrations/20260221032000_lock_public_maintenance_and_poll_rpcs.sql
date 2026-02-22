-- Lock down publicly executable maintenance/admin RPCs
-- that are not intended for untrusted clients.

BEGIN;

-- Poll lifecycle internals should not be callable by public clients.
REVOKE EXECUTE ON FUNCTION public.close_poll(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_poll(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.recompute_poll_results(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_poll_results(uuid) TO service_role;

-- Maintenance helpers should not be internet-reachable.
REVOKE EXECUTE ON FUNCTION public.cleanup_pow_challenges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_pow_challenges() TO service_role;

-- Debug helper should never be public in production.
REVOKE EXECUTE ON FUNCTION public.debug_request_headers() FROM PUBLIC, anon, authenticated;

COMMIT;

-- Optional rollback:
-- BEGIN;
-- GRANT EXECUTE ON FUNCTION public.close_poll(uuid) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.recompute_poll_results(uuid) TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.cleanup_pow_challenges() TO anon, authenticated;
-- GRANT EXECUTE ON FUNCTION public.debug_request_headers() TO anon, authenticated;
-- COMMIT;
