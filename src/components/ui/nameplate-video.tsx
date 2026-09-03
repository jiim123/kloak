import { memo, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AVAILABLE_NAMEPLATES, type NameplateId } from '@/types';

const nameplateSrcMap: Record<NameplateId, string> = Object.fromEntries(
  AVAILABLE_NAMEPLATES.map((p) => [p.id, p.videoSrc]),
) as Record<NameplateId, string>;

interface NameplateVideoProps {
  nameplate: string | null | undefined;
  className?: string;
}

/**
 * Renders an animated .webm nameplate behind content (e.g. username area).
 * The video is muted, autoplay, loop, and covers the container.
 * Only renders when a valid nameplate key is provided.
 */
export const NameplateVideo = memo(function NameplateVideo({
  nameplate,
  className,
}: NameplateVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Validate the nameplate key — only render for known IDs
  const src = nameplate && nameplate in nameplateSrcMap
    ? nameplateSrcMap[nameplate as NameplateId]
    : null;

  const handleMouseMove = useCallback(() => {
    // Ensure video is playing when hovered
    const v = videoRef.current;
    if (v && v.paused) {
      v.play().catch(() => {});
    }
  }, []);

  if (!src) return null;

  return (
    <div
      className={cn(
        'absolute inset-0 z-0 overflow-hidden rounded-xl pointer-events-none',
        className,
      )}
      onMouseMove={handleMouseMove}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
      />
      {/* Dark overlay to ensure text readability */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
});

NameplateVideo.displayName = 'NameplateVideo';
