-- Phase 4 hotfix 4:
-- Fix remaining permission denials for messages/channel_permissions reads and
-- channel visibility helper functions invoked by RLS policies.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1) Grant execute on helper functions referenced by RLS/policy predicates.
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
        'has_private_channel_access',
        'can_access_channel',
        'is_channel_server_member',
        'is_server_member',
        'requesting_user_id'
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

-- 2) Restore direct table SELECT privileges used by current client query paths.
-- Row-level filtering still happens in RLS policies.
DO $$
BEGIN
  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.messages TO anon, authenticated;';
  END IF;

  IF to_regclass('public.channel_permissions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.channel_permissions TO anon, authenticated;';
  END IF;

  IF to_regclass('public.channels') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.channels TO anon, authenticated;';
  END IF;
END
$$;

-- 3) Refresh PostgREST cache after grants/function exposure updates.
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
