/**
 * useSignedUrl – React hook that resolves a single Supabase attachment URL
 * (public or already-signed) into a fresh signed URL.
 *
 * Delegates all caching, deduplication, and path extraction to src/lib/signedUrl.ts.
 * Non-attachment URLs are returned as-is.
 *
 * ## Expiry Handling (Phase 4D)
 * Approach chosen: **Option 1 – onError retry**.
 * The hook exposes a `refresh()` callback. When an `<img>` fires `onError`
 * (typically because the signed URL expired after 30 min), the consumer calls
 * `refresh()` which invalidates the cache entry and re-signs the path once.
 * This is simpler and less invasive than periodic background polling because
 * it only triggers network requests for URLs that actually fail, and requires
 * no visibility observers or interval timers.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  isSupabaseAttachmentUrl,
  extractStoragePath,
  getSignedAttachmentUrl,
  invalidateCacheEntry,
} from "@/lib/signedUrl";

// ---------------------------------------------------------------------------
// Quick synchronous cache probe (avoids flash-of-nothing on re-renders)
// ---------------------------------------------------------------------------

import { _peekCache } from "@/lib/signedUrl";

interface UseSignedUrlResult {
  url: string | null;
  /** Call on image load error to re-sign the URL once. */
  refresh: () => void;
}

export function useSignedUrl(fileUrl: string | null | undefined): string | null;
export function useSignedUrl(fileUrl: string | null | undefined, opts: { withRefresh: true }): UseSignedUrlResult;
export function useSignedUrl(
  fileUrl: string | null | undefined,
  opts?: { withRefresh: true },
): string | null | UseSignedUrlResult {
  const [signedUrl, setSignedUrl] = useState<string | null>(() => {
    if (!fileUrl) return null;
    if (!isSupabaseAttachmentUrl(fileUrl)) return fileUrl;
    const path = extractStoragePath(fileUrl);
    if (!path) return fileUrl;
    return _peekCache(path) ?? null;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriedRef = useRef(false);

  useEffect(() => {
    retriedRef.current = false;

    if (!fileUrl) {
      setSignedUrl(null);
      return;
    }

    // Handle kloak-attachment:// stable references
    const ATTACHMENT_PREFIX = "kloak-attachment://";
    if (fileUrl.startsWith(ATTACHMENT_PREFIX)) {
      const path = fileUrl.slice(ATTACHMENT_PREFIX.length);
      let cancelled = false;

      const resolve = async () => {
        const result = await getSignedAttachmentUrl(path);
        if (cancelled) return;
        setSignedUrl(result ?? null);
        timerRef.current = setTimeout(resolve, (1800 - 300) * 1000);
      };

      resolve();
      return () => {
        cancelled = true;
        if (timerRef.current) clearTimeout(timerRef.current);
      };
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

  const refresh = useCallback(() => {
    // Only retry once to avoid infinite loops on genuinely broken images
    if (retriedRef.current || !fileUrl) return;
    retriedRef.current = true;

    const path = extractStoragePath(fileUrl);
    if (!path) return;

    invalidateCacheEntry(path);
    getSignedAttachmentUrl(path).then((result) => {
      if (result) setSignedUrl(result);
    });
  }, [fileUrl]);

  if (opts?.withRefresh) {
    return { url: signedUrl, refresh };
  }
  return signedUrl;
}
