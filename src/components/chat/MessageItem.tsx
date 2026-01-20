import { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef } from "react";
import { Smile, Reply, Pencil, Trash2, Pin, MoreHorizontal, CornerUpLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { MessageContent } from "./MessageContent";
import { getMessagePreview } from "@/lib/message";
import { formatMessageTimestamp } from "@/lib/format";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import type { CustomServerRole, Message, ServerRole } from "@/types";
import { format } from "date-fns";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { cn } from "@/lib/utils";

// Static data moved outside component
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"] as const;

const ROLE_COLORS: Record<string, string> = {
  owner: "text-yellow-400",
  admin: "text-red-400",
  moderator: "text-blue-400",
};

const getRoleColor = (role?: ServerRole): string => {
  return role ? ROLE_COLORS[role] || "text-foreground" : "text-foreground";
};

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  showNewDivider?: boolean;
  isHighlighted?: boolean;
  onStartEdit?: () => void;
}

// Track animations by a STABLE key that survives optimistic→real message replacement
// Using: timestamp (rounded to second) + user_id + first 50 chars of content
const animatedMessages = new Set<string>();

const getStableAnimationKey = (message: Message): string => {
  // Round timestamp to nearest second to handle minor discrepancies
  const timestamp = Math.floor(new Date(message.created_at).getTime() / 1000);
  const contentPrefix = message.content.substring(0, 50);
  return `${timestamp}-${message.user_id}-${contentPrefix}`;
};

