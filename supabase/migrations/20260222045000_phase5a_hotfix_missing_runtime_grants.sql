-- Phase 5A hotfix:
-- Restore missed runtime grants after function execute surface lock-down.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1) Missed RPC grants
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_user_voice_settings',
        'delete_server_emoji',
        'assign_role_to_member'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon, authenticated;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- 2) Missed table grants for embedded reads
DO $$
BEGIN
  IF to_regclass('public.badges') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.badges TO anon, authenticated;';
  END IF;

  IF to_regclass('public.polls') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.polls TO anon, authenticated;';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
