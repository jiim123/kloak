-- Snapshot current server-governance function definitions before hardening.
-- Run this before 20260221021500_harden_server_governance_abuse_paths.sql.

CREATE TABLE IF NOT EXISTS public.function_rollback_snapshots (
  snapshot_name text NOT NULL,
  signature text NOT NULL,
  definition text NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (snapshot_name, signature)
);

INSERT INTO public.function_rollback_snapshots (snapshot_name, signature, definition)
SELECT
  'pre_20260221021500' AS snapshot_name,
  p.oid::regprocedure::text AS signature,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'check_user_server_permission',
    'create_channel',
    'update_channel',
    'update_category',
    'move_channel_to_category',
    'set_channel_permission',
    'set_category_permission',
    'assign_role_to_member',
    'ban_member',
    'kick_member',
    'mute_member',
    'unmute_member',
    'set_role_permission',
    'delete_channel',
    'delete_category',
    'update_server_role',
    'delete_server_role',
    'reorder_channels'
  )
ON CONFLICT (snapshot_name, signature) DO NOTHING;
