-- Restore minimal table-level grants required by current forum client flows.
-- Security posture:
-- - keep RLS mandatory
-- - require matching policies to exist before granting
-- - grant only capabilities already constrained by RLS predicates

DO $$
DECLARE
  tm_rls_enabled boolean;
  tm_has_select_policy boolean;
  tm_has_update_policy boolean;
  tr_rls_enabled boolean;
  tr_has_select_policy boolean;
  tr_has_insert_policy boolean;
  tr_has_delete_policy boolean;
BEGIN
  IF to_regclass('public.thread_messages') IS NOT NULL THEN
    SELECT c.relrowsecurity
      INTO tm_rls_enabled
    FROM pg_class c
    WHERE c.oid = 'public.thread_messages'::regclass;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'thread_messages'
        AND p.cmd IN ('SELECT', 'ALL')
    )
      INTO tm_has_select_policy;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'thread_messages'
        AND p.cmd IN ('UPDATE', 'ALL')
    )
      INTO tm_has_update_policy;

    IF NOT COALESCE(tm_rls_enabled, false)
       OR NOT COALESCE(tm_has_select_policy, false)
       OR NOT COALESCE(tm_has_update_policy, false) THEN
      RAISE EXCEPTION
        'Refusing to grant on public.thread_messages: missing RLS and/or SELECT/UPDATE-capable policies';
    END IF;

    EXECUTE 'GRANT SELECT, UPDATE ON TABLE public.thread_messages TO anon, authenticated';
  END IF;

  IF to_regclass('public.thread_reactions') IS NOT NULL THEN
    SELECT c.relrowsecurity
      INTO tr_rls_enabled
    FROM pg_class c
    WHERE c.oid = 'public.thread_reactions'::regclass;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'thread_reactions'
        AND p.cmd IN ('SELECT', 'ALL')
    )
      INTO tr_has_select_policy;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'thread_reactions'
        AND p.cmd IN ('INSERT', 'ALL')
    )
      INTO tr_has_insert_policy;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'thread_reactions'
        AND p.cmd IN ('DELETE', 'ALL')
    )
      INTO tr_has_delete_policy;

    IF NOT COALESCE(tr_rls_enabled, false)
       OR NOT COALESCE(tr_has_select_policy, false)
       OR NOT COALESCE(tr_has_insert_policy, false)
       OR NOT COALESCE(tr_has_delete_policy, false) THEN
      RAISE EXCEPTION
        'Refusing to grant on public.thread_reactions: missing RLS and/or SELECT/INSERT/DELETE policies';
    END IF;

    EXECUTE 'GRANT SELECT, INSERT, DELETE ON TABLE public.thread_reactions TO anon, authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
