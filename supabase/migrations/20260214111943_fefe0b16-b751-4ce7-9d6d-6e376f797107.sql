
-- Phase 3: Hide key_hash via column-level privilege revocation
-- This prevents any client query from reading key_hash, even with SELECT *
-- FK joins in message queries still work but won't include key_hash
REVOKE SELECT (key_hash) ON public.users FROM anon;
REVOKE SELECT (key_hash) ON public.users FROM authenticated;

-- Also hide last_key_reset_at if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'last_key_reset_at'
  ) THEN
    EXECUTE 'REVOKE SELECT (last_key_reset_at) ON public.users FROM anon';
    EXECUTE 'REVOKE SELECT (last_key_reset_at) ON public.users FROM authenticated';
  END IF;
END $$;
