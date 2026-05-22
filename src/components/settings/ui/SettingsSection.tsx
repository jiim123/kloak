import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * Standard settings section: bold, bright heading + muted description,
 * followed by content. Use to wrap groups of related settings.
 */
export function SettingsSection({
  title,
  description,
  action,
  className,
  children,
}: SettingsSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description || action) && (
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            {title && (
              <h3 className="text-foreground font-semibold text-base leading-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-muted-foreground text-sm leading-snug">
                {description}
              </p>
            )}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
