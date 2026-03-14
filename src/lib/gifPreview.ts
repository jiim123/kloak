const gifStillPreviewCache = new Map<string, Promise<string | null>>();

export const isGifUrl = (url: string): boolean => /\.gif(?:[?#].*)?$/i.test(url);

const isGifBlob = async (blob: Blob): Promise<boolean> => {
  if (blob.type === "image/gif") return true;
  if (blob.type && blob.type !== "application/octet-stream") return false;

  try {
    const header = await blob.slice(0, 6).text();
    return header === "GIF87a" || header === "GIF89a";
  } catch {
    return false;
  }
};

export const getGifStillPreview = (url: string): Promise<string | null> => {
  const cached = gifStillPreviewCache.get(url);
  if (cached) return cached;

  const previewPromise = (async () => {
    if (typeof window === "undefined" || typeof createImageBitmap !== "function") {
      return null;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) return null;

      const blob = await response.blob();
      if (!(await isGifBlob(blob))) return null;

      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;

      const context = canvas.getContext("2d");
      if (!context) {
        bitmap.close();
        return null;
      }

      context.drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.toDataURL("image/png");
    } catch {
      return null;
    }
  })();

  gifStillPreviewCache.set(url, previewPromise);
  return previewPromise;
};
