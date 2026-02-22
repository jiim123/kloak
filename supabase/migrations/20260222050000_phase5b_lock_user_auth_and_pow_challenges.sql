-- Phase 5B: lock sensitive auth/anti-abuse tables behind RPC-only access.
-- Applies to:
--   - public.user_auth
--   - public.pow_challenges

GRANT USAGE ON SCHEMA public TO anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.user_auth') IS NOT NULL THEN
    -- No direct table access from anon/authenticated/public.
    EXECUTE 'REVOKE ALL ON TABLE public.user_auth FROM PUBLIC, anon, authenticated;';

    -- Ensure RLS is enabled.
    EXECUTE 'ALTER TABLE public.user_auth ENABLE ROW LEVEL SECURITY;';

    -- Replace any permissive policies with explicit deny-all policies.
    EXECUTE 'DROP POLICY IF EXISTS "ua_deny_all_select" ON public.user_auth;';
    EXECUTE 'DROP POLICY IF EXISTS "ua_deny_all_insert" ON public.user_auth;';
    EXECUTE 'DROP POLICY IF EXISTS "ua_deny_all_update" ON public.user_auth;';
    EXECUTE 'DROP POLICY IF EXISTS "ua_deny_all_delete" ON public.user_auth;';

    EXECUTE 'CREATE POLICY "ua_deny_all_select" ON public.user_auth FOR SELECT USING (false);';
    EXECUTE 'CREATE POLICY "ua_deny_all_insert" ON public.user_auth FOR INSERT WITH CHECK (false);';
    EXECUTE 'CREATE POLICY "ua_deny_all_update" ON public.user_auth FOR UPDATE USING (false) WITH CHECK (false);';
    EXECUTE 'CREATE POLICY "ua_deny_all_delete" ON public.user_auth FOR DELETE USING (false);';
  END IF;

  IF to_regclass('public.pow_challenges') IS NOT NULL THEN
    -- No direct table access from anon/authenticated/public.
    EXECUTE 'REVOKE ALL ON TABLE public.pow_challenges FROM PUBLIC, anon, authenticated;';

    -- Ensure RLS is enabled.
    EXECUTE 'ALTER TABLE public.pow_challenges ENABLE ROW LEVEL SECURITY;';

    -- Replace any permissive policies with explicit deny-all policies.
    EXECUTE 'DROP POLICY IF EXISTS "pow_deny_all_select" ON public.pow_challenges;';
    EXECUTE 'DROP POLICY IF EXISTS "pow_deny_all_insert" ON public.pow_challenges;';
    EXECUTE 'DROP POLICY IF EXISTS "pow_deny_all_update" ON public.pow_challenges;';
    EXECUTE 'DROP POLICY IF EXISTS "pow_deny_all_delete" ON public.pow_challenges;';

    EXECUTE 'CREATE POLICY "pow_deny_all_select" ON public.pow_challenges FOR SELECT USING (false);';
    EXECUTE 'CREATE POLICY "pow_deny_all_insert" ON public.pow_challenges FOR INSERT WITH CHECK (false);';
    EXECUTE 'CREATE POLICY "pow_deny_all_update" ON public.pow_challenges FOR UPDATE USING (false) WITH CHECK (false);';
    EXECUTE 'CREATE POLICY "pow_deny_all_delete" ON public.pow_challenges FOR DELETE USING (false);';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
