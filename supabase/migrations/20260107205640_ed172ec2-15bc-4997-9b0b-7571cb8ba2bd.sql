-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS "Servers are viewable by everyone" ON public.servers;

-- Create helper function to check if users share a server
CREATE OR REPLACE FUNCTION public.shares_server_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM server_members sm1
    JOIN server_members sm2 ON sm1.server_id = sm2.server_id
    WHERE sm1.user_id = _user_id 
    AND sm2.user_id = _other_user_id
    AND sm1.is_banned = false 
    AND sm2.is_banned = false
  )
$$;

-- Create helper function to check if users are in a DM together
CREATE OR REPLACE FUNCTION public.shares_dm_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dm_participants dp1
    JOIN dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
    WHERE dp1.user_id = _user_id 
    AND dp2.user_id = _other_user_id
  )
$$;

-- Create helper function to check if users are friends
CREATE OR REPLACE FUNCTION public.is_friend_with(_user_id uuid, _other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM friendships
    WHERE status = 'accepted'
    AND (
      (requester_id = _user_id AND addressee_id = _other_user_id)
      OR (requester_id = _other_user_id AND addressee_id = _user_id)
    )
  )
$$;

-- Users policy: viewable by self, shared server members, friends, or DM participants
CREATE POLICY "Users viewable by related users"
ON public.users
FOR SELECT
USING (
  auth.uid() IS NOT NULL AND (
    id = auth.uid()
    OR public.shares_server_with(auth.uid(), id)
    OR public.is_friend_with(auth.uid(), id)
    OR public.shares_dm_with(auth.uid(), id)
  )
);

-- Servers policy: viewable by members only
CREATE POLICY "Servers viewable by members"
ON public.servers
FOR SELECT
USING (
  public.is_server_member(auth.uid(), id)
);

-- Allow looking up servers by invite code for joining (unauthenticated lookup for invite validation)
CREATE POLICY "Servers viewable by invite code lookup"
ON public.servers
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);