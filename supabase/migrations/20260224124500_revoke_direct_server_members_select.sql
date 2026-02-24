-- Harden API surface:
-- Disable direct PostgREST table reads for server_members from client roles.
-- Clients should use guarded RPCs (for example: is_server_member/get_server_members).

REVOKE SELECT ON TABLE public.server_members FROM anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
