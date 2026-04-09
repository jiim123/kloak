import { cn } from "@/lib/utils";
import React, { useRef, useCallback } from "react";

interface MarqueeProps extends React.HTMLAttributes<HTMLDivElement> {
  pauseOnHover?: boolean;
  reverse?: boolean;
  duration?: string;
  fade?: boolean;
  /** CSS selector for child elements that trigger pause on hover. Defaults to direct children of the track. */
  pauseSelector?: string;
}

export function Marquee({
  children,
  pauseOnHover = false,
  reverse = false,
  duration = "40s",
  fade = true,
  pauseSelector,
  className,
  ...props
}: MarqueeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverCountRef = useRef(0);

  const setPlayState = useCallback((state: "paused" | "running") => {
    const tracks = containerRef.current?.querySelectorAll(".marquee-track");
    tracks?.forEach((el) => {
      (el as HTMLElement).style.animationPlayState = state;
    });
  }, []);

  const onCardEnter = useCallback(() => {
    hoverCountRef.current++;
    setPlayState("paused");
  }, [setPlayState]);

  const onCardLeave = useCallback(() => {
    hoverCountRef.current--;
    if (hoverCountRef.current <= 0) {
      hoverCountRef.current = 0;
      setPlayState("running");
    }
  }, [setPlayState]);

  // Wrap children to attach hover handlers per-item
  const wrappedChildren = pauseOnHover
    ? React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        return React.cloneElement(child as React.ReactElement<any>, {
          onMouseEnter: (e: React.MouseEvent) => {
            onCardEnter();
            (child as any).props.onMouseEnter?.(e);
          },
          onMouseLeave: (e: React.MouseEvent) => {
            onCardLeave();
            (child as any).props.onMouseLeave?.(e);
          },
        });
      })
    : children;

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
        >
          {wrappedChildren}
        </div>
      ))}
    </div>
  );
}
