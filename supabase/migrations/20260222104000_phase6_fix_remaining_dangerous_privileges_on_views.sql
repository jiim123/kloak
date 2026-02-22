-- Phase 6 follow-up:
-- Revoke any remaining dangerous privileges (TRUNCATE/TRIGGER/REFERENCES)
-- for API roles on all public relations, including views like users_public.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT
      g.table_name,
      g.privilege_type
    FROM information_schema.role_table_grants g
    WHERE g.table_schema = 'public'
      AND g.grantee IN ('public', 'anon', 'authenticated')
      AND g.privilege_type IN ('TRUNCATE', 'TRIGGER', 'REFERENCES')
  LOOP
    EXECUTE format(
      'REVOKE %s ON TABLE %I.%I FROM PUBLIC, anon, authenticated;',
      r.privilege_type,
      'public',
      r.table_name
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
