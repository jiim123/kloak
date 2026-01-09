import { motion, AnimatePresence } from 'framer-motion';
import type { TypingUser } from '@/types';

interface TypingIndicatorProps {
  typingUsers: TypingUser[];
}

export const TypingIndicator = ({ typingUsers }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) return null;

  const formatTypingText = (): string => {
    const names = typingUsers.map(u => u.display_name || u.username);
    
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
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="h-6 px-4 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <div className="flex gap-0.5">
          <motion.span 
            className="w-2 h-2 bg-foreground/60 rounded-full"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0 }}
          />
          <motion.span 
            className="w-2 h-2 bg-foreground/60 rounded-full"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
          />
          <motion.span 
            className="w-2 h-2 bg-foreground/60 rounded-full"
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          />
        </div>
        <span>{formatTypingText()}...</span>
      </motion.div>
    </AnimatePresence>
  );
};