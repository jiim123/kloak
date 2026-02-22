-- Phase 4 hotfix 3:
-- Fix remaining runtime permission errors for custom key-hash auth clients
-- and force PostgREST schema cache refresh.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1) Grant execute on helper and app RPCs currently erroring.
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
        'requesting_user_id',
        'get_server_members',
        'get_user_preferences'
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

-- 2) Restore direct table privileges used by current client code paths.
-- RLS policies still enforce row-level visibility.
DO $$
BEGIN
  IF to_regclass('public.channels') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.channels TO anon, authenticated;';
  END IF;

  IF to_regclass('public.role_permissions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.role_permissions TO anon, authenticated;';
  END IF;

  IF to_regclass('public.server_roles') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.server_roles TO anon, authenticated;';
  END IF;

  IF to_regclass('public.server_emojis') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.server_emojis TO anon, authenticated;';
  END IF;

  IF to_regclass('public.channel_user_settings') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.channel_user_settings TO anon, authenticated;';
  END IF;
END
$$;

-- 3) Force PostgREST to refresh schema cache so new RPCs/FKs are visible.
-- Needed for PGRST202/PGRST200 after migrations.
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
