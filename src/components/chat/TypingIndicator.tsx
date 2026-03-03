import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import type { TypingUser } from "@/types";

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
  overlay?: boolean;
  className?: string;
}

export const TypingIndicator = ({ typingUsers, overlay = false, className }: TypingIndicatorProps) => {
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

  const typingText = `${formatTypingText()}...`;

  const dots = (
    <span className="inline-flex items-center gap-1">
      {[0, 0.18, 0.36].map((delay) => (
        <motion.span
          key={delay}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/80"
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay }}
        />
      ))}
    </span>
  );

  if (overlay) {
    return (
      <AnimatePresence initial={false}>
        {typingUsers.length > 0 && (
          <motion.div
            key="typing-overlay"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={cn("pointer-events-none absolute bottom-full left-4 right-4 z-20", className)}
          >
            <div className="h-8 rounded-t-xl bg-gradient-to-t from-background via-background/90 to-transparent" />
            <div className="absolute bottom-1 left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-2 text-xs text-muted-foreground">
              {dots}
              <span className="truncate">{typingText}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {typingUsers.length > 0 && (
        <motion.div
          key="typing-row"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 32 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="min-w-0 px-4 flex items-center shrink-0 overflow-hidden"
        >
          <motion.div
            key="typing"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.95 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border"
            style={{
              borderColor: "#666666",
              color: "#666666",
            }}
          >
            {dots}
            <span className="text-xs font-medium truncate">{typingText}</span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
