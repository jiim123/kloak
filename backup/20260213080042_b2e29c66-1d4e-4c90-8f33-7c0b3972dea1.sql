
-- 1. Create helper function to extract user ID from x-key-hash header
CREATE OR REPLACE FUNCTION public.get_request_user_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _key_hash text;
  _user_id uuid;
BEGIN
  _key_hash := current_setting('request.headers', true)::json->>'x-key-hash';
  IF _key_hash IS NULL OR _key_hash = '' THEN
    RETURN NULL;
  END IF;
  SELECT id INTO _user_id FROM users WHERE key_hash = _key_hash LIMIT 1;
  RETURN _user_id;
END;
$$;

-- 2. Drop all existing insecure INSERT/UPDATE/DELETE policies on storage.objects

-- Avatars
DROP POLICY IF EXISTS "Allow avatar uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar deletes" ON storage.objects;

-- Attachments
DROP POLICY IF EXISTS "Allow attachment uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow attachment updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow attachment deletes" ON storage.objects;

-- Server icons
DROP POLICY IF EXISTS "Allow server icon uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow server icon updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow server icon deletes" ON storage.objects;

-- Server emojis
DROP POLICY IF EXISTS "Allow server emoji uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow server emoji updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow server emoji deletes" ON storage.objects;

-- 3. Create new scoped policies

-- === AVATARS (user-owned: path = {user_id}/...) ===
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO public
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

-- === ATTACHMENTS (user-owned: path = {user_id}/...) ===
CREATE POLICY "Users can upload own attachments"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO public
USING (
  bucket_id = 'attachments'
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

-- === SERVER ICONS (server-owned: path = {server_id}/...) ===
-- Only server owner or admin/moderator can manage
CREATE POLICY "Server admins can upload server icons"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'server-icons'
  AND EXISTS (
    SELECT 1 FROM server_members sm
    WHERE sm.server_id::text = (storage.foldername(name))[1]
      AND sm.user_id = public.get_request_user_id()
      AND sm.is_banned = false
      AND sm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Server admins can update server icons"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'server-icons'
  AND EXISTS (
    SELECT 1 FROM server_members sm
    WHERE sm.server_id::text = (storage.foldername(name))[1]
      AND sm.user_id = public.get_request_user_id()
      AND sm.is_banned = false
      AND sm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Server admins can delete server icons"
ON storage.objects FOR DELETE
TO public
USING (
  bucket_id = 'server-icons'
  AND EXISTS (
    SELECT 1 FROM server_members sm
    WHERE sm.server_id::text = (storage.foldername(name))[1]
      AND sm.user_id = public.get_request_user_id()
      AND sm.is_banned = false
      AND sm.role IN ('owner', 'admin')
  )
);

-- === SERVER EMOJIS (server-owned: path = {server_id}/...) ===
CREATE POLICY "Server admins can upload server emojis"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'server-emojis'
  AND EXISTS (
    SELECT 1 FROM server_members sm
    WHERE sm.server_id::text = (storage.foldername(name))[1]
      AND sm.user_id = public.get_request_user_id()
      AND sm.is_banned = false
      AND sm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Server admins can update server emojis"
ON storage.objects FOR UPDATE
TO public
USING (
  bucket_id = 'server-emojis'
  AND EXISTS (
    SELECT 1 FROM server_members sm
    WHERE sm.server_id::text = (storage.foldername(name))[1]
      AND sm.user_id = public.get_request_user_id()
      AND sm.is_banned = false
      AND sm.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Server admins can delete server emojis"
ON storage.objects FOR DELETE
TO public
USING (
  bucket_id = 'server-emojis'
  AND EXISTS (
    SELECT 1 FROM server_members sm
    WHERE sm.server_id::text = (storage.foldername(name))[1]
      AND sm.user_id = public.get_request_user_id()
      AND sm.is_banned = false
      AND sm.role IN ('owner', 'admin')
  )
);
