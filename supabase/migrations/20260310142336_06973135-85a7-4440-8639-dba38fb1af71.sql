-- Allow service_role to read user_auth so edge functions can authenticate users.
-- FORCE RLS is still active, so anon/authenticated remain blocked.
CREATE POLICY "service_role_select_user_auth"
  ON public.user_auth
  FOR SELECT
  TO service_role
  USING (true);
