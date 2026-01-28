import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useServerStore } from "@/stores/serverStore";
import { cn } from "@/lib/utils";
import type { ServerMember, User } from "@/types";

interface MentionOption {
  type: "user" | "everyone" | "here";
  id?: string;
  label: string;
  user?: User;
}

interface MentionAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (option: MentionOption) => void;
  onClose: () => void;
  isAdmin?: boolean;
}

export const MentionAutocomplete = ({
  query,
  position,
  onSelect,
  onClose,
  isAdmin = false,
}: MentionAutocompleteProps) => {
  const { members } = useServerStore();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build options list
  const options: MentionOption[] = [];

  // Add special mentions for admins
  if (isAdmin) {
    if ("everyone".includes(query.toLowerCase())) {
      options.push({ type: "everyone", label: "everyone", id: "everyone" });
    }
    if ("here".includes(query.toLowerCase())) {
      options.push({ type: "here", label: "here", id: "here" });
    }
  }

  // Add user mentions
  const searchQuery = query.toLowerCase();
  members
    .filter(
      (m) =>
        m.user?.username?.toLowerCase().includes(searchQuery) ||
        m.user?.display_name?.toLowerCase().includes(searchQuery) ||
        m.nickname?.toLowerCase().includes(searchQuery),
    )
    .slice(0, 10)
    .forEach((member) => {
      if (member.user) {
        options.push({
          type: "user",
          id: member.user_id,
          label: member.nickname || member.user.display_name || member.user.username,
          user: member.user,
        });
      }
    });

  // Reset selection when options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
      className="absolute z-50 w-64 bg-popover border border-border rounded-lg shadow-lg overflow-hidden"
      style={{
        bottom: position.top,
        left: position.left,
      }}
    >
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase border-b border-border">
        Members
      </div>
      <ScrollArea className="max-h-48">
        {options.map((option, index) => (
          <div
            key={option.id || option.type}
            className={cn(
              "flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
              index === selectedIndex ? "bg-accent" : "hover:bg-accent/50",
            )}
            onClick={() => onSelect(option)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {option.type === "user" && option.user ? (
              <>
                <Avatar className="w-6 h-6">
                  <AvatarImage src={option.user.avatar_url || undefined} />
                  <AvatarFallback style={{ backgroundColor: option.user.banner_color }}>
                    {option.user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-sm truncate">{option.label}</span>
                {option.user.username !== option.label && (
                  <span className="text-xs text-muted-foreground truncate">@{option.user.username}</span>
                )}
              </>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-primary/80 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">@</span>
                </div>
                <span className="font-medium text-sm">@{option.label}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {option.type === "everyone" ? "Notify everyone" : "Notify online"}
                </span>
              </>
            )}
          </div>
        ))}
      </ScrollArea>
    </div>
  );
};
