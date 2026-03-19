import imageCompression from 'browser-image-compression';

export type ImageType = 'avatar' | 'profile-banner' | 'server-icon' | 'server-banner';

const COMPRESSION_PRESETS: Record<ImageType, { maxWidthOrHeight: number; maxSizeMB: number }> = {
  'avatar':         { maxWidthOrHeight: 256,  maxSizeMB: 0.1 },
  'profile-banner': { maxWidthOrHeight: 1200, maxSizeMB: 0.5 },
  'server-icon':    { maxWidthOrHeight: 256,  maxSizeMB: 0.1 },
  'server-banner':  { maxWidthOrHeight: 1200, maxSizeMB: 0.5 },
};

/**
 * Compress and convert an image file to WebP before uploading.
 * Falls back to the original file if compression fails.
 */
export async function compressImage(file: File, type: ImageType): Promise<File> {
  const preset = COMPRESSION_PRESETS[type];

  const options = {
    maxWidthOrHeight: preset.maxWidthOrHeight,
    maxSizeMB: preset.maxSizeMB,
    useWebWorker: true,
    fileType: 'image/webp' as const,
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return new File(
      [compressedFile],
      file.name.replace(/\.[^.]+$/, '.webp'),
      { type: 'image/webp' }
    );
  } catch (error) {
    console.error('Image compression failed, using original:', error);
    return file;
  }
}

/**
 * Compress an attachment image to WebP using canvas.
 * Skips GIFs (animated) and SVGs (vector). Skips files under 500KB.
 * Falls back to the original file on error or if compressed is larger.
 */
export async function compressAttachmentImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1080,
  quality = 0.85,
): Promise<File> {
  // Skip GIFs (preserve animation) and SVGs (vector format)
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }

  // Skip if already small enough (under 500KB)
  if (file.size < 500 * 1024) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if needed
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file); // compressed is larger, keep original
            return;
          }
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, '.webp'),
            { type: 'image/webp' },
          );
          resolve(compressedFile);
        },
        'image/webp',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
