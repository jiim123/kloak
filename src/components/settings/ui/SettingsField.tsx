import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsFieldProps {
  label?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Labelled form field with consistent spacing and helper/error text.
 */
export function SettingsField({
  label,
  description,
  error,
  hint,
  htmlFor,
  className,
  children,
}: SettingsFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-foreground font-medium text-sm leading-tight block"
        >
          {label}
        </label>
      )}
      {description && (
        <p className="text-muted-foreground text-xs leading-snug">{description}</p>
      )}
      {children}
      {error ? (
        <p className="text-destructive text-xs leading-snug">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs leading-snug">{hint}</p>
      ) : null}
    </div>
  );
}
