-- Fix OR-leak on public.messages SELECT policies.
-- In Postgres RLS, multiple SELECT policies are OR'ed together.
-- We drop all existing SELECT policies on messages and recreate one strict policy.

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'messages'
      AND cmd = 'SELECT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY "Messages readable by channel access"
  ON public.messages
  FOR SELECT
  USING (
    (SELECT public.requesting_user_id()) IS NOT NULL
    AND public.is_maintenance_active() = false
    AND public.can_access_channel(channel_id, (SELECT public.requesting_user_id()))
  );
