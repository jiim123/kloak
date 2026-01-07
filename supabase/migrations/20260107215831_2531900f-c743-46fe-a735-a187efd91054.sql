-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;

-- Create a policy that allows anyone to insert a new user (for registration)
-- This is safe because:
-- 1. The username must be unique (enforced by unique constraint)
-- 2. The key_hash is what authenticates the user, not auth.uid()
-- 3. Rate limiting is enforced at the application level
CREATE POLICY "Anyone can register new account" 
ON public.users 
FOR INSERT 
WITH CHECK (true);