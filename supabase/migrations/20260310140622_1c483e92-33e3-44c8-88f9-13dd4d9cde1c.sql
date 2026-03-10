-- Re-grant EXECUTE on check_rate_limit to service_role so edge functions can use it.
-- Keep it revoked from anon/authenticated to prevent direct abuse.
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, text, integer, integer) TO service_role;