import { memo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { AVAILABLE_NAMEPLATES, type NameplateId, type NameplateFormat } from '@/types';

const nameplateMap: Record<NameplateId, { src: string; format: NameplateFormat }> = Object.fromEntries(
  AVAILABLE_NAMEPLATES.map((p) => [p.id, { src: p.src, format: p.format }]),
) as Record<NameplateId, { src: string; format: NameplateFormat }>;

interface NameplateVideoProps {
  nameplate: string | null | undefined;
  className?: string;
  isHovered?: boolean;   // driven by parent — play animated formats when true
  forcePlay?: boolean;   // for preview modals — always play
}

/**
 * Renders a nameplate behind content (e.g. username area).
 * - .png: static image, always visible
 * - .webm / .gif: animated, paused until isHovered or forcePlay
 *
 * The container is pointer-events-none, so hover is driven by the parent
 * via the isHovered prop.
 */
export const NameplateVideo = memo(function NameplateVideo({
  nameplate,
  className,
  isHovered = false,
  forcePlay = false,
}: NameplateVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const gifRef = useRef<HTMLImageElement>(null);

  const plate = nameplate && nameplate in nameplateMap
    ? nameplateMap[nameplate as NameplateId]
    : null;

  const shouldPlay = forcePlay || isHovered;

  // WEBM — control playback via ref
  useEffect(() => {
    if (plate?.format !== 'webm') return;
    const v = videoRef.current;
    if (!v) return;
    if (shouldPlay && v.paused) {
      v.play().catch(() => {});
    } else if (!shouldPlay && !v.paused) {
      v.pause();
      v.currentTime = 0;
    }
  }, [shouldPlay, plate?.format]);

  // GIF — control by swapping key to force reload (restart) or pause
  // Browsers don't let you pause a GIF via JS, so we swap between
  // a playing version (key="playing") and a paused version (key="paused")
  // by appending a cache-busting param on the playing src.
  const gifSrc = plate?.src ?? '';
  const gifKey = shouldPlay ? `play-${gifSrc}` : `stop-${gifSrc}`;
  // When transitioning from paused → playing, bust the cache so the GIF restarts
  const gifSrcPlaying = shouldPlay ? `${gifSrc}?t=${Date.now()}` : gifSrc;

  if (!plate) return null;

  // Gradient mask: nameplate fades in from transparent on the left to opaque
  // on the right, so the name text on the left reads cleanly over the parent
  // background while the nameplate art appears from the right side.
  const maskStyle = {
    WebkitMaskImage: 'linear-gradient(to right, transparent 0%, transparent 25%, black 75%, black 100%)',
    maskImage: 'linear-gradient(to right, transparent 0%, transparent 25%, black 75%, black 100%)',
  } as const;

  // Static PNG — always visible
  if (plate.format === 'png') {
    return (
      <div
        className={cn(
          'absolute inset-0 z-0 overflow-hidden rounded-xl pointer-events-none',
          className,
        )}
        style={maskStyle}
      >
        <img
          className="absolute inset-0 w-full h-full object-cover"
          src={plate.src}
          alt=""
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>
    );
  }

  // GIF — paused by default, play on hover
  if (plate.format === 'gif') {
    return (
      <div
        className={cn(
          'absolute inset-0 z-0 overflow-hidden rounded-xl pointer-events-none',
          className,
        )}
        style={maskStyle}
      >
        <img
          ref={gifRef}
          className="absolute inset-0 w-full h-full object-cover"
          src={shouldPlay ? gifSrcPlaying : gifSrc}
          key={gifKey}
          alt=""
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>
    );
  }

  // WEBM — video element, play/pause controlled by isHovered
  return (
    <div
      className={cn(
        'absolute inset-0 z-0 overflow-hidden rounded-xl pointer-events-none',
        className,
      )}
      style={maskStyle}
    >
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        src={plate.src}
        muted
        loop
        playsInline
        preload="metadata"
      />
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
});

NameplateVideo.displayName = 'NameplateVideo';
