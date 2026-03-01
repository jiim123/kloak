
-- ============================================================
-- SECURITY FIX: Set search_path on all 15 functions missing it
-- Prevents search_path injection attacks (Supabase linter 0011)
-- ============================================================

-- 1. assign_role_to_member
ALTER FUNCTION public.assign_role_to_member(_user_id uuid, _member_id uuid, _role_id uuid)
SET search_path = public;

-- 2. change_member_role
ALTER FUNCTION public.change_member_role(_user_id uuid, _server_id uuid, _target_user_id uuid, _new_role server_role)
SET search_path = public;

-- 3. check_user_permission
ALTER FUNCTION public.check_user_permission(_user_id uuid, _channel_id uuid, _permission permission_type)
SET search_path = public;

-- 4. check_user_server_permission
ALTER FUNCTION public.check_user_server_permission(_user_id uuid, _server_id uuid, _permission permission_type)
SET search_path = public;

-- 5. is_safe_storage_object_key
ALTER FUNCTION public.is_safe_storage_object_key(_bucket_id text, _name text)
SET search_path = public;

-- 6. is_unicode_emoji
ALTER FUNCTION public.is_unicode_emoji(_emoji text)
SET search_path = public;

-- 7. kick_member
ALTER FUNCTION public.kick_member(_user_id uuid, _server_id uuid, _target_user_id uuid)
SET search_path = public;

-- 8. mute_member
ALTER FUNCTION public.mute_member(_user_id uuid, _server_id uuid, _target_user_id uuid, _mute boolean)
SET search_path = public;

-- 9. prevent_self_privilege_escalation
ALTER FUNCTION public.prevent_self_privilege_escalation()
SET search_path = public;

-- 10. process_message_mentions
ALTER FUNCTION public.process_message_mentions()
SET search_path = public;

-- 11. remove_role_from_member
ALTER FUNCTION public.remove_role_from_member(_user_id uuid, _member_id uuid, _role_id uuid)
SET search_path = public;

-- 12. send_message
ALTER FUNCTION public.send_message(_user_id uuid, _channel_id uuid, _content text, _reply_to_id uuid)
SET search_path = public;

-- 13. trigger_dm_notification
ALTER FUNCTION public.trigger_dm_notification()
SET search_path = public;

-- 14. upsert_user_preferences
ALTER FUNCTION public.upsert_user_preferences(_user_id uuid, _prefs jsonb)
SET search_path = public;

-- 15. validate_dm_reaction_emoji
ALTER FUNCTION public.validate_dm_reaction_emoji(_emoji text)
SET search_path = public;
