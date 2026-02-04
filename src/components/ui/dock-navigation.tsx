import { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface DockNavigationProps {
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const DockNavigation = ({ navItems, activeTab, onTabChange, className }: DockNavigationProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Initial check
    checkScroll();

    // Check on scroll
    el.addEventListener("scroll", checkScroll, { passive: true });
    
    // Check on resize
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll, navItems]);

  // Scroll active tab into view on mount
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    const activeButton = el.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeButton) {
      activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeTab]);

  return (
    <div className={cn("relative w-full", className)}>
      {/* Left gradient indicator */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/95 to-transparent rounded-l-2xl z-10 pointer-events-none transition-opacity duration-200",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-2 p-2 bg-background/95 backdrop-blur-xl rounded-2xl border border-border shadow-2xl overflow-x-auto scrollbar-hide scroll-smooth"
        style={{ 
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          msOverflowStyle: "none"
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              data-tab={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl transition-all flex-shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right gradient indicator */}
      <div 
        className={cn(
          "absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/95 to-transparent rounded-r-2xl z-10 pointer-events-none transition-opacity duration-200",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
};
