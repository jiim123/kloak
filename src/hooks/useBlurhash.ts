/**
 * useBlurhash — returns a memoised data URL for the given BlurHash string,
 * keyed by attachment id so re-mounts don't trigger another decode.
 */
import { useMemo } from "react";
import { getBlurhashDataUrl } from "@/lib/blurhashCache";

export function useBlurhash(
  attachmentId: string,
  hash: string | null | undefined,
): string | null {
  return useMemo(
    () => (hash ? getBlurhashDataUrl(attachmentId, hash) : null),
    [attachmentId, hash],
  );
}
