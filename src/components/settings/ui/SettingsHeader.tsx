import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  onBack?: () => void;
  className?: string;
}

/**
 * Page-level settings header. Renders an optional mobile back button,
 * a bright/bold title, an optional muted description, and right-aligned actions.
 */
export function SettingsHeader({
  title,
  description,
  action,
  onBack,
  className,
}: SettingsHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-start justify-between gap-3 mb-6 md:mb-8",
        className,
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="md:hidden -ml-1 mt-0.5 h-8 w-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="space-y-1 min-w-0">
          <h2 className="text-foreground font-semibold text-lg md:text-xl leading-tight truncate">
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground text-sm leading-snug">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </header>
  );
}
