-- Custom-auth clients call RPCs with the Supabase anon DB role, then the
-- SECURITY DEFINER function verifies the real user through verify_request_identity.
-- Keep PUBLIC revoked, but allow the runtime roles that can pass the function's
-- identity and participant checks.

REVOKE EXECUTE ON FUNCTION public.send_dm(uuid, uuid, text, uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_dm(uuid, uuid, text, uuid, uuid[]) TO anon, authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'send_dm'
      AND pg_get_function_identity_arguments(p.oid) = '_conversation_id uuid, _sender_id uuid, _content text, _reply_to_id uuid'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.send_dm(uuid, uuid, text, uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.send_dm(uuid, uuid, text, uuid) TO anon, authenticated, service_role;
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
END
$$;