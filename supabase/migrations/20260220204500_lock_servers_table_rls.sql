-- Lock down direct REST access to public.servers.
-- Prevents anon PATCH/UPDATE (including owner_id takeover) via PostgREST.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'servers'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.servers FORCE ROW LEVEL SECURITY;

-- Allow public discovery only for explicitly published servers.
-- Authenticated users can also see servers they own or are members of.
CREATE POLICY "Servers are viewable by members or published"
  ON public.servers
  FOR SELECT
  USING (
    COALESCE(is_published, false) = true
    OR owner_id = (SELECT public.requesting_user_id())
    OR EXISTS (
      SELECT 1
      FROM public.server_members sm
      WHERE sm.server_id = servers.id
        AND sm.user_id = (SELECT public.requesting_user_id())
        AND COALESCE(sm.is_banned, false) = false
    )
  );

-- Direct INSERT only for self-owned rows.
CREATE POLICY "Servers can be inserted by owner"
  ON public.servers
  FOR INSERT
  WITH CHECK (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND owner_id = (SELECT public.requesting_user_id())
  );

-- Direct UPDATE only by current owner, and owner_id must remain self.
-- This blocks direct ownership transfer through REST PATCH.
CREATE POLICY "Servers can be updated by owner only"
  ON public.servers
  FOR UPDATE
  USING (owner_id = (SELECT public.requesting_user_id()))
  WITH CHECK (owner_id = (SELECT public.requesting_user_id()));

-- Direct DELETE only by owner.
CREATE POLICY "Servers can be deleted by owner only"
  ON public.servers
  FOR DELETE
  USING (owner_id = (SELECT public.requesting_user_id()));
