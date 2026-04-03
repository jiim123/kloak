import { getKeyHashAsync } from "@/integrations/supabase/client";
import { getSignedAttachmentUrl } from "@/lib/signedUrl";
import { uploadFile as bunnyUpload, deleteFile as bunnyDelete, getCdnUrl } from "@/lib/bunny-upload";

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
 * Upload a file via the Bunny CDN Edge Function proxy.
 * Returns { publicUrl, path }.
 */
export async function secureUpload(
  bucket: string,
  path: string,
  fileInput: File | Blob,
  options?: { contentType?: string; upsert?: boolean; cacheControl?: string },
): Promise<{ publicUrl: string; path: string }> {
  await requireKeyHash();

  // Sanitize SVG files before upload to strip scripts and event handlers
  let file: File | Blob = fileInput;
  if (
    fileInput instanceof File &&
    (fileInput.type === "image/svg+xml" || fileInput.name.toLowerCase().endsWith(".svg"))
  ) {
    file = await sanitizeSVG(fileInput);
  }

  const result = await bunnyUpload(bucket, path, file, {
    contentType: options?.contentType || (file instanceof File ? file.type : undefined) || "image/webp",
  });

  // For public buckets, construct CDN URL. For attachments, use returned URL.
  const publicUrl = bucket === "attachments"
    ? result.url
    : getCdnUrl(bucket, result.path);

  // Pre-warm the blob proxy cache for attachment uploads so the sender sees
  // their own image instantly without waiting for the hook to resolve.
  if (bucket === "attachments" && result.path) {
    getSignedAttachmentUrl(result.path).catch(() => {});
  }

  return { publicUrl, path: result.path };
}

/**
 * Delete file(s) via the Bunny CDN Edge Function proxy.
 */
export async function secureDelete(bucket: string, pathOrPaths: string | string[]): Promise<void> {
  await requireKeyHash();
  const paths = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths];
  await Promise.all(paths.map((p) => bunnyDelete(bucket, p)));
}

/**
 * List and delete files matching a prefix/filter.
 * // TODO: implement Bunny CDN equivalent for list+delete operations
 */
export async function secureListAndDelete(bucket: string, prefix: string, searchFilter?: string): Promise<void> {
  // TODO: implement via Bunny CDN Edge Function
  console.warn("[storageUpload] secureListAndDelete not yet implemented for Bunny CDN", { bucket, prefix, searchFilter });
}
