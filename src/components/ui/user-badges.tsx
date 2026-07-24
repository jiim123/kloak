import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Badge } from '@/types/badge';

interface UserBadgesProps {
  badges: Badge[];
  className?: string;
}

/**
 * Displays user badges with hover tooltips
 */
export const UserBadges = ({ badges, className = '' }: UserBadgesProps) => {
  if (badges.length === 0) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className={`inline-flex items-center gap-1 ${className}`}>
        {badges.map((badge) => (
          <Tooltip key={badge.id}>
            <TooltipTrigger asChild>
              <img
                src={badge.icon_url}
                alt={badge.name}
                className="h-6 w-6 object-contain cursor-pointer transition-transform hover:scale-110"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="font-medium">{badge.name}</p>
              {badge.description && (
                <p className="text-xs text-muted-foreground">{badge.description}</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};
