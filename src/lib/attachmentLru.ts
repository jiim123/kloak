/**
 * Tiny LRU of "this attachment has been successfully decoded once already".
 *
 * Sits on top of the signedUrl object-URL cache + browser HTTP cache. When an
 * `AttachmentItem` re-mounts (because of scroll up/down, channel switch,
 * member-sidebar toggle, etc.) and the id is in this LRU, the renderer can
 * skip the placeholder fade-in entirely — the bitmap is already in the
 * browser's image cache and the resolved object URL is in the signedUrl
 * cache, so painting is effectively instantaneous.
 *
 * Per-channel scope would be slightly more correct but per-id is simpler and
 * the worst case (false positive across channels) is just a one-frame flash
 * of the BlurHash, identical to the cold path. Cap is intentionally small.
 */

const CAPACITY = 64;
const decoded = new Map<string, true>();

export function markAttachmentDecoded(attachmentId: string): void {
  if (!attachmentId) return;
  if (decoded.has(attachmentId)) {
    decoded.delete(attachmentId);
  }
  decoded.set(attachmentId, true);
  if (decoded.size > CAPACITY) {
    const oldest = decoded.keys().next().value;
    if (oldest) decoded.delete(oldest);
  }
}

export function wasAttachmentDecoded(attachmentId: string): boolean {
  return decoded.has(attachmentId);
}
