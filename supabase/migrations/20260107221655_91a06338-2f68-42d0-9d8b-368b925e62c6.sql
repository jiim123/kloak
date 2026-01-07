-- Clean up unused RLS policies since we use SECURITY DEFINER RPC functions
-- The app uses custom secret key auth, not Supabase Auth, so auth.uid() based policies don't work

-- Remove the overly permissive "Anyone can register" policy (we use register_user RPC instead)
DROP POLICY IF EXISTS "Anyone can register new account" ON public.users;

-- The remaining policies are kept for defense-in-depth, but actual access goes through RPC functions:
-- - register_user: creates new users
-- - check_username_available: checks username availability  
-- - get_user_servers: fetches user's servers
-- - create_server_with_owner: creates server with all related records
-- - join_server_by_invite: joins a server
-- - get_server_channels: fetches server channels
-- - get_server_categories: fetches server categories
-- - get_server_members: fetches server members
-- - get_server_by_invite_code: looks up server by invite code