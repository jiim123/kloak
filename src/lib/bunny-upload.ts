/**
 * Bunny CDN upload/delete utilities.
 *
 * Public buckets (avatars, badges, server-emojis, server-icons) are served
 * directly via CDN URL. The "attachments" bucket is private and goes through
 * the blob-proxy in signedUrl.ts.
 */

import { getKeyHashAsync } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CDN_BASE = "https://kloakcdn.b-cdn.net";

// ---------------------------------------------------------------------------
// Public CDN URL
// ---------------------------------------------------------------------------

/**
 * Construct a public CDN URL for a file in a public bucket.
 * Use for: avatars, badges, server-emojis, server-icons.
 * Do NOT use for attachments (private bucket).
 */
export function getCdnUrl(bucket: string, filePath: string): string {
  return `${CDN_BASE}/${bucket}/${filePath}`;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a file to Bunny CDN via the Edge Function proxy.
 * Returns `{ url, path }`.
 */
export async function uploadFile(
  bucket: string,
  filePath: string,
  file: File | Blob,
  options?: { contentType?: string },
): Promise<{ url: string; path: string }> {
  const keyHash = await getKeyHashAsync();
  if (!keyHash) throw new Error("Not authenticated");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/upload-to-bunny`, {
    method: "POST",
    headers: {
      "x-key-hash": keyHash,
      "x-bucket": bucket,
      "x-file-path": filePath,
      "Content-Type": options?.contentType || file.type || "application/octet-stream",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: file,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }

  const result: { url: string; path: string } = await res.json();
  return result;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a file from Bunny CDN via the Edge Function proxy.
 * // TODO: deploy delete-from-bunny Edge Function
 */
export async function deleteFile(bucket: string, filePath: string): Promise<void> {
  const keyHash = await getKeyHashAsync();
  if (!keyHash) throw new Error("Not authenticated");

  const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-from-bunny`, {
    method: "POST",
    headers: {
      "x-key-hash": keyHash,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ bucket, path: filePath }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.error || "Delete failed");
  }
}
