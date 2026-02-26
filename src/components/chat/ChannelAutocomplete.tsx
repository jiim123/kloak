import { useState, useEffect, useRef, useCallback } from "react";
import { Hash, Volume2, Megaphone, Film, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useServerStore } from "@/stores/serverStore";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types";

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
  onOptionsChange?: (hasOptions: boolean) => void;
}

const getChannelIcon = (type: string) => {
  switch (type) {
    case "voice":
      return <Volume2 className="w-4 h-4" />;
    case "announcement":
      return <Megaphone className="w-4 h-4" />;
    case "forum":
      return <MessageSquare className="w-4 h-4" />;
    case 'media':
      return <Film className="w-4 h-4" />;
    default:
      return <Hash className="w-4 h-4" />;
  }
};

export const ChannelAutocomplete = ({ query, position, onSelect, onClose, onOptionsChange }: ChannelAutocompleteProps) => {
  const { channels } = useServerStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build options list - include channel types that can be linked with #mentions
  const options: ChannelOption[] = channels
    .filter(
      (c) =>
        (c.type === "text" ||
          c.type === "announcement" ||
          c.type === "forum" ||
          c.type === "media" ||
          c.type === "voice") &&
        c.name.toLowerCase().includes(query.toLowerCase()),
    )
    .slice(0, 10)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      type: channel.type || "text",
    }));

  // Reset selection when options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    onOptionsChange?.(options.length > 0);
    return () => onOptionsChange?.(false);
  }, [options.length, onOptionsChange]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (options.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % options.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          onSelect(options[selectedIndex]);
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [options, selectedIndex, onSelect, onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (options.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="absolute z-50 w-72 bg-card/95 backdrop-blur-sm border border-border/50 rounded-xl shadow-xl overflow-hidden"
      style={{
        bottom: position.top,
        left: position.left,
      }}
    >
      <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
        Channels
      </div>
      <ScrollArea className="max-h-52">
        <div className="p-1">
          {options.map((option, index) => (
            <div
              key={option.id}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg transition-colors duration-150",
                index === selectedIndex
                  ? "bg-primary/10 text-foreground"
                  : "text-foreground/80 hover:bg-muted/50 hover:text-foreground",
              )}
              onClick={() => onSelect(option)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
                  index === selectedIndex ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {getChannelIcon(option.type)}
              </div>
              <span className="font-medium text-[13px] truncate">#{option.name}</span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
