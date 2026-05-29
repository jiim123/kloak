/**
 * Client-side image enrichment for chat attachments.
 *
 * Runs at upload time (after compression, before persist) and computes:
 *  - width / height (intrinsic pixel dimensions)
 *  - placeholder    (BlurHash 4×3 string, ~30 chars)
 *
 * Cheap (<10ms for a 32×32 downscale on an idle main thread) and avoids
 * needing a separate enrichment Edge Function. EXIF is already stripped
 * by `compressAttachmentImage` (canvas re-encode to WebP).
 */
import { encode as encodeBlurhash } from "blurhash";

export interface ImageEnrichment {
  width: number;
  height: number;
  placeholder: string;
}

/**
 * Returns null for non-images, animated GIFs, SVGs, or on decode failure.
 * Never throws.
 */
export async function enrichImageFile(file: File): Promise<ImageEnrichment | null> {
  if (!file.type.startsWith("image/")) return null;
  if (file.type === "image/svg+xml") return null;
  // Skip animated GIFs — BlurHash from the first frame is fine, but our
  // current chat renderer treats GIFs as-is and the placeholder would
  // mask the animated preview during scroll. Cheap to skip.
  if (file.type === "image/gif") return null;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return null;

    const placeholder = encodeBlurhashFromImage(img, width, height);
    if (!placeholder) {
      return { width, height, placeholder: "" };
    }
    return { width, height, placeholder };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Encode a BlurHash from an HTMLImageElement. Downscales to ≤32px on the
 * longest edge so the encode runs in well under a frame.
 */
function encodeBlurhashFromImage(
  img: HTMLImageElement,
  width: number,
  height: number,
): string | null {
  const longest = Math.max(width, height);
  const scale = longest > 32 ? 32 / longest : 1;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, w, h);
  let pixels: ImageData;
  try {
    pixels = ctx.getImageData(0, 0, w, h);
  } catch {
    // Tainted canvas — shouldn't happen for a same-origin blob, but be safe.
    return null;
  }
  try {
    return encodeBlurhash(pixels.data, w, h, 4, 3);
  } catch {
    return null;
  }
}
