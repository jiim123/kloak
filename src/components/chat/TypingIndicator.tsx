import { motion, AnimatePresence } from "framer-motion";
import type { TypingUser } from "@/types";

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  const clampName = (value: string | null | undefined): string => {
    const normalized = (value ?? '').trim();
    if (!normalized) return 'Unknown';
    return normalized.length > 32 ? `${normalized.slice(0, 32)}…` : normalized;
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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="h-6 min-w-0 px-4 flex items-center gap-2 text-sm text-muted-foreground"
      >
        {/* Shimmer typing indicator - sliding gradient highlight */}
        <div className="relative w-10 h-1.5 bg-foreground/20 rounded-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 w-6 rounded-full"
            style={{
              background: "linear-gradient(90deg, transparent, hsl(var(--foreground) / 0.6), transparent)",
            }}
            animate={{
              x: [-24, 40],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
        <span className="truncate">{formatTypingText()}</span>
      </motion.div>
    </AnimatePresence>
  );
};
