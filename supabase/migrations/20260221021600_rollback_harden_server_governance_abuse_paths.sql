-- Rollback for 20260221021500_harden_server_governance_abuse_paths.sql
-- Restores function definitions from snapshot pre_20260221021500.
--
-- Prerequisite:
--   20260221021450_snapshot_server_governance_functions.sql must have been run
--   before the hardening migration.

DO $$
DECLARE
  r record;
  _expected_count int := 18;
  _actual_count int;
BEGIN
  SELECT count(*) INTO _actual_count
  FROM public.function_rollback_snapshots
  WHERE snapshot_name = 'pre_20260221021500';

  IF _actual_count < _expected_count THEN
    RAISE EXCEPTION
      'Rollback snapshot pre_20260221021500 is incomplete or missing (found %, expected at least %).',
      _actual_count, _expected_count;
  END IF;

  FOR r IN
    SELECT signature, definition
    FROM public.function_rollback_snapshots
    WHERE snapshot_name = 'pre_20260221021500'
      AND (
        signature LIKE 'public.check_user_server_permission(%'
        OR signature LIKE 'public.create_channel(%'
        OR signature LIKE 'public.update_channel(%'
        OR signature LIKE 'public.update_category(%'
        OR signature LIKE 'public.move_channel_to_category(%'
        OR signature LIKE 'public.set_channel_permission(%'
        OR signature LIKE 'public.set_category_permission(%'
        OR signature LIKE 'public.assign_role_to_member(%'
        OR signature LIKE 'public.ban_member(%'
        OR signature LIKE 'public.kick_member(%'
        OR signature LIKE 'public.mute_member(%'
        OR signature LIKE 'public.unmute_member(%'
        OR signature LIKE 'public.set_role_permission(%'
        OR signature LIKE 'public.delete_channel(%'
        OR signature LIKE 'public.delete_category(%'
        OR signature LIKE 'public.update_server_role(%'
        OR signature LIKE 'public.delete_server_role(%'
        OR signature LIKE 'public.reorder_channels(%'
      )
    ORDER BY signature
  LOOP
    EXECUTE r.definition;
  END LOOP;
END;
$$;
