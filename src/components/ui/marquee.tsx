import { cn } from "@/lib/utils";
import React from "react";

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  pauseOnHover?: boolean;
  reverse?: boolean;
  duration?: string;
  fade?: boolean;
}

export function Marquee({
  children,
  pauseOnHover = false,
  reverse = false,
  duration = "40s",
  fade = true,
  className,
  ...props
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "group/marquee relative flex overflow-hidden [--gap:1rem] gap-[var(--gap)]",
        className,
      )}
      {...props}
    >
      {fade && (
        <>
          <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 md:w-40 bg-gradient-to-r from-background to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 md:w-40 bg-gradient-to-l from-background to-transparent" />
        </>
      )}
      {Array.from({ length: 2 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex shrink-0 gap-[var(--gap)] [animation:marquee_var(--dur)_linear_infinite]",
            pauseOnHover && "group-hover/marquee:[animation-play-state:paused]",
            reverse && "[animation-direction:reverse]",
          )}
          style={{ "--dur": duration } as React.CSSProperties}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
