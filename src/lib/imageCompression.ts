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
