
-- Lock down the users table from direct PostgREST (anon) access.
-- All frontend queries already use SECURITY DEFINER RPCs which bypass RLS.
-- Realtime subscriptions need the 'realtime' role to pass SELECT checks.

-- 1. Drop existing permissive policies
DROP POLICY IF EXISTS "Users can view related users" ON public.users;
DROP POLICY IF EXISTS "Users can update own record" ON public.users;
DROP POLICY IF EXISTS "Users can delete own record" ON public.users;
DROP POLICY IF EXISTS "Allow user registration" ON public.users;

-- 2. SELECT: Only allow the 'realtime' role (for postgres_changes subscriptions)
CREATE POLICY "users_select_realtime_only"
  ON public.users
  FOR SELECT
  USING (CURRENT_USER = 'realtime'::name);

-- 3. INSERT: Deny all direct inserts (registration goes through SECURITY DEFINER RPCs)
CREATE POLICY "users_insert_deny"
  ON public.users
  FOR INSERT
  WITH CHECK (false);

-- 4. UPDATE: Deny all direct updates (profile/status updates go through SECURITY DEFINER RPCs)
CREATE POLICY "users_update_deny"
  ON public.users
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- 5. DELETE: Deny all direct deletes (account deletion goes through SECURITY DEFINER RPCs)
CREATE POLICY "users_delete_deny"
  ON public.users
  FOR DELETE
  USING (false);
