import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  control?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/**
 * One row inside a SettingsCard: label/description on the left,
 * a control on the right. Stacks on mobile.
 */
export function SettingsRow({
  label,
  description,
  control,
  className,
  children,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 py-3",
        "sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="space-y-1 min-w-0 flex-1">
        <div className="text-foreground font-medium text-sm leading-tight">
          {label}
        </div>
        {description && (
          <div className="text-muted-foreground text-xs leading-snug">
            {description}
          </div>
        )}
      </div>
      {(control || children) && (
        <div className="flex-shrink-0 sm:ml-4">{control ?? children}</div>
      )}
    </div>
  );
}
