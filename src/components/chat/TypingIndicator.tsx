import { motion, AnimatePresence } from "framer-motion";
import type { TypingUser } from "@/types";

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
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
    <div className="h-8 min-w-0 px-4 flex items-center shrink-0">
      <AnimatePresence mode="wait">
        {typingUsers.length > 0 && (
          <motion.div
            key="typing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full border"
            style={{
              borderColor: "#666666",
              color: "#666666",
            }}
          >
            {/* Shimmer typing indicator */}
            <div
              className="relative w-8 h-1.5 rounded-full overflow-hidden"
              style={{ backgroundColor: "rgba(102, 102, 102, 0.25)" }}
            >
              <motion.div
                className="absolute inset-y-0 w-5 rounded-full"
                style={{
                  background: "linear-gradient(90deg, transparent, #666666, transparent)",
                }}
                animate={{
                  x: [-20, 32],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />
            </div>
            <span className="text-xs font-medium truncate">{formatTypingText()}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
