-- Enable RLS on user_server_folders table
ALTER TABLE public.user_server_folders ENABLE ROW LEVEL SECURITY;

-- Create permissive policies for user_server_folders (using true since app uses custom auth)
-- These policies allow CRUD operations while RLS is enabled
CREATE POLICY "User folders are viewable"
ON public.user_server_folders
FOR SELECT
USING (true);

CREATE POLICY "User folders can be inserted"
ON public.user_server_folders
FOR INSERT
WITH CHECK (true);

CREATE POLICY "User folders can be updated"
ON public.user_server_folders
FOR UPDATE
USING (true);

CREATE POLICY "User folders can be deleted"
ON public.user_server_folders
FOR DELETE
USING (true);