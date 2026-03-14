import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getGifStillPreview } from "@/lib/gifPreview";
import type { User } from '@/types';
import type { AvatarDecorationTransform } from '@/lib/avatarDecorations';

interface AvatarWithDecorationProps {
  user: User | null | undefined;
  className?: string;
  size?: number;
  showDecoration?: boolean;
  decorationTransformOverride?: Partial<AvatarDecorationTransform>;
  active?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  freezeGifUntilHover?: boolean;
}

/**
 * Avatar decorations are currently disabled.
 * The component still accepts decoration-related props for API compatibility
 * but does not render any decoration overlay.
 */
export const AvatarWithDecoration = ({ 
  user, 
  className,
  size,
  active = false,
  onClick,
  freezeGifUntilHover = false,
}: AvatarWithDecorationProps) => {
  const avatarUrl = user?.avatar_url || undefined;
  const [gifPreviewSrc, setGifPreviewSrc] = useState<string | null>(null);
  const [isGifHovered, setIsGifHovered] = useState(false);

  useEffect(() => {
    if (!freezeGifUntilHover || !avatarUrl) {
      setGifPreviewSrc(null);
      setIsGifHovered(false);
      return;
    }

    let cancelled = false;

    getGifStillPreview(avatarUrl).then((previewSrc) => {
      if (cancelled) return;
      setGifPreviewSrc(previewSrc);
    });

    return () => {
      cancelled = true;
    };
  }, [avatarUrl, freezeGifUntilHover]);

  const displayAvatarUrl =
    freezeGifUntilHover && gifPreviewSrc && !(active || isGifHovered) ? gifPreviewSrc : avatarUrl;

  return (
    <div 
      className={cn('relative', className)}
      style={size ? { width: size, height: size } : undefined}
      onClick={onClick}
      onMouseEnter={freezeGifUntilHover && gifPreviewSrc ? () => setIsGifHovered(true) : undefined}
      onMouseLeave={freezeGifUntilHover && gifPreviewSrc ? () => setIsGifHovered(false) : undefined}
      onFocus={freezeGifUntilHover && gifPreviewSrc ? () => setIsGifHovered(true) : undefined}
      onBlur={freezeGifUntilHover && gifPreviewSrc ? () => setIsGifHovered(false) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(e as unknown as React.MouseEvent); } : undefined}
    >
      <Avatar className="w-full h-full">
        <AvatarImage src={displayAvatarUrl} />
        <AvatarFallback style={{ backgroundColor: user?.banner_color || '#5865F2' }}>
          {user?.username?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
    </div>
  );
};
