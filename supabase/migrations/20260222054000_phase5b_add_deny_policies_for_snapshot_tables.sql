-- Phase 5B cleanup:
-- Resolve advisor INFO `rls_enabled_no_policy` for snapshot tables by adding
-- explicit deny-all policies.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT n.nspname AS schema_name, c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relname LIKE '\_snapshot\_%' ESCAPE '\'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', t.schema_name, t.table_name);

    EXECUTE format('DROP POLICY IF EXISTS "snapshot_deny_all_select" ON %I.%I;', t.schema_name, t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "snapshot_deny_all_insert" ON %I.%I;', t.schema_name, t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "snapshot_deny_all_update" ON %I.%I;', t.schema_name, t.table_name);
    EXECUTE format('DROP POLICY IF EXISTS "snapshot_deny_all_delete" ON %I.%I;', t.schema_name, t.table_name);

    EXECUTE format('CREATE POLICY "snapshot_deny_all_select" ON %I.%I FOR SELECT USING (false);', t.schema_name, t.table_name);
    EXECUTE format('CREATE POLICY "snapshot_deny_all_insert" ON %I.%I FOR INSERT WITH CHECK (false);', t.schema_name, t.table_name);
    EXECUTE format('CREATE POLICY "snapshot_deny_all_update" ON %I.%I FOR UPDATE USING (false) WITH CHECK (false);', t.schema_name, t.table_name);
    EXECUTE format('CREATE POLICY "snapshot_deny_all_delete" ON %I.%I FOR DELETE USING (false);', t.schema_name, t.table_name);
  END LOOP;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
