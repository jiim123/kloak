-- Hotfix after phase1/2/3 hardening:
-- Restore runtime grants required by authenticated clients while
-- keeping PUBLIC execute revoked.

-- 1) Restore EXECUTE for runtime user/session RPCs used by the app.
-- NOTE: This app uses custom key-hash auth (not Supabase Auth JWT sessions),
-- so PostgREST requests run as role `anon`. Grant to anon explicitly.
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
        'get_user_voice_settings',
        'get_user_friends',
        'update_user_last_seen'
      )
  LOOP
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO anon;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );

    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

-- 2) Restore table access needed by direct PostgREST selects.
-- RLS still controls row-level visibility; these only restore base privileges.
GRANT SELECT ON TABLE public.users TO anon;
GRANT SELECT ON TABLE public.users TO authenticated;
GRANT SELECT ON TABLE public.user_preferences TO anon;
GRANT SELECT ON TABLE public.user_preferences TO authenticated;
GRANT SELECT ON TABLE public.dm_participants TO anon;
GRANT SELECT ON TABLE public.dm_participants TO authenticated;
GRANT SELECT ON TABLE public.notifications TO anon;
GRANT SELECT ON TABLE public.notifications TO authenticated;

-- Optional preference writes from clients.
GRANT INSERT, UPDATE ON TABLE public.user_preferences TO anon;
GRANT INSERT, UPDATE ON TABLE public.user_preferences TO authenticated;
