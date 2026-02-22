-- Phase 4: custom-auth compatibility with guardrails.
-- In this app, clients run as role `anon` and identity is enforced in RPCs via
-- verify_request_identity(_user_id) + x-key-hash/request headers.
-- Grant anon execute only to RPCs that already enforce this identity check.

DO $$
DECLARE
  fn record;
  fn_sql text;
BEGIN
  FOR fn IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      pg_get_functiondef(p.oid) AS function_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
  LOOP
    fn_sql := coalesce(fn.function_def, '');

    IF fn_sql ILIKE '%verify_request_identity(%' THEN
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
    END IF;
  END LOOP;
END
$$;

-- Explicit grants for common read/write helpers used by the client that are
-- already constrained by internal checks/RLS or are non-sensitive.
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
        'get_user_by_id',
        'get_user_servers',
        'get_user_server_folders',
        'get_user_dm_conversations',
        'get_user_friends',
        'get_pending_friend_requests',
        'get_outgoing_friend_requests',
        'get_blocked_users',
        'get_blocked_user_ids_for_visibility',
        'get_friend_dashboard',
        'get_dm_unread_counts',
        'get_all_channel_unread_counts',
        'mark_channel_read',
        'mark_dm_read',
        'upsert_user_preferences',
        'get_user_preferences',
        'set_dm_privacy_preference',
        'ping_health',
        'get_dm_other_participant'
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

-- Tighten direct prefs table access again; prefs are now read/written via RPC.
DO $$
BEGIN
  IF to_regclass('public.user_preferences') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT, INSERT, UPDATE ON TABLE public.user_preferences FROM anon;';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON TABLE public.user_preferences TO authenticated;';
  END IF;
END
$$;
