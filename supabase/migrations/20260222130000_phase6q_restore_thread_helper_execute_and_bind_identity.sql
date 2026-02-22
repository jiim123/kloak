-- Phase 6Q:
-- Restore runtime execute for is_thread_channel_member used by thread RLS policies,
-- while binding helper input identity to the current caller to avoid oracle probing.

CREATE OR REPLACE FUNCTION public.is_thread_channel_member(_thread_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    _user_id IS NOT NULL
    AND public.verify_request_identity(_user_id)
    AND EXISTS (
      SELECT 1
      FROM public.threads t
      JOIN public.channels c ON c.id = t.channel_id
      JOIN public.server_members sm
        ON sm.server_id = c.server_id
       AND sm.user_id = _user_id
      WHERE t.id = _thread_id
        AND COALESCE(sm.is_banned, false) = false
    )
$function$;

REVOKE EXECUTE ON FUNCTION public.is_thread_channel_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_thread_channel_member(uuid, uuid) TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
