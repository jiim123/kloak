import { useMemo } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import { getAvatarDecoration, DEFAULT_AVATAR_DECORATION_TRANSFORM } from '@/lib/avatarDecorations';
import type { AvatarDecorationTransform } from '@/lib/avatarDecorations';
import { useDecorationAsset } from '@/lib/decorationPreloader';

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

  // All detection + still-frame capture is done once at module level by the preloader.
  // This hook just reads the cached result — no effects, no async work per instance.
  const asset = useDecorationAsset(decorationImage);

  const decorationSrc = decorationImage
    ? active
      ? decorationImage
      : asset?.isAnimated === false
        ? decorationImage
        : asset?.stillSrc ?? null
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
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
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
