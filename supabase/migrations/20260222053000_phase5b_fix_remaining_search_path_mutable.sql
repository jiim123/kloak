-- Phase 5B: fix remaining `function_search_path_mutable` warnings.
-- Applies a fixed search_path to known warned functions in `public`.

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
        'enforce_friendship_pending_on_insert',
        'prevent_friendship_identity_change',
        'update_task_updated_at',
        'update_voice_settings_timestamp',
        'delete_old_declined_requests',
        'enforce_server_emoji_limit',
        'prevent_channel_member_identity_change',
        'prevent_device_key_change',
        'prevent_server_member_privilege_change',
        'rate_limit_channel_creation',
        'reset_mention_count_on_read',
        'update_modified_column',
        'is_maintenance_active'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
