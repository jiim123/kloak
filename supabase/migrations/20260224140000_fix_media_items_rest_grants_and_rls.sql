-- Fix REST access for media_items without widening exposure.
-- Root cause: API roles lost table-level SELECT grant, which causes
-- "permission denied for table media_items" before RLS is evaluated.
--
-- Safety goals:
-- 1) Keep RLS enabled.
-- 2) Keep restrictive SELECT policies untouched.
-- 3) Replace only known permissive media SELECT policy shape.
-- 4) Restore only missing SELECT grant required for REST reads.

DO $$
DECLARE
  has_rls boolean;
  has_unexpected_permissive_select boolean;
BEGIN
  IF to_regclass('public.media_items') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.media_items ENABLE ROW LEVEL SECURITY';

    SELECT c.relrowsecurity
      INTO has_rls
    FROM pg_class c
    WHERE c.oid = 'public.media_items'::regclass;

    IF NOT COALESCE(has_rls, false) THEN
      RAISE EXCEPTION 'Refusing to grant SELECT on public.media_items: RLS is disabled';
    END IF;

    -- Protect against silently widening/altering behavior if there are
    -- unexpected permissive SELECT policies in this environment.
    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'media_items'
        AND p.cmd = 'SELECT'
        AND p.permissive = 'PERMISSIVE'
        AND p.policyname NOT IN (
          'Media viewable by members',
          'media_items_read_for_channel_members'
        )
    )
      INTO has_unexpected_permissive_select;

    IF has_unexpected_permissive_select THEN
      RAISE EXCEPTION
        'Unexpected permissive SELECT policy found on public.media_items; review required before applying migration';
    END IF;

    EXECUTE 'DROP POLICY IF EXISTS "Media viewable by members" ON public.media_items';
    EXECUTE 'DROP POLICY IF EXISTS "media_items_read_for_channel_members" ON public.media_items';

    EXECUTE '
      CREATE POLICY "media_items_read_for_channel_members"
      ON public.media_items
      FOR SELECT
      TO anon, authenticated
      USING (
        public.is_channel_server_member(
          channel_id,
          (SELECT public.requesting_user_id())
        )
      )
    ';

    -- Do not reset broad privilege state here; just restore required read grant.
    EXECUTE 'GRANT SELECT ON TABLE public.media_items TO anon, authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
