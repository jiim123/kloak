-- Phase 5B: add auditable guard for function execute surface.
-- Run in CI/predeploy:
--   select * from public.audit_function_execute_surface();
--   select public.assert_function_execute_surface_strict();

CREATE OR REPLACE FUNCTION public.audit_function_execute_surface()
RETURNS TABLE (
  function_name text,
  identity_args text,
  is_security_definer boolean,
  public_exec boolean,
  anon_exec boolean,
  authenticated_exec boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    p.proname::text AS function_name,
    pg_get_function_identity_arguments(p.oid)::text AS identity_args,
    p.prosecdef AS is_security_definer,
    has_function_privilege('public', p.oid, 'EXECUTE') AS public_exec,
    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_exec
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
$function$;

CREATE OR REPLACE FUNCTION public.assert_function_execute_surface_strict()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  public_exec_count integer;
BEGIN
  SELECT count(*)
    INTO public_exec_count
  FROM public.audit_function_execute_surface()
  WHERE public_exec = true;

  IF public_exec_count > 0 THEN
    RAISE EXCEPTION 'Security guard failed: % public functions still executable by PUBLIC', public_exec_count;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_function_execute_surface() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assert_function_execute_surface_strict() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_function_execute_surface() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_function_execute_surface_strict() TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
