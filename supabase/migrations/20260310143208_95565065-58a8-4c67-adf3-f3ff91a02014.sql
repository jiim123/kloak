-- Fix rate limiter under FORCE RLS so edge functions can operate.
-- Current deny-all policy blocks SECURITY DEFINER writes into auth_rate_limits.

DROP POLICY IF EXISTS server_only_access ON public.auth_rate_limits;

CREATE POLICY auth_rate_limits_service_internal
ON public.auth_rate_limits
AS PERMISSIVE
FOR ALL
TO service_role, postgres
USING (true)
WITH CHECK (true);

-- Keep everyone else blocked explicitly
CREATE POLICY auth_rate_limits_deny_public
ON public.auth_rate_limits
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);