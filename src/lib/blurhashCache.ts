/**
 * BlurHash decode cache.
 *
 * Decodes a BlurHash string into a 32×32 data URL once per attachment id and
 * reuses it. Keyed by attachment id (which is stable per row) rather than
 * by hash string so cache hits survive even if the hash field is refreshed.
 *
 * Decoded data URLs are tiny (~1.5 KB) so an LRU cap of 500 is generous.
 */
import { decode as decodeBlurhash } from "blurhash";

const CACHE_LIMIT = 500;
const cache = new Map<string, string>(); // attachmentId → data URL

const DECODE_W = 32;
const DECODE_H = 32;

export function getBlurhashDataUrl(attachmentId: string, hash: string): string | null {
  if (!hash || hash.length < 6) return null;
  const cached = cache.get(attachmentId);
  if (cached) {
    // LRU touch
    cache.delete(attachmentId);
    cache.set(attachmentId, cached);
    return cached;
  }

  let pixels: Uint8ClampedArray;
  try {
    pixels = decodeBlurhash(hash, DECODE_W, DECODE_H);
  } catch {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = DECODE_W;
  canvas.height = DECODE_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const imageData = ctx.createImageData(DECODE_W, DECODE_H);
  imageData.data.set(pixels);
  ctx.putImageData(imageData, 0, 0);

  const dataUrl = canvas.toDataURL("image/png");
  cache.set(attachmentId, dataUrl);
  if (cache.size > CACHE_LIMIT) {
    // Drop oldest
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  return dataUrl;
}
