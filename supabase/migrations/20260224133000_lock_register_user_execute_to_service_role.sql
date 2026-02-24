-- Ensure registration RPC is only callable by trusted backend credentials.
-- This prevents bypassing edge-level captcha/origin controls via direct PostgREST RPC calls.

DO $$
BEGIN
  IF to_regprocedure('public.register_user(text,text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.register_user(text,text,text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.register_user(text,text,text) TO service_role';
  END IF;

  IF to_regprocedure('public.register_user(text,text)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.register_user(text,text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.register_user(text,text) TO service_role';
  END IF;
END
$$;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
