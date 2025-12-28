import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { channelEmojis, emojiCategories, getEmojisByCategory, type EmojiCategory } from '@/lib/notoEmoji';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Hash, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChannelIconPickerProps {
  value: string | null;
  onChange: (icon: string | null) => void;
  disabled?: boolean;
}

export const ChannelIconPicker = ({ value, onChange, disabled }: ChannelIconPickerProps) => {
  const [open, setOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<EmojiCategory>('Communication');

  const handleSelect = (char: string) => {
    onChange(char);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-14 h-14 p-0 relative overflow-hidden transition-all duration-200',
            'hover:border-primary/50 hover:bg-secondary/50',
            value && 'border-primary/30'
          )}
        >
          <AnimatePresence mode="wait">
            {value ? (
              <motion.span
                key="emoji"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className="text-2xl font-emoji"
              >
                {value}
              </motion.span>
            ) : (
              <motion.div
                key="hash"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
              >
                <Hash className="w-6 h-6 text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {value && (
            <button
              onClick={handleClear}
              className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent 
        className="w-80 p-0 overflow-hidden"
        align="start"
        sideOffset={8}
      >
        <div className="p-2 border-b border-border bg-secondary/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Choose Channel Icon
          </p>
        </div>
        
        {/* Category tabs */}
        <ScrollArea className="w-full">
          <div className="flex gap-1 p-2 border-b border-border overflow-x-auto">
            {emojiCategories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap',
                  activeCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </ScrollArea>
        
        {/* Emoji grid */}
        <ScrollArea className="h-48">
          <div className="grid grid-cols-7 gap-1 p-2">
            <AnimatePresence mode="popLayout">
              {getEmojisByCategory(activeCategory).map((emoji, index) => (
                <motion.button
                  key={emoji.char}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ delay: index * 0.02 }}
                  onClick={() => handleSelect(emoji.char)}
                  className={cn(
                    'w-9 h-9 flex items-center justify-center rounded-md text-xl',
                    'hover:bg-secondary transition-colors',
                    value === emoji.char && 'bg-primary/20 ring-1 ring-primary'
                  )}
                  title={emoji.name}
                >
                  <span className="font-emoji">{emoji.char}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>
        
        {/* Clear option */}
        <div className="p-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={() => handleSelect('')}
          >
            <Hash className="w-4 h-4 mr-2" />
            Use default # icon
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};