-- Emergency anti-spam hardening
-- Scope:
-- 1) Disable direct public calls to register_user RPC (force trusted backend path).
-- 2) Close read-only channel bypass on direct INSERT into public.messages.
-- 3) Add minimum account age gate for sending messages.

BEGIN;

-- 1) Lock down registration RPC from public clients.
REVOKE EXECUTE ON FUNCTION public.register_user(text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO service_role;

-- 2) Replace message insert policy with explicit read-only enforcement.
DROP POLICY IF EXISTS "Users send messages as themselves only" ON public.messages;
CREATE POLICY "Users send messages as themselves only"
ON public.messages
FOR INSERT
TO public
WITH CHECK (
  user_id = requesting_user_id()
  AND requesting_user_id() IS NOT NULL
  AND is_maintenance_active() = false
  AND can_access_channel(channel_id, requesting_user_id())
  AND check_user_permission(requesting_user_id(), channel_id, 'send_messages'::permission_type)
  AND (
    COALESCE(
      (SELECT c.is_read_only FROM public.channels c WHERE c.id = channel_id),
      false
    ) = false
    OR check_user_permission(requesting_user_id(), channel_id, 'manage_messages'::permission_type)
  )
);

-- 3) Delay posting for freshly created accounts.
DROP POLICY IF EXISTS "messages_account_age_min_2m" ON public.messages;
CREATE POLICY "messages_account_age_min_2m"
ON public.messages
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = requesting_user_id()
      AND u.created_at <= now() - interval '2 minutes'
  )
);

COMMIT;

-- Rollback (manual, run only if needed):
-- BEGIN;
-- DROP POLICY IF EXISTS "messages_account_age_min_2m" ON public.messages;
-- DROP POLICY IF EXISTS "Users send messages as themselves only" ON public.messages;
-- CREATE POLICY "Users send messages as themselves only"
-- ON public.messages
-- FOR INSERT
-- TO public
-- WITH CHECK (
--   (user_id = (SELECT requesting_user_id() AS requesting_user_id))
--   AND ((SELECT requesting_user_id() AS requesting_user_id) IS NOT NULL)
--   AND (is_maintenance_active() = false)
--   AND can_access_channel(channel_id, (SELECT requesting_user_id() AS requesting_user_id))
--   AND check_user_permission((SELECT requesting_user_id() AS requesting_user_id), channel_id, 'send_messages'::permission_type)
-- );
-- GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO anon, authenticated;
-- COMMIT;
