import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const SettingsCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[6px] border border-border/50 bg-card text-card-foreground",
        "p-4 md:p-5",
        className,
      )}
      {...props}
    />
  ),
);
SettingsCard.displayName = "SettingsCard";
