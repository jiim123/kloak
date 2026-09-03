import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface NitroBadgeProps {
  planId: string;
  subscribedSince?: string | null;
  className?: string;
}

/**
 * Displays a Kloak Prime subscriber badge next to user names.
 */
export const NitroBadge = ({ subscribedSince, className = "" }: NitroBadgeProps) => {
  const sinceDate = subscribedSince ? new Date(subscribedSince).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center justify-center h-7 w-7 transition-transform hover:scale-110 ${className}`}
          >
            <img src="/Prime.svg" alt="Kloak Prime" className="h-7 w-7" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium">Kloak Prime</p>
          <p className="text-xs text-muted-foreground">
            {sinceDate ? `Prime subscriber since ${sinceDate}` : "Prime subscriber"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