export const MessageItem = memo(function MessageItem({
  message,
  isGrouped,
  showNewDivider,
  isHighlighted,
  onStartEdit,
}: MessageItemProps) {
  // Selectors
  const user = useAuthStore((state) => state.user);
  const { setReplyingTo, editMessage, pinMessage, addReaction, removeReaction, removeMessage } = useMessageStore();
  const members = useServerStore((state) => state.members);
  const roles = useServerStore((state) => state.roles);
  const currentServer = useServerStore((state) => state.currentServer);
  const compactMode = useUIStore((state) => state.compactMode);
  const showTimestamps = useUIStore((state) => state.showTimestamps);
  const { openModal } = useUIStore();
  const { getOptimisticStatus } = useSyncStore();

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [dropdownState, setDropdownState] = useState({ emoji: false, more: false });
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [hoveredRoleIcon, setHoveredRoleIcon] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable animation key that persists across temp→real ID change
  const animationKey = useMemo(
    () => getStableAnimationKey(message),
    [message.created_at, message.user_id, message.content],
  );

  // Check animation status ONCE on mount using stable key
  const shouldAnimate = useMemo(() => {
    if (animatedMessages.has(animationKey)) {
      return false;
    }
    animatedMessages.add(animationKey);
    // Cleanup old entries periodically
    if (animatedMessages.size > 500) {
      const entries = Array.from(animatedMessages);
      entries.slice(0, 250).forEach((key) => animatedMessages.delete(key));
    }
    return true;
  }, [animationKey]);

  // Check if this is a pending optimistic message (for styling)
  const isPending = useMemo(() => {
    return message.id.startsWith("temp-") || getOptimisticStatus(message.id) === "pending";
  }, [message.id, getOptimisticStatus]);

  const isOwnMessage = useMemo(() => user?.id === message.user_id, [user?.id, message.user_id]);
  const messageUser = message.user;

  // Memoize member lookups
  const { currentMember, messageMember, usersMap } = useMemo(() => {
    const map = new Map<string, { username: string; display_name?: string | null; nickname?: string | null }>();
    members.forEach((m) => {
      if (m.user) {
        map.set(m.user_id, {
          username: m.user.username,
          display_name: m.user.display_name,
          nickname: m.nickname,
        });
      }
    });
    return {
      currentMember: members.find((m) => m.user_id === user?.id),
      messageMember: members.find((m) => m.user_id === message.user_id),
      usersMap: map,
    };
  }, [members, user?.id, message.user_id]);

  // Load server emoji map for :name: rendering (server context only)
  useEffect(() => {
    const serverId = currentServer?.id;
    if (!serverId) {
      setCustomEmojiMap(new Map());
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const load = async (attempt: number) => {
      try {
        const emojis = await fetchServerEmojis(serverId, { force: attempt > 0 });
        if (cancelled) return;
        const map = new Map<string, string>();
        emojis.forEach((e) => map.set(e.name, e.url));
        setCustomEmojiMap(map);
      } catch (e) {
        console.error("Failed to load server emojis for role icon rendering:", e);
        if (cancelled) return;
        setCustomEmojiMap(new Map());

        if (attempt < 3) {
          const backoffMs = 750 * Math.pow(2, attempt);
          retryTimer = setTimeout(() => load(attempt + 1), backoffMs);
        }
      }
    };

    load(0);

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [currentServer?.id]);

  const priorityRoleWithIcon = useMemo<Pick<CustomServerRole, "name" | "icon"> | null>(() => {
    const memberRoles = messageMember?.roles ?? [];
    if (memberRoles.length === 0) return null;

    // Prefer full roles from store (has created_at + icon) over member payload (often lacks created_at)
    const resolved: CustomServerRole[] = memberRoles
      .map((mr) => (roles.find((r) => r.id === mr.id) ?? mr) as CustomServerRole)
      .filter(Boolean);

    // Priority: higher in the roles list (lower position) wins
    let best: CustomServerRole | null = null;
    for (const r of resolved) {
      if (!r?.icon) continue;
      if (!best) {
        best = r;
        continue;
      }
      const aPos = typeof r.position === "number" ? r.position : Number.POSITIVE_INFINITY;
      const bPos = typeof best.position === "number" ? best.position : Number.POSITIVE_INFINITY;
      if (aPos !== bPos) {
        if (aPos < bPos) best = r;
        continue;
      }
      // Stable tie-breaker
      const aCreated = r.created_at ? Date.parse(r.created_at) : Number.POSITIVE_INFINITY;
      const bCreated = best.created_at ? Date.parse(best.created_at) : Number.POSITIVE_INFINITY;
      if (aCreated < bCreated) best = r;
    }

    if (!best?.icon) return null;
    return { name: best.name, icon: best.icon };
  }, [messageMember?.roles, roles]);

  const roleIconNode = useMemo(() => {
    if (!priorityRoleWithIcon?.icon) return null;
    const icon = priorityRoleWithIcon.icon;
    const match = icon.match(/^:([a-z0-9_]{2,32}):$/);
    if (match) {
      const url = customEmojiMap.get(match[1]);
      if (!url) return null;
      return (
        <img
          src={url}
          alt={icon}
          className="inline-block w-4 h-4 align-text-bottom object-contain"
          loading="lazy"
        />
      );
    }
    return (
      <span className="text-sm leading-none font-emoji">
        {icon}
      </span>
    );
  }, [priorityRoleWithIcon?.icon, customEmojiMap]);

  const reactionEmojiNode = useCallback(
    (emoji: string) => {
      const match = emoji.match(/^:([a-z0-9_]{2,32}):$/i);
      if (match) {
        const url = customEmojiMap.get(match[1]);
        if (url) {
          return <img src={url} alt={emoji} className="w-5 h-5 object-contain" loading="lazy" />;
        }
      }
      return <span className="text-base leading-none font-emoji">{emoji}</span>;
    },
    [customEmojiMap],
  );

  const RoleIconWrapper = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement> & { children: React.ReactNode }>(
    ({ children, className, onMouseEnter, onMouseLeave, ...props }, ref) => (
      <span
        ref={ref}
        className={cn("inline-flex items-center", hoveredRoleIcon && "animate-pulse", className)}
        onMouseEnter={(e) => {
          onMouseEnter?.(e);
          setHoveredRoleIcon(true);
        }}
        onMouseLeave={(e) => {
          onMouseLeave?.(e);
          setHoveredRoleIcon(false);
        }}
        {...props}
      >
        {children}
      </span>
    ),
  );
  RoleIconWrapper.displayName = "RoleIconWrapper";

  // Check permissions using database-backed permission system
  const { hasPermission } = useMemberPermissions(message.channel_id);
  const canPinMessages = hasPermission('pin_messages');
  const canManageMessages = hasPermission('manage_messages');
  const canAddReactions = hasPermission('add_reactions');
  
  // For backward compatibility, keep isAdmin for delete permission checks
  // Users can delete their own messages OR if they have manage_messages permission
  const isAdmin = canManageMessages;

  const isMentioned = useMemo(() => {
    if (!user?.id) return false;
    const content = message.content;
    return content.includes(`<@${user.id}>`) || content.includes("@everyone") || content.includes("@here");
  }, [user?.id, message.content]);

  // Memoize formatted timestamps
  // Use shorter format for compact mode to prevent wrapping
  const formattedTime = useMemo(() => {
    const timeStr = format(new Date(message.created_at), "h:mm a");
    // Replace space between time and AM/PM to prevent wrapping
    return timeStr.replace(/\s+/, '\u00A0'); // Non-breaking space
  }, [message.created_at]);

  const formattedTimestamp = useMemo(() => formatMessageTimestamp(message.created_at), [message.created_at]);

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editContent.length, editContent.length);
    }
  }, [isEditing, editContent.length]);

  // Custom event handler for external edit trigger
  useEffect(() => {
    const handler = (e: CustomEvent<{ messageId: string }>) => {
      if (e.detail.messageId === message.id && isOwnMessage) {
        setEditContent(message.content);
        setIsEditing(true);
        onStartEdit?.();
      }
    };
    window.addEventListener("startEditMessage" as keyof WindowEventMap, handler as EventListener);
    return () => window.removeEventListener("startEditMessage" as keyof WindowEventMap, handler as EventListener);
  }, [message.id, message.content, isOwnMessage, onStartEdit]);

  // Callbacks
  const handleEdit = useCallback(async () => {
    const trimmed = editContent.trim();
    if (trimmed && trimmed !== message.content && user) {
      await editMessage(message.id, trimmed, user.id);
    }
    setIsEditing(false);
  }, [editContent, message.content, message.id, user, editMessage]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditContent(message.content);
  }, [message.content]);

  const handlePin = useCallback(async () => {
    if (!user) return;
    await pinMessage(message.id, !message.is_pinned, user.id);
  }, [user, message.id, message.is_pinned, pinMessage]);

  const handleReactionClick = useCallback(
    async (emoji: string, hasReacted: boolean) => {
      if (!user) return;
      if (hasReacted) {
        await removeReaction(message.id, user.id, emoji);
      } else {
        await addReaction(message.id, user.id, emoji);
      }
    },
    [user, message.id, addReaction, removeReaction],
  );

  const handleAddReaction = useCallback(
    (emoji: string) => {
      if (user) {
        addReaction(message.id, user.id, emoji);
      }
      setDropdownState((prev) => ({ ...prev, emoji: false }));
    },
    [user, message.id, addReaction],
  );

  const handleCopyText = useCallback(() => {
    navigator.clipboard.writeText(message.content);
  }, [message.content]);

  const handleCopyMessageId = useCallback(() => {
    navigator.clipboard.writeText(message.id);
  }, [message.id]);

  const handleTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setShowMobileActions(true);
    }, 500);
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleStartEditing = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
  }, [message.content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleEdit();
      }
      if (e.key === "Escape") {
        handleCancelEdit();
      }
    },
    [handleEdit, handleCancelEdit],
  );

  // Computed class names
  const outerClassName = useMemo(() => {
    const base = "px-2";
    const padding = compactMode ? "py-0" : isGrouped ? "py-0.5" : "py-1";
    const animation = shouldAnimate ? "animate-message-slide-in" : "";
    return `${base} ${padding} ${animation}`.trim();
  }, [compactMode, isGrouped, shouldAnimate]);

  const innerClassName = useMemo(() => {
    const classes = [
      "group relative flex px-3 rounded-lg transition-colors duration-200 hover:bg-muted/40",
      compactMode ? "gap-2 py-0.5" : "gap-3 py-1.5",
    ];
    if (isMentioned) classes.push("bg-primary/10 border-l-2 border-l-primary");
    if (isHighlighted) classes.push("animate-highlight-message bg-primary/20 ring-2 ring-primary/50");
    if (isPending) classes.push("opacity-70");
    return classes.join(" ");
  }, [compactMode, isMentioned, isHighlighted, isPending]);

  const topCustomRoleColor = useMemo(() => {
    const memberRoles = messageMember?.roles ?? [];
    if (memberRoles.length === 0) return null;

    // Resolve against roles store (has latest color/position)
    const resolved = memberRoles
      .map((mr) => roles.find((r) => r.id === mr.id) ?? mr)
      .filter(Boolean);

    // Highest priority role = lowest position (top of roles list)
    let best: CustomServerRole | null = null;
    for (const r of resolved as CustomServerRole[]) {
      if (!best) {
        best = r;
        continue;
      }
      const aPos = typeof r.position === "number" ? r.position : Number.POSITIVE_INFINITY;
      const bPos = typeof best.position === "number" ? best.position : Number.POSITIVE_INFINITY;
      if (aPos < bPos) best = r;
    }

    return best?.color ?? null;
  }, [messageMember?.roles, roles]);

  const usernameColorClass = useMemo(
    () => (topCustomRoleColor ? "text-foreground" : getRoleColor(messageMember?.role)),
    [topCustomRoleColor, messageMember?.role],
  );

  const usernameColorStyle = useMemo(
    () => (topCustomRoleColor ? ({ color: topCustomRoleColor } as React.CSSProperties) : undefined),
    [topCustomRoleColor],
  );
  const displayName = messageMember?.nickname || messageUser?.display_name || messageUser?.username;

  const handleUsernameClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (message.user_id) {
      openModal('userProfile', { userId: message.user_id });
    }
  }, [message.user_id, openModal]);

  return (
    <>
      {showNewDivider && (
        <div className="flex items-center gap-2 my-3 px-4">
          <div className="flex-1 h-px bg-destructive/50" />
          <span className="text-[10px] text-destructive font-bold uppercase tracking-wider">NEW</span>
          <div className="flex-1 h-px bg-destructive/50" />
        </div>
      )}

      <div
        id={`message-${message.id}`}
        className={outerClassName}
        style={shouldAnimate ? { animationFillMode: "both" } : undefined}
      >
        <div
          className={innerClassName}
          onMouseEnter={() => setIsRowHovered(true)}
          onMouseLeave={() => setIsRowHovered(false)}
          onTouchStart={handleTouchStart}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
        >
          {/* Avatar / Timestamp column */}
          {compactMode ? (
            <div className="w-16 flex-shrink-0 pt-0.5">
              <span
                className={`text-[10px] text-muted-foreground transition-opacity duration-150 whitespace-nowrap block ${
                  showTimestamps || !isGrouped ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {formattedTime}
              </span>
            </div>
          ) : (
            <div className="w-10 flex-shrink-0">
              {!isGrouped && messageUser ? (
                <AvatarWithDecoration 
                  user={messageUser} 
                  className="w-10 h-10 cursor-pointer"
                  active={isRowHovered}
                />
              ) : (
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  {formattedTime}
                </span>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            {compactMode ? (
              <span className="inline">
                <span
                  onClick={handleUsernameClick}
                  className={`text-sm font-semibold tracking-tight hover:underline cursor-pointer mr-1.5 ${usernameColorClass}`}
                  style={usernameColorStyle}
                >
                  {displayName}
                </span>
                {roleIconNode && priorityRoleWithIcon && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <RoleIconWrapper>
                        <span className="inline-flex items-center mr-1.5 cursor-help">
                          {roleIconNode}
                        </span>
                      </RoleIconWrapper>
                    </TooltipTrigger>
                    <TooltipContent>{priorityRoleWithIcon.name}</TooltipContent>
                  </Tooltip>
                )}
                {message.is_pinned && <Pin className="w-3 h-3 text-muted-foreground inline mr-1" />}
              </span>
            ) : (
              !isGrouped &&
              messageUser && (
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span 
                    onClick={handleUsernameClick}
                    className={`text-sm font-semibold tracking-tight hover:underline cursor-pointer ${usernameColorClass}`}
                    style={usernameColorStyle}
                  >
                    {displayName}
                  </span>
                  {roleIconNode && priorityRoleWithIcon && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <RoleIconWrapper>
                          <span className="inline-flex items-center cursor-help">
                            {roleIconNode}
                          </span>
                        </RoleIconWrapper>
                      </TooltipTrigger>
                      <TooltipContent>{priorityRoleWithIcon.name}</TooltipContent>
                    </Tooltip>
                  )}
                  {showTimestamps && <span className="text-[11px] text-muted-foreground">{formattedTimestamp}</span>}
                  {message.is_pinned && <Pin className="w-3 h-3 text-muted-foreground" />}
                </div>
              )
            )}

            {/* Reply reference */}
            {message.reply_to && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground">
                <CornerUpLeft className="w-3 h-3" />
                <span>Replying to</span>
                <span className="font-medium text-primary">@{message.reply_to.user?.username || "unknown"}</span>
                <span className="truncate max-w-[200px]">{getMessagePreview(message.reply_to.content, 50, usersMap)}</span>
              </div>
            )}

            {/* Message content */}
            {isEditing ? (
              <div className="flex flex-col gap-2">
                <Textarea
                  ref={textareaRef}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px] resize-none text-sm"
                  onKeyDown={handleKeyDown}
                />
                <div className="flex gap-2 text-[11px]">
                  <span className="text-muted-foreground">
                    escape to{" "}
                    <button className="text-primary hover:underline" onClick={handleCancelEdit}>
                      cancel
                    </button>
                    {" • "}enter to{" "}
                    <button className="text-primary hover:underline" onClick={handleEdit}>
                      save
                    </button>
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-sm leading-relaxed">
                <MessageContent content={message.content} currentUserId={user?.id} messageId={message.id} />
              </div>
            )}

            {/* Edited indicator */}
            {message.edited_at && !isEditing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[10px] text-muted-foreground cursor-help ml-1">(edited)</span>
                </TooltipTrigger>
                <TooltipContent>{new Date(message.edited_at).toLocaleString()}</TooltipContent>
              </Tooltip>
            )}


            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {message.attachments.map((attachment) => (
                  <div key={attachment.id} className="relative">
                    {attachment.file_type?.startsWith("image/") ? (
                      <img
                        src={attachment.file_url}
                        alt={attachment.file_name}
                        className="max-w-[400px] max-h-[300px] rounded-lg cursor-pointer hover:opacity-90"
                        loading="lazy"
                      />
                    ) : (
                      <a
                        href={attachment.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-3 bg-secondary rounded-lg hover:bg-secondary/80"
                      >
                        <span className="text-sm font-medium">{attachment.file_name}</span>
                        {attachment.file_size && (
                          <span className="text-xs text-muted-foreground">
                            ({Math.round(attachment.file_size / 1024)} KB)
                          </span>
                        )}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Reactions */}
            {message.reactions && message.reactions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {message.reactions.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    onClick={() => canAddReactions && handleReactionClick(reaction.emoji, reaction.hasReacted)}
                    disabled={!canAddReactions}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md border transition-colors duration-200 ${
                      reaction.hasReacted
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-secondary border-transparent hover:border-border"
                    } ${!canAddReactions ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {reactionEmojiNode(reaction.emoji)}
                    <span className="text-xs">{reaction.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hover actions - Desktop (CSS-driven visibility) */}
          {!isEditing && (
            <div className="absolute right-2 -top-3 hidden md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:flex items-center gap-0.5 bg-background border border-border rounded-lg shadow-lg p-0.5 transition-opacity duration-150">
              {canAddReactions && (
                <EmojiGifPicker
                  open={dropdownState.emoji}
                  onOpenChange={(open) => setDropdownState((s) => ({ ...s, emoji: open }))}
                  onEmojiSelect={handleAddReaction}
                  disableGif
                  serverId={currentServer?.id}
                  serverName={currentServer?.name}
                >
                  <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-muted">
                    <Smile className="w-4 h-4" />
                  </Button>
                </EmojiGifPicker>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-7 h-7 hover:bg-muted"
                    onClick={() => setReplyingTo(message)}
                  >
                    <Reply className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reply</TooltipContent>
              </Tooltip>

              {isOwnMessage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-muted" onClick={handleStartEditing}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Edit</TooltipContent>
                </Tooltip>
              )}

              {(isOwnMessage || isAdmin) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-7 h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Delete</TooltipContent>
                </Tooltip>
              )}

              {canPinMessages && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-muted" onClick={handlePin}>
                      <Pin className={`w-4 h-4 ${message.is_pinned ? "text-primary" : ""}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{message.is_pinned ? "Unpin" : "Pin"}</TooltipContent>
                </Tooltip>
              )}

              <DropdownMenu
                open={dropdownState.more}
                onOpenChange={(open) => setDropdownState((s) => ({ ...s, more: open }))}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-muted">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleCopyText}>Copy Text</DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyMessageId}>Copy Message ID</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Mobile action drawer */}
      <Drawer open={showMobileActions} onOpenChange={setShowMobileActions}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-sm font-medium text-muted-foreground">Message Actions</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-8">
            {canAddReactions && (
              <div className="flex justify-center gap-3 mb-4 pb-4 border-b border-border">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      handleAddReaction(emoji);
                      setShowMobileActions(false);
                    }}
                    className="text-2xl p-2 hover:bg-accent rounded-full active:scale-90 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-1">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent active:bg-accent text-left"
                onClick={() => {
                  setReplyingTo(message);
                  setShowMobileActions(false);
                }}
              >
                <Reply className="w-5 h-5 text-muted-foreground" />
                <span>Reply</span>
              </button>

              {isOwnMessage && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent active:bg-accent text-left"
                  onClick={() => {
                    handleStartEditing();
                    setShowMobileActions(false);
                  }}
                >
                  <Pencil className="w-5 h-5 text-muted-foreground" />
                  <span>Edit</span>
                </button>
              )}

              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent active:bg-accent text-left"
                onClick={() => {
                  handleCopyText();
                  setShowMobileActions(false);
                }}
              >
                <Copy className="w-5 h-5 text-muted-foreground" />
                <span>Copy Text</span>
              </button>

              {canPinMessages && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent active:bg-accent text-left"
                  onClick={() => {
                    handlePin();
                    setShowMobileActions(false);
                  }}
                >
                  <Pin className={`w-5 h-5 ${message.is_pinned ? "text-primary" : "text-muted-foreground"}`} />
                  <span>{message.is_pinned ? "Unpin" : "Pin"}</span>
                </button>
              )}

              {(isOwnMessage || isAdmin) && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 active:bg-destructive/10 text-left text-destructive"
                  onClick={() => {
                    setShowDeleteModal(true);
                    setShowMobileActions(false);
                  }}
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation modal */}
      <DeleteMessageModal message={showDeleteModal ? message : null} onClose={() => setShowDeleteModal(false)} />
    </>
  );
});
