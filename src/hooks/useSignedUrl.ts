/**
 * useSignedUrl – React hook that resolves a single Supabase attachment URL
 * (public or already-signed) into a fresh signed URL.
 *
 * Delegates all caching, deduplication, and path extraction to src/lib/signedUrl.ts.
 * Non-attachment URLs are returned as-is.
 */

import { useState, useEffect, useRef } from "react";
import {
  isSupabaseAttachmentUrl,
  extractStoragePath,
  getSignedAttachmentUrl,
} from "@/lib/signedUrl";

// ---------------------------------------------------------------------------
// Quick synchronous cache probe (avoids flash-of-nothing on re-renders)
// ---------------------------------------------------------------------------

import { _peekCache } from "@/lib/signedUrl";

export function useSignedUrl(fileUrl: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(() => {
    if (!fileUrl) return null;
    if (!isSupabaseAttachmentUrl(fileUrl)) return fileUrl;
    const path = extractStoragePath(fileUrl);
    if (!path) return fileUrl;
    // Synchronous cache hit → no loading flash
    return _peekCache(path) ?? null;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!fileUrl) {
      setSignedUrl(null);
      return;
    }
    if (!isSupabaseAttachmentUrl(fileUrl)) {
      setSignedUrl(fileUrl);
      return;
    }

    const path = extractStoragePath(fileUrl);
    if (!path) {
      setSignedUrl(fileUrl);
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      const result = await getSignedAttachmentUrl(path);
      if (cancelled) return;
      setSignedUrl(result ?? fileUrl);

      // Schedule a refresh ~25 minutes later (EXPIRY − BUFFER)
      timerRef.current = setTimeout(resolve, (1800 - 300) * 1000);
    };

    resolve();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [fileUrl]);

  return signedUrl;
}
