import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { CustomServerRole, User } from "@/types";

interface MentionOption {
  type: "user" | "everyone" | "here" | "role";
  id?: string;
  label: string;
  user?: User;
  role?: CustomServerRole;
}

interface MentionAutocompleteProps {
  query: string;
  position: { top: number; left: number };
  onSelect: (option: MentionOption) => void;
  onClose: () => void;
  isAdmin?: boolean;
  onOptionsChange?: (hasOptions: boolean) => void;
}

export const MentionAutocomplete = ({
  query,
  position,
  onSelect,
  onClose,
  isAdmin = false,
  onOptionsChange,
}: MentionAutocompleteProps) => {
  const { members, currentServer, roles } = useServerStore();
  const userId = useAuthStore((s) => s.user?.id);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [candidateUsers, setCandidateUsers] = useState<User[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const serverId = currentServer?.id;
    if (!serverId || !userId) {
      setCandidateUsers([]);
      return;
    }

    const fallbackFromMembers = members
      .filter((m) => !!m.user)
      .map((m) => ({
        ...m.user!,
        display_name: m.nickname || m.user!.display_name,
      }));
    setCandidateUsers(fallbackFromMembers);

    const load = async () => {
      const { data, error } = await (supabase.rpc as any)("get_server_mention_candidates_secure", {
        _server_id: serverId,
        _user_id: userId,
        _query: query,
        _limit: 200,
      });
      if (cancelled || error) return;
      const rows = Array.isArray(data) ? data : [];
      const users: User[] = rows.map((row: any) => ({
        id: row.id,
        username: row.username,
        display_name: row.nickname || row.display_name || null,
        avatar_url: row.avatar_url || null,
        banner_url: null,
        avatar_decoration: null,
        profile_effect: null,
        banner_color: row.banner_color || "hsl(var(--muted))",
        profile_theme_primary: null,
        profile_theme_accent: null,
        bio: null,
        status: row.status || "offline",
        custom_status: null,
        created_at: "",
        last_seen: row.last_seen || null,
      }));
      setCandidateUsers(users);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentServer?.id, userId, query, members]);

  const blockedUserIds = useFriendStore((s) => s.visibilityBlockedUserIds);

  const options: MentionOption[] = useMemo(() => {
    const result: MentionOption[] = [];
    const seen = new Set<string>();
    const blockedSet = new Set(blockedUserIds);

    if (isAdmin) {
      if ("everyone".includes(query.toLowerCase())) {
        result.push({ type: "everyone", label: "everyone", id: "everyone" });
      }
      if ("here".includes(query.toLowerCase())) {
        result.push({ type: "here", label: "here", id: "here" });
      }
    }

    const searchQuery = query.toLowerCase();
    roles
      .filter((role) => role.name !== "@everyone" && role.name.toLowerCase().includes(searchQuery))
      .forEach((role) => {
        if (!role.id || seen.has(role.id)) return;
        seen.add(role.id);
        result.push({
          type: "role",
          id: role.id,
          label: role.name,
          role,
        });
      });

    candidateUsers
      .filter(
        (u) =>
          !blockedSet.has(u.id) &&
          (u.username?.toLowerCase().includes(searchQuery) ||
          u.display_name?.toLowerCase().includes(searchQuery)),
      )
      .forEach((user) => {
        if (!user.id || seen.has(user.id)) return;
        seen.add(user.id);
        result.push({
          type: "user",
          id: user.id,
          label: user.display_name || user.username,
          user,
        });
      });

    return result;
  }, [candidateUsers, isAdmin, query, blockedUserIds, roles]);

  // Keep selected option visible while navigating with keyboard.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const selectedEl = container.querySelector(`[data-mention-index="${selectedIndex}"]`) as HTMLElement | null;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex, options.length]);

  // Reset selection when options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex >= options.length && options.length > 0) {
      setSelectedIndex(options.length - 1);
    } else if (options.length === 0 && selectedIndex !== 0) {
      setSelectedIndex(0);
    }
  }, [options.length, selectedIndex]);

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
      className="absolute z-50 w-72 bg-card border border-border/50 rounded-xl shadow-xl overflow-hidden"
      style={{
        bottom: position.top,
        left: position.left,
      }}
    >
      <div className="px-3 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50">
        Mention
      </div>
      <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
        {options.map((option, index) => (
          <div
            key={`${option.type}:${option.id || option.label}`}
            data-mention-index={index}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-2 cursor-pointer rounded-lg transition-colors duration-150",
              index === selectedIndex
                ? "bg-primary/10 text-foreground"
                : "text-foreground/80 hover:bg-muted/50 hover:text-foreground",
            )}
            onClick={() => onSelect(option)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            {option.type === "user" && option.user ? (
              <>
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarImage src={option.user.avatar_url || undefined} />
                  <AvatarFallback
                    className="text-xs font-medium"
                    style={{ backgroundColor: option.user.banner_color || "hsl(var(--muted))" }}
                  >
                    {option.user.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="font-medium text-[13px] leading-tight truncate">{option.label}</span>
                  {option.user.username !== option.label && (
                    <span className="text-[11px] text-muted-foreground truncate">@{option.user.username}</span>
                  )}
                </div>
              </>
            ) : option.type === "role" && option.role ? (
              <>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-white"
                  style={option.role.color.startsWith("linear-gradient") ? { background: option.role.color } : { backgroundColor: option.role.color }}
                >
                  @
                </div>
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="font-medium text-[13px] truncate">@{option.label}</span>
                  <span className="text-[11px] text-muted-foreground ml-2">
                    {option.role.is_self_assignable ? "Self-assignable" : "Role"}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">@</span>
                </div>
                <div className="flex items-center justify-between flex-1 min-w-0">
                  <span className="font-medium text-[13px]">@{option.label}</span>
                  <span className="text-[11px] text-muted-foreground ml-2">
                    {option.type === "everyone" ? "Notify all" : "Notify online"}
                  </span>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
