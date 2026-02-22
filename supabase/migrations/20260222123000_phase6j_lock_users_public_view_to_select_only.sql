-- Phase 6J:
-- Lock users_public view privileges for API roles to SELECT-only.
-- Even with security_invoker + users RLS, remove unnecessary write privileges.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.users_public
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.users_public TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
