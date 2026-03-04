// hooks/useSignedUrl.ts
// Converts a Supabase storage public URL into a signed URL for private buckets.
// Caches signed URLs in memory to avoid re-requesting on every render.
// Signed URLs expire after 1 hour and are automatically refreshed.

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const EXPIRY_SECONDS = 3600; // 1 hour
const REFRESH_BUFFER = 300;  // Refresh 5 minutes before expiry

interface CacheEntry {
  signedUrl: string;
  expiresAt: number; // Unix timestamp ms
}

// Module-level cache so signed URLs survive re-renders across message list
const MAX_SIGNED_URL_CACHE = 200;
const cache = new Map<string, CacheEntry>();

function evictSignedUrlCache() {
  if (cache.size <= MAX_SIGNED_URL_CACHE) return;
  const now = Date.now();
  // First pass: remove expired entries
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  if (cache.size <= MAX_SIGNED_URL_CACHE) return;
  // Second pass: remove oldest
  const toDelete = cache.size - MAX_SIGNED_URL_CACHE;
  let count = 0;
  for (const key of cache.keys()) {
    if (count >= toDelete) break;
    cache.delete(key);
    count++;
  }
}

function extractPathFromUrl(url: string, bucket: string): string | null {
  try {
    // Matches: /storage/v1/object/public/{bucket}/{path}
    // or:      /storage/v1/object/sign/{bucket}/{path}
    const pattern = new RegExp(`/storage/v1/object/(?:public|sign)/${bucket}/(.+?)(?:\\?|$)`);
    const match = url.match(pattern);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

function isSupabaseAttachmentUrl(url: string): boolean {
  return url.includes(".supabase.co/storage/v1/object") && url.includes("/attachments/");
}

// In-flight deduplication: avoid multiple concurrent requests for the same URL
const inflightRequests = new Map<string, Promise<string | null>>();

export function useSignedUrl(fileUrl: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(() => {
    if (!fileUrl || !isSupabaseAttachmentUrl(fileUrl)) return fileUrl ?? null;
    const cached = cache.get(fileUrl);
    if (cached && cached.expiresAt - Date.now() > REFRESH_BUFFER * 1000) {
      return cached.signedUrl;
    }
    return null;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether initializer already resolved from cache to skip redundant effect work
  const resolvedFromCacheRef = useRef(false);

  useEffect(() => {
    if (!fileUrl || !isSupabaseAttachmentUrl(fileUrl)) {
      setSignedUrl(fileUrl ?? null);
      return;
    }

    let cancelled = false;

    const getSignedUrl = async () => {
      const cached = cache.get(fileUrl);
      const now = Date.now();

      if (cached && cached.expiresAt - now > REFRESH_BUFFER * 1000) {
        // Skip setState if this is the initial mount and we already resolved from cache
        if (!resolvedFromCacheRef.current) {
          setSignedUrl(cached.signedUrl);
        }
        resolvedFromCacheRef.current = false;
        const refreshIn = cached.expiresAt - now - REFRESH_BUFFER * 1000;
        timerRef.current = setTimeout(getSignedUrl, refreshIn);
        return;
      }

      const path = extractPathFromUrl(fileUrl, "attachments");
      if (!path) {
        setSignedUrl(fileUrl);
        return;
      }

      // Deduplicate concurrent requests for the same URL
      let requestPromise = inflightRequests.get(fileUrl);
      if (!requestPromise) {
        requestPromise = supabase.storage
          .from("attachments")
          .createSignedUrl(path, EXPIRY_SECONDS)
          .then(({ data, error }) => {
            if (error || !data?.signedUrl) {
              console.warn("[useSignedUrl] Failed to sign URL:", error?.message);
              return null;
            }
            const entry: CacheEntry = {
              signedUrl: data.signedUrl,
              expiresAt: Date.now() + EXPIRY_SECONDS * 1000,
            };
            cache.set(fileUrl, entry);
            evictSignedUrlCache();
            return data.signedUrl;
          })
          .finally(() => {
            inflightRequests.delete(fileUrl);
          });
        inflightRequests.set(fileUrl, requestPromise);
      }

      const result = await requestPromise;
      if (cancelled) return;

      setSignedUrl(result ?? fileUrl);

      if (result) {
        timerRef.current = setTimeout(getSignedUrl, (EXPIRY_SECONDS - REFRESH_BUFFER) * 1000);
      }
    };

    // If initial state already resolved from cache, just schedule refresh
    const cachedEntry = cache.get(fileUrl);
    if (cachedEntry && cachedEntry.expiresAt - Date.now() > REFRESH_BUFFER * 1000) {
      resolvedFromCacheRef.current = true;
      const refreshIn = cachedEntry.expiresAt - Date.now() - REFRESH_BUFFER * 1000;
      timerRef.current = setTimeout(() => { resolvedFromCacheRef.current = false; getSignedUrl(); }, refreshIn);
    } else {
      getSignedUrl();
    }

    return () => {
      cancelled = true;
      resolvedFromCacheRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fileUrl]);

  return signedUrl;
}