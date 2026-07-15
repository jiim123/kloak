-- The mobile app authenticates requests with Kloak's x-key-hash header on the
-- publishable client, so push token writes need anon table privileges. RLS still
-- limits rows to public.requesting_user_id().
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_tokens TO anon, authenticated;

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END
$$;
