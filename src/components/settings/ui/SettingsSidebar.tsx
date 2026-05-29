import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SettingsSidebarItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  destructive?: boolean;
  onSelect?: () => void;
}

export interface SettingsSidebarGroup {
  label?: ReactNode;
  items: SettingsSidebarItem[];
}

interface SettingsSidebarProps {
  groups: SettingsSidebarGroup[];
  activeId?: string;
  onChange?: (id: string) => void;
  footer?: ReactNode;
  className?: string;
}

/**
 * Vertical settings nav rail. Bright/bold group labels, muted inactive items,
 * highlighted active item. Used inside SettingsLayout.
 */
export function SettingsSidebar({
  groups,
  activeId,
  onChange,
  footer,
  className,
}: SettingsSidebarProps) {
  return (
    <nav
      className={cn(
        "flex flex-col h-full overflow-hidden",
        className,
      )}
      aria-label="Settings"
    >
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {groups.map((group, gi) => (
          <div key={gi} className="space-y-1">
            {group.label && (
              <div className="px-2 mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    item.onSelect?.();
                    onChange?.(item.id);
                  }}
                  className={cn(
                    "w-full h-11 md:h-9 px-2.5 rounded-md inline-flex items-center gap-2 text-sm font-medium transition-colors text-left",
                    isActive
                      ? "bg-secondary text-foreground"
                      : item.destructive
                        ? "text-destructive hover:bg-secondary/60"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  {item.icon && (
                    <span className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {footer && <div className="px-3 pb-3 pt-2 border-t border-border/40">{footer}</div>}
    </nav>
  );
}
