import { Crown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NitroBadgeProps {
  planId: string;
  className?: string;
}

/**
 * Displays a Kloak Prime subscriber badge next to user names.
 */
export const NitroBadge = ({ className = "" }: NitroBadgeProps) => {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center justify-center h-6 w-6 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 shadow-[0_0_8px_rgba(245,158,11,0.4)] transition-transform hover:scale-110 ${className}`}
          >
            <Crown className="h-3.5 w-3.5 text-white drop-shadow-sm" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">Kloak Prime</p>
          <p className="text-xs text-muted-foreground">
            Premium subscriber
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
