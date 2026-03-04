import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
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
  onClick,
}: AvatarWithDecorationProps) => {
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
    </div>
  );
};
