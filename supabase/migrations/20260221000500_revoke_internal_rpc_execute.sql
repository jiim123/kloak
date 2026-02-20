-- Revoke anon/authenticated EXECUTE on internal/debug/helper RPCs that
-- should not be directly callable from public clients.

DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'debug_request_headers',
        'debug_channel_permissions',
        'debug_server_system_messages',
        'debug_user_permission',
        'assert_request_user',
        'can_access_channel',
        'can_view_user',
        'check_user_permission',
        'check_user_server_permission',
        'check_server_membership',
        'check_e2e_status',
        'count_available_prekeys',
        'delete_old_declined_requests',
        'create_notification'
      )
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated',
      f.schema_name,
      f.function_name,
      f.identity_args
    );
  END LOOP;
END $$;
