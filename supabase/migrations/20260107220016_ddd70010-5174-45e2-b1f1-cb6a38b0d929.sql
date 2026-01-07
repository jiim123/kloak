-- Drop the existing insert policy
DROP POLICY IF EXISTS "Anyone can register new account" ON public.users;

-- Create a PERMISSIVE policy that allows public registration
-- Using explicit PERMISSIVE keyword to ensure it's permissive
CREATE POLICY "Anyone can register new account" 
ON public.users 
AS PERMISSIVE
FOR INSERT 
TO anon, authenticated
WITH CHECK (true);