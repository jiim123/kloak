import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DangerZoneProps {
  title?: ReactNode;
  description?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Destructive-action section. Uses a red-tinted border on the standard
 * SettingsCard surface.
 */
export function DangerZone({
  title = "Danger zone",
  description,
  className,
  children,
}: DangerZoneProps) {
  return (
    <section
      className={cn(
        "rounded-[6px] border border-destructive/40 bg-card",
        "p-4 md:p-5 space-y-3",
        className,
      )}
    >
      {(title || description) && (
        <div className="space-y-1">
          {title && (
            <h3 className="text-destructive font-semibold text-base leading-tight">
              {title}
            </h3>
          )}
          {description && (
            <p className="text-muted-foreground text-sm leading-snug">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
