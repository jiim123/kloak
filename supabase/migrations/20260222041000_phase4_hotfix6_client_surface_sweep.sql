-- Phase 4 hotfix 6:
-- Compatibility sweep for current frontend surface under custom key-hash auth.
-- Grants only objects actively used by client `.from(...)` reads/writes and
-- helper functions referenced by RLS predicates.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 1) Helper functions needed by policies and guarded client flows.
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
        'is_maintenance_active',
        'can_access_channel',
        'can_view_user',
        'is_channel_server_member',
        'is_server_member',
        'has_private_channel_access',
        'is_dm_participant'
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

-- 2) Table privileges used by current client direct table access.
DO $$
BEGIN
  -- Read-heavy tables
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.users TO anon, authenticated;';
  END IF;
  IF to_regclass('public.users_public') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.users_public TO anon, authenticated;';
  END IF;
  IF to_regclass('public.channels') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.channels TO anon, authenticated;';
  END IF;
  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.messages TO anon, authenticated;';
  END IF;
  IF to_regclass('public.message_attachments') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.message_attachments TO anon, authenticated;';
  END IF;
  IF to_regclass('public.reactions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.reactions TO anon, authenticated;';
  END IF;
  IF to_regclass('public.server_members') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.server_members TO anon, authenticated;';
  END IF;
  IF to_regclass('public.server_roles') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.server_roles TO anon, authenticated;';
  END IF;
  IF to_regclass('public.role_permissions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.role_permissions TO anon, authenticated;';
  END IF;
  IF to_regclass('public.channel_permissions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.channel_permissions TO anon, authenticated;';
  END IF;
  IF to_regclass('public.category_permissions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.category_permissions TO anon, authenticated;';
  END IF;
  IF to_regclass('public.server_emojis') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.server_emojis TO anon, authenticated;';
  END IF;
  IF to_regclass('public.direct_messages') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.direct_messages TO anon, authenticated;';
  END IF;
  IF to_regclass('public.dm_reactions') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.dm_reactions TO anon, authenticated;';
  END IF;
  IF to_regclass('public.dm_participants') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.dm_participants TO anon, authenticated;';
  END IF;
  IF to_regclass('public.user_badges') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.user_badges TO anon, authenticated;';
  END IF;
  IF to_regclass('public.channel_members') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.channel_members TO anon, authenticated;';
  END IF;
  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO anon, authenticated;';
  END IF;
  IF to_regclass('public.channel_user_settings') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.channel_user_settings TO anon, authenticated;';
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
