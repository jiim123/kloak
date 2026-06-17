/**
 * useSignedUrls – React hook that batch-resolves multiple Supabase attachment
 * URLs into signed URLs via a single Supabase request.
 *
 * Ideal for message lists where many attachments need resolving at once.
 * Non-attachment URLs are returned as-is.
 */

import { useState, useEffect, useRef } from "react";
import { resolveSignedUrls } from "@/lib/signedUrl";

export function useSignedUrls(fileUrls: string[]): {
  urls: Map<string, string>;
  loading: boolean;
} {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  // Stable serialisation for the dependency array
  const keyRef = useRef("");

  const urlsKey = fileUrls.join("\n");

  useEffect(() => {
    if (urlsKey === keyRef.current && urls.size > 0) return;
    keyRef.current = urlsKey;

    if (fileUrls.length === 0) {
      setUrls(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    resolveSignedUrls(fileUrls).then((resolved) => {
      if (cancelled) return;
      setUrls(resolved);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey]);

  return { urls, loading };
}
