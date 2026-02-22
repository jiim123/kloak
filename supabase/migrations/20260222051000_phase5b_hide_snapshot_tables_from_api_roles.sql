-- Phase 5B: remove snapshot tables from API-role visibility.
-- Targets all public tables named `_snapshot_%`.

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
    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM PUBLIC, anon, authenticated;',
      t.schema_name,
      t.table_name
    );

    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY;', t.schema_name, t.table_name);

    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I.%I;', t.schema_name, t.table_name);
    EXCEPTION WHEN OTHERS THEN
      -- table may not be in publication; ignore
      NULL;
    END;
  END LOOP;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
