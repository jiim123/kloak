
-- ============================================================
-- SECURE SERVER ROUTES: RLS Hardening
-- Move from client-side hiding to server-side enforcement
-- ============================================================

-- 1. Helper function: check if a user is an admin or owner of a server
--    Uses requesting_user_id() (the custom auth identity function) so it
--    works with Kloak's secret-key-based auth (auth.uid() is always NULL).
CREATE OR REPLACE FUNCTION public.is_server_admin_or_owner(_server_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.server_members sm
    WHERE sm.server_id = _server_id
      AND sm.user_id   = _user_id
      AND sm.is_banned = false
      AND sm.role IN ('owner', 'admin')
  );
$$;

-- 2. servers table
-- ---------------------------------------------------------------
-- DROP legacy permissive policies that might allow non-members to see data
DROP POLICY IF EXISTS "Servers select by membership or published" ON public.servers;
DROP POLICY IF EXISTS "Owner or admin can update server settings" ON public.servers;

-- SELECT: member of the server OR server is publicly published (for discovery)
CREATE POLICY "Servers viewable by members or published"
  ON public.servers
  FOR SELECT
  USING (
    (is_published = true)
    OR public.is_server_member(id, public.requesting_user_id())
  );

-- UPDATE: only server admins or owners (enforced server-side, not just client)
CREATE POLICY "Servers editable by admins and owners only"
  ON public.servers
  FOR UPDATE
  USING (
    public.is_server_admin_or_owner(id, public.requesting_user_id())
  )
  WITH CHECK (
    public.is_server_admin_or_owner(id, public.requesting_user_id())
  );

-- 3. server_members table
-- ---------------------------------------------------------------
-- DROP old overly-broad policy
DROP POLICY IF EXISTS "Members view fellow members" ON public.server_members;

-- SELECT: only users who are themselves a non-banned member of that server
--         + allow realtime role (for broadcasts) and unauthenticated joins
CREATE POLICY "Members viewable by fellow members only"
  ON public.server_members
  FOR SELECT
  USING (
    (public.requesting_user_id() IS NULL)
    OR (CURRENT_USER = 'realtime')
    OR public.is_server_member(server_id, public.requesting_user_id())
  );
