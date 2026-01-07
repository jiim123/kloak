-- Remove the redundant policy that allows all authenticated users to see all servers
DROP POLICY IF EXISTS "Servers viewable by invite code lookup" ON public.servers;

-- Create a proper policy for invite code lookups - allows seeing basic server info for joining
-- This uses a function approach to allow invite code validation
CREATE OR REPLACE FUNCTION public.get_server_by_invite_code(_invite_code text)
RETURNS TABLE(id uuid, name varchar, icon_url text, invite_code char(8))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.icon_url, s.invite_code
  FROM servers s
  WHERE s.invite_code = _invite_code
$$;