-- Restore read privileges required for PostgREST embeds that reference users.
-- RLS on public.users remains the enforcement boundary.
--
-- Safety goals:
-- 1) Refuse to grant if users RLS/SELECT policy is missing.
-- 2) Avoid blanket REVOKE so we don't overwrite unrelated privilege strategy.

DO $$
DECLARE
  users_rls_enabled boolean;
  has_users_select_policy boolean;
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    SELECT c.relrowsecurity
      INTO users_rls_enabled
    FROM pg_class c
    WHERE c.oid = 'public.users'::regclass;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'users'
        AND p.cmd = 'SELECT'
    )
      INTO has_users_select_policy;

    IF NOT COALESCE(users_rls_enabled, false) OR NOT COALESCE(has_users_select_policy, false) THEN
      RAISE EXCEPTION 'Refusing to grant SELECT on public.users: missing RLS and/or SELECT policy';
    END IF;

    EXECUTE 'GRANT SELECT ON TABLE public.users TO anon, authenticated';
  END IF;

  IF to_regclass('public.users_public') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.users_public TO anon, authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
