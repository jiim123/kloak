
-- FIX 1 (CRITICAL): Restrict debug functions from anon/public access
REVOKE EXECUTE ON FUNCTION public.debug_channel_permissions(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.debug_server_system_messages(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.debug_user_permission(uuid, uuid, permission_type) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.debug_request_headers() FROM anon, authenticated, public;

-- FIX 2+3 (HIGH): Content filtering + account age on thread_messages
CREATE POLICY "block_spam_thread_content"
ON public.thread_messages AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (message_content_allowed(content));

CREATE POLICY "thread_messages_account_age_min_5m"
ON public.thread_messages AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (EXISTS (SELECT 1 FROM users u WHERE u.id = requesting_user_id() AND u.created_at <= (now() - interval '5 minutes')));

-- FIX 4 (HIGH): Content filtering on direct_messages
CREATE POLICY "block_spam_dm_content"
ON public.direct_messages AS RESTRICTIVE FOR INSERT TO public
WITH CHECK (message_content_allowed(content));
