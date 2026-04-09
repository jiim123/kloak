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
  const tracksRef = useRef<(HTMLDivElement | null)[]>([]);

  const pause = useCallback(() => {
    tracksRef.current.forEach((el) => {
      if (el) el.style.animationPlayState = "paused";
    });
  }, []);

  const resume = useCallback(() => {
    tracksRef.current.forEach((el) => {
      if (el) el.style.animationPlayState = "running";
    });
  }, []);

  // Wrap children so each item gets hover handlers for pause
  const itemProps = pauseOnHover
    ? { onMouseEnter: pause, onMouseLeave: resume }
    : {};

  return (
    <div
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
      {[0, 1].map((i) => (
        <div
          key={i}
          ref={(el) => { tracksRef.current[i] = el; }}
          className="marquee-track flex shrink-0 gap-[var(--gap)]"
          style={{
            animationName: "marquee",
            animationDuration: duration,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationDirection: reverse ? "reverse" : "normal",
          }}
        >
          {React.Children.map(children, (child, idx) => (
            <div key={idx} {...itemProps}>
              {child}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
