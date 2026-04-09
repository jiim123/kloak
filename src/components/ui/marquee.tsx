import { cn } from "@/lib/utils";
import React, { useRef, useCallback } from "react";

interface MarqueeProps {
  children: React.ReactNode;
  pauseOnHover?: boolean;
  duration?: string;
  className?: string;
}

export function Marquee({
  children,
  pauseOnHover = false,
  duration = "50s",
  className,
}: MarqueeProps) {
  const track1 = useRef<HTMLDivElement>(null);
  const track2 = useRef<HTMLDivElement>(null);

  const pause = useCallback(() => {
    if (track1.current) track1.current.style.animationPlayState = "paused";
    if (track2.current) track2.current.style.animationPlayState = "paused";
  }, []);

  const resume = useCallback(() => {
    if (track1.current) track1.current.style.animationPlayState = "running";
    if (track2.current) track2.current.style.animationPlayState = "running";
  }, []);

  const trackStyle: React.CSSProperties = {
    display: "flex",
    flexShrink: 0,
    gap: "1rem",
    animation: `marquee-scroll ${duration} linear infinite`,
  };

  return (
    <div className={cn("relative", className)}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(calc(-100% - 1rem)); }
        }
      `}} />
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-24 md:w-40 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-24 md:w-40 bg-gradient-to-l from-background to-transparent" />
      {/* Scroll container */}
      <div
        className="overflow-hidden"
        onMouseEnter={pauseOnHover ? pause : undefined}
        onMouseLeave={pauseOnHover ? resume : undefined}
      >
        <div style={{ display: "flex", gap: "1rem" }}>
          <div ref={track1} style={trackStyle}>{children}</div>
          <div ref={track2} style={trackStyle}>{children}</div>
        </div>
      </div>
    </div>
  );
}
