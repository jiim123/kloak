import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { getGifStillPreview } from "@/lib/gifPreview";
import type { User } from '@/types';
import {
  DEFAULT_AVATAR_DECORATION_TRANSFORM,
  getAvatarDecoration,
  type AvatarDecorationTransform,
} from '@/lib/avatarDecorations';

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

export const AvatarWithDecoration = ({ 
  user, 
  className,
  size,
  showDecoration = true,
  decorationTransformOverride,
  active = false,
  onClick,
  freezeGifUntilHover = false,
}: AvatarWithDecorationProps) => {
  const avatarUrl = user?.avatar_url || undefined;
  const isBot = Boolean(user?.is_bot);
  const decoration = showDecoration ? getAvatarDecoration(user?.avatar_decoration) : null;
  const decorationTransform: AvatarDecorationTransform = {
    scale:
      decorationTransformOverride?.scale ??
      decoration?.transform.scale ??
      DEFAULT_AVATAR_DECORATION_TRANSFORM.scale,
    offsetXPercent:
      decorationTransformOverride?.offsetXPercent ??
      decoration?.transform.offsetXPercent ??
      DEFAULT_AVATAR_DECORATION_TRANSFORM.offsetXPercent,
    offsetYPercent:
      decorationTransformOverride?.offsetYPercent ??
      decoration?.transform.offsetYPercent ??
      DEFAULT_AVATAR_DECORATION_TRANSFORM.offsetYPercent,
  };
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
        <AvatarFallback style={{ backgroundColor: user?.banner_color || (isBot ? '#F0C94A' : '#5865F2') }}>
          {isBot ? <Bot className="h-[55%] w-[55%] text-[#252933]" /> : user?.username?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>
      {decoration && (
        <img
          src={decoration.src}
          alt=""
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 h-full w-full select-none object-contain",
            active ? "opacity-100" : "opacity-95",
          )}
          style={{
            imageRendering: "pixelated",
            transform: `translate(${decorationTransform.offsetXPercent}%, ${decorationTransform.offsetYPercent}%) scale(${decorationTransform.scale})`,
            transformOrigin: "center center",
          }}
        />
      )}
    </div>
  );
};
