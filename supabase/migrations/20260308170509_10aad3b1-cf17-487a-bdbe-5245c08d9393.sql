-- ============================================================
-- CRITICAL FIX 1: Make attachments bucket PRIVATE
-- This prevents direct URL access to DM/channel file attachments.
-- Files will only be accessible via signed URLs.
-- ============================================================
UPDATE storage.buckets
SET public = false
WHERE id = 'attachments';

-- ============================================================
-- CRITICAL FIX 2: Add file_size_limit and allowed_mime_types
-- Prevents storage-exhaustion and malicious file hosting.
-- ============================================================

-- Attachments: 10MB, common media + document types
UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/gif','image/webp','image/avif','image/svg+xml',
      'video/mp4','video/webm',
      'audio/mpeg','audio/ogg','audio/wav','audio/webm',
      'application/pdf',
      'text/plain',
      'application/zip'
    ]
WHERE id = 'attachments';

-- Avatars: 5MB, images only
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/gif','image/webp','image/avif'
    ]
WHERE id = 'avatars';

-- Server icons: 5MB, images only
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/gif','image/webp','image/avif'
    ]
WHERE id = 'server-icons';

-- Server emojis: 512KB, images only
UPDATE storage.buckets
SET file_size_limit = 524288,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/gif','image/webp','image/avif'
    ]
WHERE id = 'server-emojis';

-- Badges: 1MB, images only (admin-managed)
UPDATE storage.buckets
SET file_size_limit = 1048576,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/gif','image/webp','image/avif','image/svg+xml'
    ]
WHERE id = 'badges';

-- ============================================================
-- CRITICAL FIX 3: Replace broken storage RLS policies
-- Old policies use auth.uid() which is always NULL for Kloak.
-- New policies use public.get_request_user_id() for custom auth.
-- ============================================================

-- Drop ALL existing storage policies so we can rebuild cleanly
DROP POLICY IF EXISTS "Authenticated users can read attachments" ON storage.objects;
DROP POLICY IF EXISTS "Avatar Upload" ON storage.objects;
DROP POLICY IF EXISTS "Avatar View" ON storage.objects;
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Only owners can upload/delete their assets" ON storage.objects;
DROP POLICY IF EXISTS "Public can view profiles" ON storage.objects;
DROP POLICY IF EXISTS "Server emojis are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Server icons are publicly accessible" ON storage.objects;

-- ── ATTACHMENTS (now private) ──
-- Read: only the file owner can read their own attachments (via signed URLs from edge fn)
-- The storage-upload edge function uses service_role so it bypasses RLS.
-- Signed URLs are generated server-side, so we allow SELECT for the owner.
CREATE POLICY "Attachment owner can read own files"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'attachments'
  AND public.get_request_user_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

-- ── AVATARS (public read, owner write) ──
CREATE POLICY "Avatars are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users upload own avatars"
ON storage.objects FOR INSERT TO public
WITH CHECK (
  bucket_id = 'avatars'
  AND public.get_request_user_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

CREATE POLICY "Users update own avatars"
ON storage.objects FOR UPDATE TO public
USING (
  bucket_id = 'avatars'
  AND public.get_request_user_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND public.get_request_user_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

CREATE POLICY "Users delete own avatars"
ON storage.objects FOR DELETE TO public
USING (
  bucket_id = 'avatars'
  AND public.get_request_user_id() IS NOT NULL
  AND (storage.foldername(name))[1] = public.get_request_user_id()::text
);

-- ── SERVER ICONS (public read, admin write via edge fn) ──
CREATE POLICY "Server icons are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'server-icons');

-- ── SERVER EMOJIS (public read, admin write via edge fn) ──
CREATE POLICY "Server emojis are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'server-emojis');

-- ── BADGES (public read, no client write) ──
CREATE POLICY "Badges are publicly readable"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'badges');