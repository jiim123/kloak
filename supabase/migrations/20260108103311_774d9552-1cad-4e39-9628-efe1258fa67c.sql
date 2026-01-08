-- Fix storage policies - allow uploads without auth.uid() checks
-- Since we use custom secret-key auth, auth.uid() is always NULL

-- Drop restrictive storage policies that use auth.uid()
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their avatar" ON storage.objects;
DROP POLICY IF EXISTS "Server owners can upload icons" ON storage.objects;
DROP POLICY IF EXISTS "Server owners can update icons" ON storage.objects;
DROP POLICY IF EXISTS "Server owners can delete icons" ON storage.objects;
DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update server icons" ON storage.objects;

-- Create permissive storage policies for our custom auth system
-- Uploads are handled via SECURITY DEFINER RPC functions or direct client calls
CREATE POLICY "Allow avatar uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Allow avatar updates" ON storage.objects
FOR UPDATE USING (bucket_id = 'avatars');

CREATE POLICY "Allow avatar deletes" ON storage.objects
FOR DELETE USING (bucket_id = 'avatars');

CREATE POLICY "Allow server icon uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'server-icons');

CREATE POLICY "Allow server icon updates" ON storage.objects
FOR UPDATE USING (bucket_id = 'server-icons');

CREATE POLICY "Allow server icon deletes" ON storage.objects
FOR DELETE USING (bucket_id = 'server-icons');

CREATE POLICY "Allow attachment uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'attachments');

CREATE POLICY "Allow attachment updates" ON storage.objects
FOR UPDATE USING (bucket_id = 'attachments');

CREATE POLICY "Allow attachment deletes" ON storage.objects
FOR DELETE USING (bucket_id = 'attachments');

-- Fix user_preferences policies - allow inserts without auth.uid() check
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;

-- User preferences are managed via application logic, not auth.uid()
CREATE POLICY "User preferences are viewable" ON public.user_preferences
FOR SELECT USING (true);

CREATE POLICY "User preferences can be inserted" ON public.user_preferences
FOR INSERT WITH CHECK (true);

CREATE POLICY "User preferences can be updated" ON public.user_preferences
FOR UPDATE USING (true);

-- Fix channel_reads policies
DROP POLICY IF EXISTS "Channel reads viewable" ON public.channel_reads;
DROP POLICY IF EXISTS "Users can track reads" ON public.channel_reads;
DROP POLICY IF EXISTS "Users can update reads" ON public.channel_reads;

CREATE POLICY "Channel reads are viewable" ON public.channel_reads
FOR SELECT USING (true);

CREATE POLICY "Channel reads can be inserted" ON public.channel_reads
FOR INSERT WITH CHECK (true);

CREATE POLICY "Channel reads can be updated" ON public.channel_reads
FOR UPDATE USING (true);