-- Server emojis are intended to be usable globally (cross-server).
-- This migration makes `server_emojis` SELECT public again so any client can
-- resolve `:name:` → image URL when viewing messages outside the emoji's server.
--
-- Important: direct INSERT/UPDATE/DELETE should not be allowed; mutations must go
-- through SECURITY DEFINER RPCs that enforce permissions (upload/rename/delete).

ALTER TABLE public.server_emojis ENABLE ROW LEVEL SECURITY;

-- Drop previous policies (names vary across earlier migrations).
DROP POLICY IF EXISTS "Server emojis viewable by members" ON public.server_emojis;
DROP POLICY IF EXISTS "Server emojis are viewable" ON public.server_emojis;
DROP POLICY IF EXISTS "Server emojis are viewable by everyone" ON public.server_emojis;

DROP POLICY IF EXISTS "Server emojis can be inserted" ON public.server_emojis;
DROP POLICY IF EXISTS "Server emojis can be updated" ON public.server_emojis;
DROP POLICY IF EXISTS "Server emojis can be deleted" ON public.server_emojis;

-- Publicly viewable so emojis render for everyone.
CREATE POLICY "Server emojis are viewable by everyone"
  ON public.server_emojis
  FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies: direct writes are denied under RLS.

