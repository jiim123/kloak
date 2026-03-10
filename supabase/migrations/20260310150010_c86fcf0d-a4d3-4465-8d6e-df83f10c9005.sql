-- Fix auth_rate_limits RLS: restrictive deny policy on PUBLIC blocks postgres/service_role too
-- because PUBLIC applies to every role. Restrict deny policy to client roles only.

DROP POLICY IF EXISTS auth_rate_limits_deny_public ON public.auth_rate_limits;

CREATE POLICY auth_rate_limits_deny_client_roles
ON public.auth_rate_limits
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);