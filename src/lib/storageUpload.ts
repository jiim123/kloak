import { getKeyHash } from "@/integrations/supabase/client";

const STORAGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-upload`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

function requireKeyHash(): string {
  const kh = getKeyHash();
  if (!kh) throw new Error("Not authenticated");
  return kh;
}

/**
 * Upload a file via the secure Edge Function proxy.
 * Returns { publicUrl, path }.
 */
export async function secureUpload(
  bucket: string,
  path: string,
  file: File | Blob,
  options?: { contentType?: string; upsert?: boolean },
): Promise<{ publicUrl: string; path: string }> {
  const keyHash = requireKeyHash();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  formData.append("path", path);
  formData.append("contentType", options?.contentType || "image/webp");
  formData.append("upsert", options?.upsert ? "true" : "false");

  const res = await fetch(STORAGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "x-key-hash": keyHash,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Upload failed" }));
    throw new Error(err.error || "Upload failed");
  }

  return res.json();
}

/**
 * Delete file(s) via the secure Edge Function proxy.
 */
export async function secureDelete(bucket: string, pathOrPaths: string | string[]): Promise<void> {
  const keyHash = requireKeyHash();
  const body = Array.isArray(pathOrPaths) ? { bucket, paths: pathOrPaths } : { bucket, path: pathOrPaths };

  const res = await fetch(STORAGE_FUNCTION_URL, {
    method: "DELETE",
    headers: {
      "x-key-hash": keyHash,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Delete failed" }));
    throw new Error(err.error || "Delete failed");
  }
}

/**
 * List and delete files matching a prefix/filter via the Edge Function.
 * Used for cleanup-before-upload patterns (e.g. old server icons).
 */
export async function secureListAndDelete(bucket: string, prefix: string, searchFilter?: string): Promise<void> {
  const keyHash = requireKeyHash();

  const res = await fetch(STORAGE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "x-key-hash": keyHash,
      Authorization: `Bearer ${ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "listAndDelete", bucket, prefix, searchFilter }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "List+delete failed" }));
    throw new Error(err.error || "List+delete failed");
  }
}
