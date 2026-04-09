import { cn } from "@/lib/utils";
import React from "react";

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  pauseOnHover?: boolean;
  reverse?: boolean;
  duration?: string;
}

export function Marquee({
  children,
  pauseOnHover = false,
  reverse = false,
  duration = "40s",
  className,
  ...props
}: MarqueeProps) {
  return (
    <div
      className={cn("group flex overflow-hidden [--gap:1rem] gap-[var(--gap)]", className)}
      {...props}
    >
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex shrink-0 gap-[var(--gap)] animate-marquee",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
            reverse && "[animation-direction:reverse]"
          )}
          style={{ animationDuration: duration }}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
