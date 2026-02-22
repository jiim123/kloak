-- Phase 6: remove dangerous direct table privileges from API-facing roles.
-- Goal:
-- 1) Keep existing CRUD/RLS behavior intact.
-- 2) Remove high-risk table privileges not needed by client runtime:
--    TRUNCATE, TRIGGER, REFERENCES.
-- 3) Add audit/assert guard functions to prevent privilege drift.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format(
      'REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE %I.%I FROM PUBLIC, anon, authenticated;',
      t.schema_name,
      t.table_name
    );
  END LOOP;
END
$$;

CREATE OR REPLACE FUNCTION public.audit_table_dangerous_privileges()
RETURNS TABLE (
  table_name text,
  grantee text,
  privilege_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    g.table_name::text,
    g.grantee::text,
    g.privilege_type::text
  FROM information_schema.role_table_grants g
  WHERE g.table_schema = 'public'
    AND g.grantee IN ('public', 'anon', 'authenticated')
    AND g.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  ORDER BY g.table_name, g.grantee, g.privilege_type
$function$;

CREATE OR REPLACE FUNCTION public.assert_no_dangerous_table_privileges()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  dangerous_count integer;
BEGIN
  SELECT count(*)
    INTO dangerous_count
  FROM public.audit_table_dangerous_privileges();

  IF dangerous_count > 0 THEN
    RAISE EXCEPTION 'Security guard failed: % dangerous table privileges remain for API roles', dangerous_count;
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_table_dangerous_privileges() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.assert_no_dangerous_table_privileges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.audit_table_dangerous_privileges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_no_dangerous_table_privileges() TO authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
