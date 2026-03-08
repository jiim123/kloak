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

  useEffect(() => {
    const key = fileUrls.join("\n");
    if (key === keyRef.current && urls.size > 0) return;
    keyRef.current = key;

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
  }, [JSON.stringify(fileUrls)]); // eslint-disable-line react-hooks/exhaustive-deps

  return { urls, loading };
}
