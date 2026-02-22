-- Phase 3 hotfix 2:
-- 1) Ensure anon/authenticated can use public schema.
-- 2) Restore remaining runtime RPC grants used by custom key-hash auth clients.
-- 3) Conditionally grant table privileges to avoid migration aborts when objects differ by env.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

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
        'get_blocked_users',
        'get_blocked_user_ids_for_visibility',
        'get_dm_unread_counts',
        'get_friend_dashboard',
        'get_outgoing_friend_requests',
        'get_pending_friend_requests',
        'get_user_dm_conversations',
        'get_user_servers',
        'get_user_server_folders',
        'get_user_voice_settings',
        'get_user_friends',
        'update_user_last_seen'
      )
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon, authenticated;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.users TO anon, authenticated;';
  END IF;

  IF to_regclass('public.notifications') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.notifications TO anon, authenticated;';
  END IF;

  IF to_regclass('public.dm_participants') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.dm_participants TO anon, authenticated;';
  END IF;

  IF to_regclass('public.user_preferences') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.user_preferences TO anon, authenticated;';
  END IF;
END
$$;
