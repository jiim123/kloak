import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { type CSSProperties, type ReactNode, useMemo } from "react";
import type { TypingUser } from "@/types";

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  overlay?: boolean;
  reserveSpace?: boolean;
  className?: string;
  rightContent?: ReactNode;
}

const ShimmerText = ({ children, duration = 2, spread = 2 }: { children: string; duration?: number; spread?: number }) => {
  const dynamicSpread = useMemo(() => children.length * spread, [children, spread]);

  return (
    <motion.span
      className="text-xs font-medium truncate [--base-color:#666666] [--base-gradient-color:#999999] bg-clip-text text-transparent bg-[length:250%_100%,auto] bg-[linear-gradient(90deg,var(--base-color)_calc(50%-var(--spread)),var(--base-gradient-color)_50%,var(--base-color)_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]"
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{ repeat: Infinity, duration, ease: "linear" }}
      style={{ "--spread": `${dynamicSpread}px` } as CSSProperties}
    >
      {children}
    </motion.span>
  );
};

export const TypingIndicator = ({
  typingUsers,
  overlay = false,
  reserveSpace = false,
  className,
  rightContent,
}: TypingIndicatorProps) => {
  const clampName = (value: string | null | undefined): string => {
    const normalized = (value ?? "").trim();
    if (!normalized) return "Unknown";
    return normalized.length > 32 ? `${normalized.slice(0, 32)}...` : normalized;
  };

  const formatTypingText = (): string => {
    const names = typingUsers.map((u) => clampName(u.display_name || u.username));

    if (names.length === 1) {
      return `${names[0]} is typing`;
    } else if (names.length === 2) {
      return `${names[0]} and ${names[1]} are typing`;
    } else {
      return `${names[0]} and ${names.length - 1} others are typing`;
    }
  };

  if (typingUsers.length === 0) {
    if (!reserveSpace || overlay) return null;
    return (
      <div className={cn("min-w-0 px-4 flex items-center justify-end shrink-0 overflow-hidden h-6", className)}>
        {rightContent}
      </div>
    );
  }

  const typingText = `${formatTypingText()}...`;

  const dots = (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/80 animate-pulse"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </span>
  );

  if (overlay) {
    return (
      <div className={cn("pointer-events-none absolute bottom-full left-4 right-4 z-20", className)}>
        <div className="h-8 rounded-t-xl bg-gradient-to-t from-background via-background/90 to-transparent" />
        <div className="absolute bottom-1 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-2 text-xs text-muted-foreground">
          {dots}
          <ShimmerText>{typingText}</ShimmerText>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 px-4 flex items-center justify-between gap-2 shrink-0 overflow-hidden h-6">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full">
        {dots}
        <ShimmerText>{typingText}</ShimmerText>
      </div>
      <div className="shrink-0">{rightContent}</div>
    </div>
  );
};
