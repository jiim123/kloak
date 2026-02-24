-- Restore table-level SELECT needed for REST reads on declined_friend_requests.
-- Keep existing RLS/policy hardening intact; do not mutate policy definitions.

DO $$
DECLARE
  dfr_rls_enabled boolean;
  has_select_policy boolean;
BEGIN
  IF to_regclass('public.declined_friend_requests') IS NOT NULL THEN
    SELECT c.relrowsecurity
      INTO dfr_rls_enabled
    FROM pg_class c
    WHERE c.oid = 'public.declined_friend_requests'::regclass;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'declined_friend_requests'
        AND p.cmd IN ('SELECT', 'ALL')
    )
      INTO has_select_policy;

    IF NOT COALESCE(dfr_rls_enabled, false) OR NOT COALESCE(has_select_policy, false) THEN
      RAISE EXCEPTION 'Refusing to grant SELECT on public.declined_friend_requests: missing RLS and/or SELECT-capable policy';
    END IF;

    EXECUTE 'GRANT SELECT ON TABLE public.declined_friend_requests TO anon, authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
