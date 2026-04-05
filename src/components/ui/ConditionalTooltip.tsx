import * as React from "react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface ConditionalTooltipProps {
  enabled: boolean;
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delayDuration?: number;
  className?: string;
}

/**
 * Renders a Tooltip only when `enabled` is true.
 * When disabled, renders children directly — avoids the
 * controlled/uncontrolled switching warning from Radix.
 */
export const ConditionalTooltip = ({
  enabled,
  children,
  content,
  side = "right",
  delayDuration = 300,
  className,
}: ConditionalTooltipProps) => {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={className}>
        {content}
      </TooltipContent>
    </Tooltip>
  );
};
