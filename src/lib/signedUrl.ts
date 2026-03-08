/**
 * Signed URL generation utilities for private Supabase Storage buckets.
 *
 * The "attachments" bucket is private. Public URLs no longer resolve.
 * All attachment rendering must go through signed URLs.
 *
 * - In-memory cache with configurable TTL (no localStorage).
 * - 5-minute refresh buffer so URLs are regenerated before expiry.
 * - Batch support via `createSignedUrls` (plural) to avoid N+1 requests.
 * - In-flight deduplication for concurrent requests to the same path.
 * - LRU-style eviction when cache exceeds MAX_ENTRIES.
 */

import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SIGNED_URL_EXPIRY = 1800; // 30 minutes
const CACHE_REFRESH_BUFFER = 300; // Refresh 5 min before expiry
const MAX_CACHE_ENTRIES = 300;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  url: string;
  /** Unix-epoch **seconds** when this signed URL expires */
  expiresAt: number;
}

const urlCache = new Map<string, CacheEntry>();

function evictIfNeeded() {
  if (urlCache.size <= MAX_CACHE_ENTRIES) return;
  const now = nowSec();
  // First pass: drop expired
  for (const [key, entry] of urlCache) {
    if (entry.expiresAt <= now) urlCache.delete(key);
  }
  if (urlCache.size <= MAX_CACHE_ENTRIES) return;
  // Second pass: evict oldest (insertion-order)
  const excess = urlCache.size - MAX_CACHE_ENTRIES;
  let count = 0;
  for (const key of urlCache.keys()) {
    if (count >= excess) break;
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

function setCache(filePath: string, signedUrl: string) {
  urlCache.set(filePath, {
    url: signedUrl,
    expiresAt: nowSec() + SIGNED_URL_EXPIRY,
  });
  evictIfNeeded();
}

// ---------------------------------------------------------------------------
// In-flight deduplication (single-path)
// ---------------------------------------------------------------------------

const inflight = new Map<string, Promise<string | null>>();

// ---------------------------------------------------------------------------
// Path helpers
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
 * Supabase project (public or signed path).
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
// Single URL
// ---------------------------------------------------------------------------

/**
 * Get a signed URL for a single attachment path.
 * Returns the signed URL or null on failure.
 */
export async function getSignedAttachmentUrl(filePath: string): Promise<string | null> {
  const cached = getCached(filePath);
  if (cached) return cached;

  // Deduplicate concurrent requests for the same path
  let pending = inflight.get(filePath);
  if (pending) return pending;

  const promise = supabase.storage
    .from("attachments")
    .createSignedUrl(filePath, SIGNED_URL_EXPIRY)
    .then(({ data, error }) => {
      if (error || !data?.signedUrl) {
        console.warn("[signedUrl] Failed to sign path:", filePath, error?.message);
        return null;
      }
      setCache(filePath, data.signedUrl);
      return data.signedUrl;
    })
    .finally(() => {
      inflight.delete(filePath);
    });

  inflight.set(filePath, promise);
  return promise;
}

// ---------------------------------------------------------------------------
// Batch URLs
// ---------------------------------------------------------------------------

/**
 * Get signed URLs for multiple attachment paths at once.
 * Uses the Supabase batch endpoint (`createSignedUrls`) to minimise requests.
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

  const { data, error } = await supabase.storage
    .from("attachments")
    .createSignedUrls(pathsToFetch, SIGNED_URL_EXPIRY);

  if (error) {
    console.warn("[signedUrl] Batch sign failed:", error.message);
  }

  if (data) {
    for (const item of data) {
      if (item.signedUrl && item.path) {
        setCache(item.path, item.signedUrl);
        results.set(item.path, item.signedUrl);
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Full-URL convenience helpers
// ---------------------------------------------------------------------------

/**
 * Given a full public/signed Supabase attachment URL, return a fresh signed URL.
 * Non-attachment URLs are returned as-is. Returns null on extraction/signing failure.
 */
export async function resolveSignedUrl(fullUrl: string): Promise<string | null> {
  if (!isSupabaseAttachmentUrl(fullUrl)) return fullUrl;
  const path = extractStoragePath(fullUrl);
  if (!path) return fullUrl;
  return getSignedAttachmentUrl(path);
}

/**
 * Resolve signed URLs for an array of full public/signed attachment URLs.
 * Non-attachment URLs are returned as-is.
 */
export async function resolveSignedUrls(
  fullUrls: string[],
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  const pathToOriginal = new Map<string, string>();

  for (const url of fullUrls) {
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
