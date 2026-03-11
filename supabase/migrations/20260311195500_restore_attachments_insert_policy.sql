-- Restore missing INSERT policy for attachments bucket uploads.
-- Without this policy, storage API writes to storage.objects fail with:
-- "new row violates row-level security policy".

DROP POLICY IF EXISTS "Allow anon upload to attachments" ON storage.objects;
DROP POLICY IF EXISTS "Allow upload to attachments" ON storage.objects;

CREATE POLICY "Allow upload to attachments"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'attachments'
  AND public.is_safe_storage_object_key(bucket_id, name)
);
