/**
 * Signed URL generation utilities for private Bunny CDN storage buckets.
 *
 * The "attachments" bucket is private. Files are fetched through a server-side
 * proxy Edge Function that returns binary data. We convert the blob into an
 * object URL and cache it.
 *
 * - In-memory cache with configurable TTL (no localStorage).
 * - 5-minute refresh buffer so URLs are regenerated before expiry.
 * - In-flight deduplication for concurrent requests to the same path.
 * - LRU-style eviction when cache exceeds MAX_ENTRIES.
 * - Object URLs are revoked on eviction/expiry to free memory.
 */

import { getKeyHashAsync } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const OBJECT_URL_EXPIRY = 1800; // 30 minutes (matches original signed URL TTL)
const CACHE_REFRESH_BUFFER = 300; // Refresh 5 min before expiry
const MAX_CACHE_ENTRIES = 300;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  url: string;
  /** Unix-epoch **seconds** when this object URL should be considered expired */
  expiresAt: number;
}

const urlCache = new Map<string, CacheEntry>();

/** Revoke a blob object URL if it looks like one. */
function safeRevoke(url: string) {
  if (url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }
}

function evictIfNeeded() {
  if (urlCache.size <= MAX_CACHE_ENTRIES) return;
  const now = nowSec();
  // First pass: drop expired
  for (const [key, entry] of urlCache) {
    if (entry.expiresAt <= now) {
      safeRevoke(entry.url);
      urlCache.delete(key);
    }
  }
  if (urlCache.size <= MAX_CACHE_ENTRIES) return;
  // Second pass: evict oldest (insertion-order)
  const excess = urlCache.size - MAX_CACHE_ENTRIES;
  let count = 0;
  for (const [key, entry] of urlCache) {
    if (count >= excess) break;
    safeRevoke(entry.url);
    urlCache.delete(key);
    count++;
  }
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function getCached(filePath: string): string | null {
  const entry = urlCache.get(filePath);
  if (!entry) return null;
  if (entry.expiresAt - CACHE_REFRESH_BUFFER > nowSec()) return entry.url;
  return null;
}

/** Synchronous cache probe for hooks that want instant access without async. */
export function _peekCache(filePath: string): string | null {
  return getCached(filePath);
}

/** Remove a single entry from the cache so the next access re-signs. */
export function invalidateCacheEntry(filePath: string): void {
  const entry = urlCache.get(filePath);
  if (entry) {
    safeRevoke(entry.url);
    urlCache.delete(filePath);
  }
}

function setCache(filePath: string, objectUrl: string) {
  // Revoke any previous URL for this path
  const existing = urlCache.get(filePath);
  if (existing) safeRevoke(existing.url);

  urlCache.set(filePath, {
    url: objectUrl,
    expiresAt: nowSec() + OBJECT_URL_EXPIRY,
  });
  evictIfNeeded();
}

// ---------------------------------------------------------------------------
// In-flight deduplication (single-path)
// ---------------------------------------------------------------------------

const inflight = new Map<string, Promise<string | null>>();

// Negative cache: paths that returned 404/non-ok. Avoids re-hitting the edge
// function (and re-triggering runtime-error overlays) for permanently missing files.
const notFoundCache = new Set<string>();
const NOT_FOUND_CACHE_MAX = 500;

// ---------------------------------------------------------------------------
// Path helpers (kept for backward compatibility with legacy Supabase URLs in DB)
// ---------------------------------------------------------------------------

const SUPABASE_HOST = (() => {
  try {
    const raw = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    return raw ? new URL(raw).host.toLowerCase() : null;
  } catch {
    return null;
  }
})();

/**
 * Returns true when the URL points to the attachments bucket in our
 * Supabase project (legacy public or signed path).
 */
export function isSupabaseAttachmentUrl(url: string): boolean {
  if (!SUPABASE_HOST) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.host.toLowerCase() === SUPABASE_HOST &&
      parsed.pathname.includes("/storage/v1/object") &&
      parsed.pathname.includes("/attachments/")
    );
  } catch {
    return false;
  }
}

/**
 * Extract the storage path from a full Supabase storage URL.
 * Works for both `/object/public/attachments/…` and `/object/sign/attachments/…`.
 */
