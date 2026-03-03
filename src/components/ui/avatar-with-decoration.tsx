import { useEffect, useMemo, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import { getAvatarDecoration, DEFAULT_AVATAR_DECORATION_TRANSFORM } from '@/lib/avatarDecorations';
import type { AvatarDecorationTransform } from '@/lib/avatarDecorations';

// Cache still frames per decoration URL to avoid re-capturing and to prevent "animated before still ready"
const stillFrameCache = new Map<string, string>();
const animatedCache = new Map<string, boolean>();

const toAscii = (bytes: Uint8Array, start: number, len: number) => {
  let out = '';
  for (let i = 0; i < len; i++) out += String.fromCharCode(bytes[start + i] ?? 0);
  return out;
};

const includesAscii = (bytes: Uint8Array, needle: string): boolean => {
  const n = needle.length;
  if (n === 0) return true;
  // naive scan is fine here; files are small and results are cached
  for (let i = 0; i <= bytes.length - n; i++) {
    let ok = true;
    for (let j = 0; j < n; j++) {
      if (bytes[i + j] !== needle.charCodeAt(j)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
};

const detectAnimated = async (url: string, signal?: AbortSignal): Promise<boolean> => {
  if (animatedCache.has(url)) return animatedCache.get(url)!;

  // Fast path: .gif is treated as animated (even single-frame gifs are rare, and this keeps behavior consistent)
  if (/\.(gif)(\?|#|$)/i.test(url)) {
    animatedCache.set(url, true);
    return true;
  }

  const res = await fetch(url, { signal, cache: 'force-cache' });
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);

  // PNG: APNG contains an acTL chunk
  const isPng = bytes.length >= 8 && toAscii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n';
  if (isPng) {
    const animated = includesAscii(bytes, 'acTL');
    animatedCache.set(url, animated);
    return animated;
  }

  // WEBP: animated webp contains ANIM/ANMF chunks
  const isWebp =
    bytes.length >= 12 &&
    toAscii(bytes, 0, 4) === 'RIFF' &&
    toAscii(bytes, 8, 4) === 'WEBP';
  if (isWebp) {
    const animated = includesAscii(bytes, 'ANIM') || includesAscii(bytes, 'ANMF');
    animatedCache.set(url, animated);
    return animated;
  }

  // Unknown formats treated as static
  animatedCache.set(url, false);
  return false;
};

interface AvatarWithDecorationProps {
  user: User | null | undefined;
  className?: string;
  size?: number;
  showDecoration?: boolean;
  decorationTransformOverride?: Partial<AvatarDecorationTransform>;
  /**
   * When true, show the animated decoration asset (if it is animated).
   * When false, show a captured still frame so animations do not play.
   */
  active?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export const AvatarWithDecoration = ({ 
  user, 
  className,
  size,
  showDecoration = true,
  decorationTransformOverride,
  active = false,
  onClick,
}: AvatarWithDecorationProps) => {
  const decoration = useMemo(() => {
    return getAvatarDecoration(user?.avatar_decoration);
  }, [user?.avatar_decoration]);
  const decorationImage = decoration?.src ?? null;
  const baseTransform = decoration?.transform ?? DEFAULT_AVATAR_DECORATION_TRANSFORM;
  const decorationTransform = {
    scale: decorationTransformOverride?.scale ?? baseTransform.scale,
    offsetXPercent: decorationTransformOverride?.offsetXPercent ?? baseTransform.offsetXPercent,
    offsetYPercent: decorationTransformOverride?.offsetYPercent ?? baseTransform.offsetYPercent,
  };

  const [isAnimated, setIsAnimated] = useState<boolean | null>(null);
  useEffect(() => {
    if (!decorationImage) {
      setIsAnimated(null);
      return;
    }
    // Prefer cached result synchronously if available
    if (animatedCache.has(decorationImage)) {
      setIsAnimated(animatedCache.get(decorationImage)!);
      return;
    }
    const controller = new AbortController();
    setIsAnimated(null);
    detectAnimated(decorationImage, controller.signal)
      .then((val) => setIsAnimated(val))
      .catch(() => {
        // If detection fails, be conservative: treat as animated to avoid autoplay when inactive
        setIsAnimated(true);
      });
    return () => controller.abort();
  }, [decorationImage]);

  // We can't "pause" an animated image with CSS.
  // So: capture the first frame as a data URL and use that when inactive.
  const [stillDecorationSrc, setStillDecorationSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (decorationImage && stillFrameCache.has(decorationImage)) {
      setStillDecorationSrc(stillFrameCache.get(decorationImage)!);
    } else {
      setStillDecorationSrc(null);
    }
    if (!decorationImage) return () => {};

    // Always capture for anything that might be animated (.gif/.webp/.png apng).
    // For confirmed-static images, we can skip capture.
    if (isAnimated === false) return () => {};

    const img = new Image();
    img.decoding = 'async';
    img.src = decorationImage;
    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      // Draw first decoded frame
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const dataUrl = canvas.toDataURL('image/png');
        stillFrameCache.set(decorationImage, dataUrl);
        if (!cancelled) setStillDecorationSrc(dataUrl);
      } catch {
        // If data URL fails for any reason, we keep stillDecorationSrc as null.
        // For animated images we will avoid rendering when inactive (see below),
        // so this will just mean "no decoration shown unless active".
        if (!cancelled) setStillDecorationSrc(null);
      }
    };
    return () => {
      cancelled = true;
    };
  }, [decorationImage, isAnimated]);

  const decorationSrc = decorationImage
    ? active
      ? decorationImage
      : isAnimated === false
        ? decorationImage
        : stillDecorationSrc // animated or unknown: if still not ready, show nothing (prevents autoplay)
    : null;

  return (
    <div 
      className={cn('relative', className)}
      style={size ? { width: size, height: size } : undefined}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent); } : undefined}
    >
      <Avatar className="w-full h-full">
        <AvatarImage src={user?.avatar_url || undefined} />
        <AvatarFallback style={{ backgroundColor: user?.banner_color || '#5865F2' }}>
          {user?.username?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      {showDecoration && decorationSrc && (
        <img
          src={decorationSrc}
          alt="Avatar decoration"
          className={cn(
            'absolute inset-0 w-full h-full object-contain pointer-events-none',
            'transition-opacity duration-200'
          )}
          style={{ 
            imageRendering: 'pixelated',
            transform: `translate(${decorationTransform.offsetXPercent}%, ${decorationTransform.offsetYPercent}%) scale(${decorationTransform.scale})`,
            transformOrigin: 'center center',
          }}
        />
      )}
    </div>
  );
};
