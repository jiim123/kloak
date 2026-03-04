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
        setSignedUrl(cached.signedUrl);
        // Schedule refresh before expiry
        const refreshIn = cached.expiresAt - now - REFRESH_BUFFER * 1000;
        timerRef.current = setTimeout(getSignedUrl, refreshIn);
        return;
      }

      const path = extractPathFromUrl(fileUrl, "attachments");
      if (!path) {
        // Can't extract path, fall back to original URL
        setSignedUrl(fileUrl);
        return;
      }

      const { data, error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(path, EXPIRY_SECONDS);

      if (cancelled) return;

      if (error || !data?.signedUrl) {
        console.warn("[useSignedUrl] Failed to sign URL:", error?.message);
        setSignedUrl(fileUrl); // Fall back to original
        return;
      }

      const entry: CacheEntry = {
        signedUrl: data.signedUrl,
        expiresAt: now + EXPIRY_SECONDS * 1000,
      };
      cache.set(fileUrl, entry);
      evictSignedUrlCache();
      setSignedUrl(data.signedUrl);

      // Schedule refresh before expiry
      timerRef.current = setTimeout(getSignedUrl, (EXPIRY_SECONDS - REFRESH_BUFFER) * 1000);
    };

    getSignedUrl();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fileUrl]);

  return signedUrl;
}