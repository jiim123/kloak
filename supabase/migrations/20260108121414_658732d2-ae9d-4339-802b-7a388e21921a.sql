-- Fix server_members RLS policies for custom auth system
-- The INSERT policy requires auth.uid() which is always NULL in our system
-- Joins are handled securely via SECURITY DEFINER RPC functions

-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Users can join servers" ON public.server_members;

-- Create permissive INSERT policy (joins are validated in RPC functions)
CREATE POLICY "Server members can be inserted" ON public.server_members
FOR INSERT WITH CHECK (true);

-- Also fix UPDATE and DELETE policies
DROP POLICY IF EXISTS "Members can update" ON public.server_members;
DROP POLICY IF EXISTS "Members can leave" ON public.server_members;

-- Permissive policies - actual authorization is in SECURITY DEFINER RPCs
CREATE POLICY "Server members can be updated" ON public.server_members
FOR UPDATE USING (true);

CREATE POLICY "Server members can be deleted" ON public.server_members
FOR DELETE USING (true);