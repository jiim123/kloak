import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SettingsLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  /** Optional sticky action rendered top-right of the content column. */
  topRightAction?: ReactNode;
  className?: string;
}

/**
 * Responsive settings shell: left nav rail (desktop only) + right scrollable
 * content. On mobile the sidebar is hidden — pages should render their own
 * mobile picker (Sheet/Drawer) via the existing layout. The content column
 * constrains itself to max-w-3xl with consistent gutters across desktop sizes.
 */
export function SettingsLayout({
  sidebar,
  children,
  topRightAction,
  className,
}: SettingsLayoutProps) {
  return (
    <div
      className={cn(
        "settings-layout h-full flex bg-background text-foreground overflow-hidden",
        className,
      )}
    >
      <aside className="hidden md:flex w-[240px] flex-shrink-0 bg-layout-sidebar border-r border-border/40">
        {sidebar}
      </aside>
      <main className="flex-1 overflow-y-auto relative bg-background">
        {topRightAction && (
          <div className="absolute top-4 right-4 md:top-6 md:right-6 z-10">
            {topRightAction}
          </div>
        )}
        <div className="mx-auto w-full max-w-3xl px-4 py-5 md:px-8 md:py-8 space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
}
