-- RLS policies call requesting_user_id() as the API role, so anon/authenticated
-- need EXECUTE on this helper even though it only resolves the caller from
-- request headers. Keep the lower-level helpers service_role-only.

GRANT EXECUTE ON FUNCTION public.requesting_user_id() TO anon, authenticated, service_role;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
