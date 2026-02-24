-- Hotfix:
-- Remove legacy server_emojis SELECT policies that either leak data or
-- require direct table privileges on server_members.

ALTER TABLE public.server_emojis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read server emojis" ON public.server_emojis;
DROP POLICY IF EXISTS "Members can read server emojis" ON public.server_emojis;
DROP POLICY IF EXISTS "Server emojis are viewable by everyone" ON public.server_emojis;

DROP POLICY IF EXISTS "Server emojis viewable by server members only" ON public.server_emojis;
CREATE POLICY "Server emojis viewable by server members only"
ON public.server_emojis
FOR SELECT
TO anon, authenticated
USING (
  public.requesting_user_id() IS NOT NULL
  AND public.is_server_member(server_id, public.requesting_user_id())
);

DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
  PERFORM pg_notify('pgrst', 'reload config');
END
$$;
