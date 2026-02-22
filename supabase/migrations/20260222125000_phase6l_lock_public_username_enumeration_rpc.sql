-- Phase 6L:
-- Lock check_username_available from direct client execution to reduce
-- large-scale username enumeration/squatting automation.

REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_username_available(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_username_available(text) TO service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
