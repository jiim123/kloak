-- Restore table-level SELECT needed for REST reads on media_comments.
-- Keep existing RLS/policy hardening intact; do not mutate policy definitions.

DO $$
DECLARE
  comments_rls_enabled boolean;
  has_select_policy boolean;
BEGIN
  IF to_regclass('public.media_comments') IS NOT NULL THEN
    SELECT c.relrowsecurity
      INTO comments_rls_enabled
    FROM pg_class c
    WHERE c.oid = 'public.media_comments'::regclass;

    SELECT EXISTS (
      SELECT 1
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = 'media_comments'
        AND p.cmd IN ('SELECT', 'ALL')
    )
      INTO has_select_policy;

    IF NOT COALESCE(comments_rls_enabled, false) OR NOT COALESCE(has_select_policy, false) THEN
      RAISE EXCEPTION 'Refusing to grant SELECT on public.media_comments: missing RLS and/or SELECT-capable policy';
    END IF;

    EXECUTE 'GRANT SELECT ON TABLE public.media_comments TO anon, authenticated';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
