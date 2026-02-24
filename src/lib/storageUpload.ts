import { getKeyHashAsync } from "@/integrations/supabase/client";

const STORAGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-upload`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function requireKeyHash(): Promise<string> {
  const kh = await getKeyHashAsync();
  if (!kh) throw new Error("Not authenticated");
  return kh;
}

// Strips all executable content from SVG files before upload
async function sanitizeSVG(file: File): Promise<File> {
  const text = await file.text();
  const sanitized = text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "")
    .replace(/(href|xlink:href|src)\s*=\s*["']\s*(javascript|data):[^"']*["']/gi, "")
    .replace(/<use[^>]*href\s*=\s*["']https?:\/\/[^"']*["'][^>]*>/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  const blob = new Blob([sanitized], { type: "image/svg+xml" });
  return new File([blob], file.name, { type: "image/svg+xml" });
}

/**
 * Upload a file via the secure Edge Function proxy.
 * Returns { publicUrl, path }.
 */
export async function secureUpload(
  bucket: string,
  path: string,
  fileInput: File | Blob,
  options?: { contentType?: string; upsert?: boolean; cacheControl?: string },
): Promise<{ publicUrl: string; path: string }> {
  const keyHash = await requireKeyHash();

  // Sanitize SVG files before upload to strip scripts and event handlers
  let file: File | Blob = fileInput;
  if (
    fileInput instanceof File &&
    (fileInput.type === "image/svg+xml" || fileInput.name.toLowerCase().endsWith(".svg"))
  ) {
    file = await sanitizeSVG(fileInput);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("bucket", bucket);
  formData.append("path", path);
  formData.append("contentType", options?.contentType || "image/webp");
  formData.append("upsert", options?.upsert ? "true" : "false");
  if (options?.cacheControl) {
    formData.append("cacheControl", options.cacheControl);
  }
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
  const keyHash = await requireKeyHash();
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
  const keyHash = await requireKeyHash();
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
