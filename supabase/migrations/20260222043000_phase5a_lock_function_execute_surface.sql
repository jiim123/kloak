-- Phase 5A: lock function execute surface.
-- Strategy:
-- 1) Revoke EXECUTE from PUBLIC/anon/authenticated on all public functions.
-- 2) Re-grant only a strict app/runtime allowlist.
--
-- This keeps custom key-hash auth working (anon runtime role) while reducing
-- function-level attack surface for production.

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
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated;',
      fn.schema_name,
      fn.function_name,
      fn.identity_args
    );
  END LOOP;
END
$$;

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
        -- Public/bootstrap endpoints
        'check_username_available',
        'get_explore_servers',
        'get_invite_details_by_code',
        'get_maintenance_mode',
        'login_user',

        -- Core identity/helper functions used by RLS or guarded RPC paths
        'assert_request_user',
        'request_client_identifier',
        'requesting_user_id',
        'get_request_user_id',
        'verify_request_identity',
        'is_maintenance_active',
        'check_rate_limit',
        'can_access_channel',
        'can_view_user',
        'is_channel_server_member',
        'is_server_member',
        'is_dm_participant',
        'has_private_channel_access',
        'check_user_permission',
        'check_user_server_permission',
        'is_friend_with',
        'shares_server_with',
        'shares_dm_with',

        -- App RPC allowlist (derived from current frontend usage)
        'accept_friend_request',
        'add_channel_member',
        'add_dm_reaction',
        'add_group_dm_members',
        'add_reaction',
        'ban_member',
        'block_user',
        'change_member_role',
        'check_username_available',
        'close_expired_polls',
        'close_poll',
        'create_category',
        'create_channel',
        'create_group_dm',
        'create_server_invite',
        'create_server_role',
        'create_server_with_owner',
        'create_thread',
        'debug_user_permission',
        'decline_friend_request',
        'delete_category',
        'delete_channel',
        'delete_dm',
        'delete_message',
        'delete_server',
        'delete_server_role',
        'delete_thread_message',
        'delete_user_account',
        'edit_dm',
        'edit_message',
        'get_all_channel_unread_counts',
        'get_banned_members',
        'get_blocked_user_ids_for_visibility',
        'get_blocked_users',
        'get_channel_members',
        'get_deletion_preview',
        'get_dm_messages',
        'get_dm_other_participant',
        'get_dm_unread_counts',
        'get_friend_dashboard',
        'get_invite_details_by_code',
        'get_outgoing_friend_requests',
        'get_pending_friend_requests',
        'get_server_categories',
        'get_server_channels',
        'get_server_members',
        'get_user_by_id',
        'get_user_dm_conversations',
        'get_user_friends',
        'get_user_preferences',
        'get_user_server_folders',
        'get_user_servers',
        'join_server_by_invite',
        'kick_group_dm_member',
        'kick_member',
        'leave_group_dm',
        'leave_server',
        'list_server_invites',
        'mark_channel_read',
        'mark_dm_read',
        'open_dm_conversation',
        'ping_health',
        'pin_message',
        'remove_channel_member',
        'remove_dm_reaction',
        'remove_friend',
        'remove_reaction',
        'reorder_user_servers',
        'reset_user_secret_key',
        'revoke_server_invite',
        'save_user_server_folders',
        'search_messages',
        'send_dm',
        'send_friend_request',
        'send_message',
        'send_poll',
        'send_thread_message',
        'set_channel_permission',
        'set_dm_privacy_preference',
        'set_message_embed_hidden',
        'set_role_permission',
        'toggle_mute_member',
        'transfer_ownership',
        'unban_member',
        'unblock_user',
        'update_category',
        'update_channel',
        'update_group_dm_name',
        'update_member_nickname',
        'update_server',
        'update_server_role',
        'update_user_last_seen',
        'update_user_profile',
        'update_user_status',
        'upsert_user_preferences',
        'vote_poll'
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
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