export function extractStoragePath(url: string): string | null {
  try {
    const pattern = /\/storage\/v1\/object\/(?:public|sign)\/attachments\/(.+?)(?:\?|$)/;
    const match = url.match(pattern);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Single URL — blob proxy via Edge Function
// ---------------------------------------------------------------------------

/**
 * Get a blob object URL for a single attachment path.
 * Fetches the file binary through the Edge Function proxy and creates
 * a local object URL via `URL.createObjectURL`.
 * Returns the object URL or null on failure.
 */
export async function getSignedAttachmentUrl(filePath: string): Promise<string | null> {
  const cached = getCached(filePath);
  if (cached) return cached;

  // Deduplicate concurrent requests for the same path
  let pending = inflight.get(filePath);
  if (pending) return pending;

  const promise = (async () => {
    try {
      const keyHash = await getKeyHashAsync();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
      };
      if (keyHash) headers["x-key-hash"] = keyHash;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/sign-bunny-url`, {
        method: "POST",
        headers,
        body: JSON.stringify({ bucket: "attachments", path: filePath }),
      });

      if (!res.ok) {
        console.warn("[signedUrl] Blob proxy failed for path:", filePath, res.status);
        return null;
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      setCache(filePath, objectUrl);
      return objectUrl;
    } catch (err) {
      console.warn("[signedUrl] Failed to fetch attachment:", filePath, err);
      return null;
    }
  })();

  inflight.set(filePath, promise);
  promise.finally(() => {
    inflight.delete(filePath);
  });

  return promise;
}

// ---------------------------------------------------------------------------
// Batch URLs
// ---------------------------------------------------------------------------

/**
 * Get blob object URLs for multiple attachment paths at once.
 * Uses individual requests with in-flight deduplication (no batch endpoint
 * since the Edge Function returns binary data).
 */
export async function getSignedAttachmentUrls(
  filePaths: string[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const pathsToFetch: string[] = [];

  // Resolve from cache first
  for (const p of filePaths) {
    const cached = getCached(p);
    if (cached) {
      results.set(p, cached);
    } else {
      pathsToFetch.push(p);
    }
  }

  if (pathsToFetch.length === 0) return results;

  // Fetch individually (dedup handled by inflight map)
  const fetches = pathsToFetch.map(async (p) => {
    const url = await getSignedAttachmentUrl(p);
    if (url) results.set(p, url);
  });

  await Promise.all(fetches);
  return results;
}

// ---------------------------------------------------------------------------
// Full-URL convenience helpers
// ---------------------------------------------------------------------------

/**
 * Given a full public/signed Supabase attachment URL, return a fresh object URL.
 * Non-attachment URLs are returned as-is. Returns null on extraction/signing failure.
 */
export async function resolveSignedUrl(fullUrl: string): Promise<string | null> {
  if (!isSupabaseAttachmentUrl(fullUrl)) return fullUrl;
  const path = extractStoragePath(fullUrl);
  if (!path) return fullUrl;
  return getSignedAttachmentUrl(path);
}

/**
 * Resolve object URLs for an array of full public/signed attachment URLs.
 * Non-attachment URLs are returned as-is.
 */
export async function resolveSignedUrls(
  fullUrls: string[],
): Promise<Map<string, string>> {
  const ATTACHMENT_PREFIX = "kloak-attachment://";
  const results = new Map<string, string>();
  const pathToOriginal = new Map<string, string>();

  for (const url of fullUrls) {
    // Handle kloak-attachment:// stable references
    if (url.startsWith(ATTACHMENT_PREFIX)) {
      const path = url.slice(ATTACHMENT_PREFIX.length);
      pathToOriginal.set(path, url);
      continue;
    }
    if (!isSupabaseAttachmentUrl(url)) {
      results.set(url, url);
      continue;
    }
    const path = extractStoragePath(url);
    if (!path) {
      results.set(url, url);
      continue;
    }
    pathToOriginal.set(path, url);
  }

  if (pathToOriginal.size === 0) return results;

  const signed = await getSignedAttachmentUrls(Array.from(pathToOriginal.keys()));

  for (const [path, originalUrl] of pathToOriginal) {
    const signedUrl = signed.get(path);
    results.set(originalUrl, signedUrl ?? originalUrl);
  }

  return results;
}
