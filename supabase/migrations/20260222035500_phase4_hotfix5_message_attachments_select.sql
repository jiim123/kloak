-- Phase 4 hotfix 5:
-- Fix permission denied on embedded message_attachments reads from messages queries.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.message_attachments') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON TABLE public.message_attachments TO anon, authenticated;';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
