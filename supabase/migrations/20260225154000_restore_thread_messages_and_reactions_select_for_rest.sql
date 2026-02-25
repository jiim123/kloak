-- Restore table-level SELECT required for REST reads on forum reactions/messages.
-- Keep existing RLS hardening intact and refuse to grant if protections are missing.

DO $$
DECLARE
  thread_messages_rls_enabled boolean;
  thread_messages_has_select_policy boolean;
  thread_reactions_rls_enabled boolean;
  thread_reactions_has_select_policy boolean;
BEGIN
  IF to_regclass('public.thread_messages') IS NOT NULL THEN
    SELECT c.relrowsecurity
      INTO thread_messages_rls_enabled
    FROM pg_class c
    WHERE c.oid = 'public.thread_messages'::regclass;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'thread_messages'
        AND p.cmd IN ('SELECT', 'ALL')
    )
      INTO thread_messages_has_select_policy;

    IF NOT COALESCE(thread_messages_rls_enabled, false)
       OR NOT COALESCE(thread_messages_has_select_policy, false) THEN
      RAISE EXCEPTION
        'Refusing to grant SELECT on public.thread_messages: missing RLS and/or SELECT-capable policy';
    END IF;

    EXECUTE 'GRANT SELECT ON TABLE public.thread_messages TO anon, authenticated';
  END IF;

  IF to_regclass('public.thread_reactions') IS NOT NULL THEN
    SELECT c.relrowsecurity
      INTO thread_reactions_rls_enabled
    FROM pg_class c
    WHERE c.oid = 'public.thread_reactions'::regclass;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'thread_reactions'
        AND p.cmd IN ('SELECT', 'ALL')
    )
      INTO thread_reactions_has_select_policy;

    IF NOT COALESCE(thread_reactions_rls_enabled, false)
       OR NOT COALESCE(thread_reactions_has_select_policy, false) THEN
      RAISE EXCEPTION
        'Refusing to grant SELECT on public.thread_reactions: missing RLS and/or SELECT-capable policy';
    END IF;

    EXECUTE 'GRANT SELECT ON TABLE public.thread_reactions TO anon, authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;

