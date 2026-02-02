import { useState, useEffect, useRef, useCallback } from 'react';
import { Hash, Volume2, Megaphone, Film } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useServerStore } from '@/stores/serverStore';
import { cn } from '@/lib/utils';
import type { Channel } from '@/types';

interface ChannelOption {
  id: string;
  name: string;
  type: string;
}

interface ChannelAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (option: ChannelOption) => void;
  onClose: () => void;
}

const getChannelIcon = (type: string) => {
  switch (type) {
    case 'voice':
      return <Volume2 className="w-4 h-4" />;
    case 'announcement':
      return <Megaphone className="w-4 h-4" />;
    case 'media':
      return <Film className="w-4 h-4" />;
    default:
      return <Hash className="w-4 h-4" />;
  }
};

export const ChannelAutocomplete = ({
  query,
  position,
  onSelect,
  onClose,
}: ChannelAutocompleteProps) => {
  const { channels } = useServerStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build options list - filter text channels only (you can't really "go to" voice channels via link)
  const options: ChannelOption[] = channels
    .filter(c => 
      c.type === 'text' && 
      c.name.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 10)
    .map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type || 'text',
    }));

  // Reset selection when options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (options.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % options.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
        break;
      case 'Enter':
      case 'Tab':
        e.preventDefault();
        onSelect(options[selectedIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [options, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (options.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        bottom: position.top,
        left: position.left,
      }}
    >
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
        Channels
      </div>
      <ScrollArea className="max-h-48">
        {options.map((option, index) => (
          <div
            key={option.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
              index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
            )}
            onClick={() => onSelect(option)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              {getChannelIcon(option.type)}
            </div>
            <span className="font-medium text-sm truncate">
              #{option.name}
            </span>
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};
