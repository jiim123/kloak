-- Restore direct read access to threads for API roles.
-- RLS still governs row visibility; this only fixes missing table privilege.

GRANT SELECT ON TABLE public.threads TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
