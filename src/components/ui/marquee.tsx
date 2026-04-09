import { cn } from "@/lib/utils";
import React, { useRef, useCallback } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);

  const setPlayState = useCallback((state: "paused" | "running") => {
    const tracks = containerRef.current?.querySelectorAll(".marquee-track");
    tracks?.forEach((el) => {
      (el as HTMLElement).style.animationPlayState = state;
    });
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex overflow-hidden [--gap:1rem] gap-[var(--gap)]",
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
            "marquee-track flex shrink-0 gap-[var(--gap)]",
            reverse && "[animation-direction:reverse]",
          )}
          style={{
            animationName: "marquee",
            animationDuration: duration,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationDirection: reverse ? "reverse" : "normal",
          }}
          onMouseEnter={pauseOnHover ? () => setPlayState("paused") : undefined}
          onMouseLeave={pauseOnHover ? () => setPlayState("running") : undefined}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
