-- ============================================================
-- Storage RLS: attachments bucket (private)
-- ============================================================
-- TRADEOFF NOTICE:
-- All Kloak users connect as the `anon` role (no Supabase Auth / no JWTs).
-- Identity is verified at the application layer via `verify_request_identity()`
-- in SECURITY DEFINER RPC functions and the `storage-upload` edge function.
--
-- These policies allow ANY holder of the public anon key to:
--   1. Generate signed URLs for any file path they know/guess
--   2. Upload files to the bucket (rate-limited only by the edge function)
--
-- This is acceptable as a bootstrap step because:
--   - The bucket is PRIVATE, so objects are not publicly downloadable
--   - Signed URLs expire after 1 hour
--   - Uploads are proxied through the `storage-upload` edge function which
--     validates identity via x-key-hash and enforces path ownership
--   - File paths use UUIDs making enumeration impractical
--
-- TODO: Add per-resource access control (verify channel/DM membership)
--       via an RPC-based signed URL endpoint for defence in depth.
-- ============================================================

-- Drop the existing owner-only SELECT policy (too restrictive;
-- users need to view attachments posted by others in shared channels/DMs)
DROP POLICY IF EXISTS "Attachment owner can read own files" ON storage.objects;

-- Allow anon to read objects in the attachments bucket (needed for signed URL generation).
-- Without this, supabase.storage.from('attachments').createSignedUrl() fails for anon.
CREATE POLICY "Allow anon read access to attachments"
ON storage.objects
FOR SELECT
TO anon
USING (bucket_id = 'attachments');

-- Allow anon to upload to the attachments bucket.
-- Actual path validation and identity checks happen in the storage-upload edge function.
CREATE POLICY "Allow anon upload to attachments"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (bucket_id = 'attachments');
