import { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Smile, Reply, Pencil, Trash2, Pin, MoreHorizontal, CornerUpLeft, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { useSyncStore } from "@/stores/syncStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageContent } from "./MessageContent";
import { PollMessage } from "./PollMessage";
import { isImageOnlyMessage, convertMentionsToReadable, convertMentionsToRaw } from "@/lib/message";
import { ReplyPreview } from "./MessageContent";
import { formatMessageTimestamp } from "@/lib/format";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import type { CustomServerRole, Message, ServerRole } from "@/types";
import { format } from "date-fns";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { cn } from "@/lib/utils";
import { getPollIdFromContent, isPollMessageContent } from "@/lib/poll";

// Static data moved outside component
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👋", "🔥", "👀", "💯", "🙌", "😍", "🤔"] as const;

const MIN_EDIT_TEXTAREA_HEIGHT = 60;
const MAX_EDIT_TEXTAREA_HEIGHT = 300;

const ROLE_COLORS: Record<string, string> = {
  owner: "text-yellow-400",
  admin: "text-red-400",
  moderator: "text-blue-400",
};

const getRoleColor = (role?: ServerRole): string => {
  return role ? ROLE_COLORS[role] || "text-foreground" : "text-foreground";
};

const isGradientColor = (value?: string | null) => !!value && value.startsWith("linear-gradient");

const getGradientTextStyle = (gradient: string): React.CSSProperties =>
  ({
    background: gradient,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  }) as React.CSSProperties;

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  showNewDivider?: boolean;
  isHighlighted?: boolean;
  onStartEdit?: () => void;
}

// Track animations by a STABLE key that survives optimistic→real message replacement
const animatedMessages = new Set<string>();

const getStableAnimationKey = (message: Message): string => {
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
  const { setReplyingTo, editMessage, pinMessage, addReaction, removeReaction } = useMessageStore();
  const members = useServerStore((state) => state.members);
  const roles = useServerStore((state) => state.roles);
  const currentServer = useServerStore((state) => state.currentServer);
  const currentChannel = useServerStore((state) => state.currentChannel);
  const compactMode = useUIStore((state) => state.compactMode);
  const showTimestamps = useUIStore((state) => state.showTimestamps);
  const { openModal } = useUIStore();
  const { getOptimisticStatus } = useSyncStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();

  // State - SEPARATE states for desktop and mobile emoji pickers
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showDesktopEmojiPicker, setShowDesktopEmojiPicker] = useState(false);
  const [showMobileEmojiPicker, setShowMobileEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [hoveredRoleIcon, setHoveredRoleIcon] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);
  const [reactionDetailsEmoji, setReactionDetailsEmoji] = useState<string | null>(null);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable animation key
  const animationKey = useMemo(
    () => getStableAnimationKey(message),
    [message.created_at, message.user_id, message.content],
  );

  // Check animation status ONCE on mount
  const shouldAnimate = useMemo(() => {
    if (animatedMessages.has(animationKey)) return false;
    animatedMessages.add(animationKey);
    if (animatedMessages.size > 500) {
      const entries = Array.from(animatedMessages);
      entries.slice(0, 250).forEach((key) => animatedMessages.delete(key));
    }
    return true;
  }, [animationKey]);

  // Check if pending optimistic message
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

  // Load server emoji map
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
        console.error("Failed to load server emojis:", e);
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

    const resolved: CustomServerRole[] = memberRoles
      .map((mr) => (roles.find((r) => r.id === mr.id) ?? mr) as CustomServerRole)
      .filter(Boolean);

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
        <img src={url} alt={icon} className="inline-block w-4 h-4 align-text-bottom object-contain" loading="lazy" />
      );
    }
    return <span className="text-sm leading-none font-emoji">{icon}</span>;
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

  const reactionEmojiNodeLarge = useCallback(
    (emoji: string) => {
      const match = emoji.match(/^:([a-z0-9_]{2,32}):$/i);
      if (match) {
        const url = customEmojiMap.get(match[1]);
        if (url) {
          return <img src={url} alt={emoji} className="w-8 h-8 object-contain" loading="lazy" />;
        }
      }
      return <span className="text-2xl leading-none font-emoji">{emoji}</span>;
    },
    [customEmojiMap],
  );

  const memberNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members) {
      const name = m.nickname ?? m.user?.display_name ?? m.user?.username ?? m.user_id;
      map.set(m.user_id, name);
    }
    if (user?.id) {
      map.set(user.id, "You");
    }
    return map;
  }, [members, user?.id]);

  const getReactionUserNames = useCallback(
    (userIds: string[]) => {
      const unique = Array.from(new Set(userIds));
      return unique.map((id) => memberNameById.get(id) ?? (id === user?.id ? "You" : id));
    },
    [memberNameById, user?.id],
  );

  const selectedReaction = useMemo(() => {
    if (!reactionDetailsEmoji) return null;
    return message.reactions?.find((r) => r.emoji === reactionDetailsEmoji) ?? null;
  }, [message.reactions, reactionDetailsEmoji]);

  const selectedReactionNames = useMemo(() => {
    if (!selectedReaction) return [];
    return getReactionUserNames(selectedReaction.users);
  }, [selectedReaction, getReactionUserNames]);

  const RoleIconWrapper = forwardRef<
    HTMLSpanElement,
    React.HTMLAttributes<HTMLSpanElement> & { children: React.ReactNode }
  >(({ children, className, onMouseEnter, onMouseLeave, ...props }, ref) => (
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
  ));
  RoleIconWrapper.displayName = "RoleIconWrapper";

  // Permissions
  const { hasPermission } = useMemberPermissions(message.channel_id);
  const canPinMessages = hasPermission("pin_messages");
  const canManageMessages = hasPermission("manage_messages");
  const canAddReactions = hasPermission("add_reactions");
  const isAdmin = canManageMessages;

  const isMentioned = useMemo(() => {
    if (!user?.id) return false;
    const content = message.content;
    return content.includes(`<@${user.id}>`) || content.includes("@everyone") || content.includes("@here");
  }, [user?.id, message.content]);

  const pollId = useMemo(() => getPollIdFromContent(message.content), [message.content]);

  // Ghost mode - hide avatar/username for non-admin message authors
  const isGhostMode = currentChannel?.ghost_mode || false;
  const messageAuthorIsAdmin = useMemo(() => {
    if (!messageMember) return false;
    const role = messageMember.role;
    return role === "owner" || role === "admin";
  }, [messageMember]);
  const showGhostIdentity = isGhostMode && !messageAuthorIsAdmin;

  // Check if reply author is admin (for ghost mode)
  const replyAuthorIsAdmin = useMemo(() => {
    if (!message.reply_to?.user?.id || !isGhostMode) return false;
    const replyMember = members.find((m) => m.user_id === message.reply_to?.user?.id);
    if (!replyMember) return false;
    const role = replyMember.role;
    return role === "owner" || role === "admin";
  }, [message.reply_to?.user?.id, members, isGhostMode]);
  const showReplyAuthorIdentity = !isGhostMode || replyAuthorIsAdmin;

  // Memoize formatted timestamps
  const formattedTime = useMemo(() => {
    const timeStr = format(new Date(message.created_at), "h:mm a");
    return timeStr.replace(/\s+/, "\u00A0");
  }, [message.created_at]);

  const formattedTimestamp = useMemo(() => formatMessageTimestamp(message.created_at), [message.created_at]);

  // Auto-resize textarea for edit mode
  const resizeEditTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset to 0 to get accurate scrollHeight measurement
    textarea.style.height = "0px";

    // Calculate new height with min/max constraints
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, MIN_EDIT_TEXTAREA_HEIGHT), MAX_EDIT_TEXTAREA_HEIGHT);

    // Always apply the height
    textarea.style.height = `${newHeight}px`;
  }, []);

  // Focus textarea when editing starts and resize to fit content
  const hasInitializedEdit = useRef(false);
  useEffect(() => {
    if (isEditing && textareaRef.current && !hasInitializedEdit.current) {
      hasInitializedEdit.current = true;

      // Resize first to show full content
      resizeEditTextarea();

      // Then focus and place cursor at end
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
    if (!isEditing) {
      hasInitializedEdit.current = false;
    }
  }, [isEditing, resizeEditTextarea]);

  // Also resize when editContent changes (for initial load)
  useEffect(() => {
    if (isEditing) {
      resizeEditTextarea();
    }
  }, [editContent, isEditing, resizeEditTextarea]);

  // Custom event handler for external edit trigger
  useEffect(() => {
    const handler = (e: CustomEvent<{ messageId: string }>) => {
      if (e.detail.messageId === message.id && isOwnMessage) {
        const readableContent = convertMentionsToReadable(message.content, usersMap);
        setEditContent(readableContent);
        setIsEditing(true);
        onStartEdit?.();
      }
    };
    window.addEventListener("startEditMessage" as keyof WindowEventMap, handler as EventListener);
    return () => window.removeEventListener("startEditMessage" as keyof WindowEventMap, handler as EventListener);
  }, [message.id, message.content, isOwnMessage, onStartEdit, usersMap]);

  // Callbacks
  const handleEdit = useCallback(async () => {
    const trimmed = editContent.trim();
    if (trimmed && user) {
      // Convert readable mentions back to UUID format before saving
      const rawContent = convertMentionsToRaw(trimmed, usersMap);
      if (rawContent !== message.content) {
        await editMessage(message.id, rawContent, user.id);
      }
    }
    setIsEditing(false);
  }, [editContent, message.content, message.id, user, editMessage, usersMap]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    const readableContent = convertMentionsToReadable(message.content, usersMap);
    setEditContent(readableContent);
  }, [message.content, usersMap]);

  const handlePin = useCallback(async () => {
    if (!user) return;
    try {
      await pinMessage(message.id, !message.is_pinned, user.id);
      toast.success(message.is_pinned ? "Message unpinned" : "Message pinned");
    } catch (error) {
      console.error("Failed to pin/unpin message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to pin/unpin message");
    }
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
    },
    [user, message.id, addReaction],
  );

  const handleDesktopAddReaction = useCallback(
    (emoji: string) => {
      handleAddReaction(emoji);
      setShowDesktopEmojiPicker(false);
    },
    [handleAddReaction],
  );

  const handleMobileAddReaction = useCallback(
    (emoji: string) => {
      handleAddReaction(emoji);
      setShowMobileEmojiPicker(false);
      setShowMobileActions(false);
    },
    [handleAddReaction],
  );

  const handleCopyText = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success("Message copied to clipboard");
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Failed to copy message");
    }
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
    // Convert UUID mentions to readable format for editing
    const readableContent = convertMentionsToReadable(message.content, usersMap);
    setEditContent(readableContent);
    setIsEditing(true);
  }, [message.content, usersMap]);

  const handleEditContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setEditContent(e.target.value);
      resizeEditTextarea();
    },
    [resizeEditTextarea],
  );

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
    if (isMentioned) classes.push("bg-amber-950/50 border-l-2 border-l-amber-500");
    if (isHighlighted) classes.push("animate-highlight-message bg-primary/20 ring-2 ring-primary/50");
    if (isPending) classes.push("opacity-70");
    return classes.join(" ");
  }, [compactMode, isMentioned, isHighlighted, isPending]);

  const topCustomRoleColor = useMemo(() => {
    const memberRoles = messageMember?.roles ?? [];
    if (memberRoles.length === 0) return null;

    const resolved = memberRoles.map((mr) => roles.find((r) => r.id === mr.id) ?? mr).filter(Boolean);

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

  const usernameColorClass = useMemo(() => {
    if (!topCustomRoleColor) return getRoleColor(messageMember?.role);
    return isGradientColor(topCustomRoleColor) ? "text-transparent" : "text-foreground";
  }, [topCustomRoleColor, messageMember?.role]);

  const usernameColorStyle = useMemo(() => {
    if (!topCustomRoleColor) return undefined;
    return isGradientColor(topCustomRoleColor)
      ? getGradientTextStyle(topCustomRoleColor)
      : ({ color: topCustomRoleColor } as React.CSSProperties);
  }, [topCustomRoleColor]);

  const displayName = showGhostIdentity
    ? "Anonymous"
    : messageMember?.nickname || messageUser?.display_name || messageUser?.username;

  const handleUsernameClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Don't show profile in ghost mode for non-admins
      if (showGhostIdentity) return;
      if (message.user_id) {
        openModal("userProfile", { userId: message.user_id });
      }
    },
    [message.user_id, openModal, showGhostIdentity],
  );

  const handleReplyClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (message.reply_to?.id) {
        // Set URL param - useScrollToMessage hook will handle scrolling and highlighting
        const newParams = new URLSearchParams(searchParams);
        newParams.set("message", message.reply_to.id);
        setSearchParams(newParams, { replace: true });
      }
    },
    [message.reply_to?.id, searchParams, setSearchParams],
  );

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
        {/* ContextMenu is disabled on mobile (use Drawer instead) */}
        <ContextMenu>
          <ContextMenuTrigger asChild disabled={isMobile}>
            <div
              className={innerClassName}
              onMouseEnter={() => setIsRowHovered(true)}
              onMouseLeave={() => setIsRowHovered(false)}
              onTouchStart={handleTouchStart}
              onTouchEnd={clearLongPress}
              onTouchMove={clearLongPress}
            >
              {/* Avatar / Timestamp column - hidden for system messages */}
              {!message.is_system_message && (
                <>
                  {compactMode ? (
                    <div className="w-16 flex-shrink-0 pt-0.5">
                      <span
                        className={`text-[11px] font-[Inter,system-ui,sans-serif] text-muted-foreground/70 transition-opacity duration-150 whitespace-nowrap block ${
                          showTimestamps || !isGrouped ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {formattedTime}
                      </span>
                    </div>
                  ) : (
                    <div className="w-10 flex-shrink-0">
                      {!isGrouped && messageUser ? (
                        showGhostIdentity ? (
                          // Ghost avatar for anonymous users
                          <div
                            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center cursor-default"
                            title="Anonymous"
                          >
                            <Eye className="w-5 h-5 text-muted-foreground" />
                          </div>
                        ) : (
                          <AvatarWithDecoration
                            user={messageUser}
                            className="w-10 h-10 cursor-pointer"
                            active={isRowHovered}
                            onClick={handleUsernameClick}
                          />
                        )
                      ) : (
                        <span className="text-[11px] font-[Inter,system-ui,sans-serif] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          {formattedTime}
                        </span>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* System Message - Special rendering */}
                {message.is_system_message ? (
                  <div className="flex items-center gap-2 py-1">
                    {messageUser && (
                      <>
                        <AvatarWithDecoration
                          user={messageUser}
                          className="w-5 h-5 cursor-pointer flex-shrink-0"
                          active={isRowHovered}
                          onClick={handleUsernameClick}
                        />
                        <span className="text-sm text-muted-foreground tracking-tight">
                          <MessageContent
                            content={message.content}
                            currentUserId={user?.id}
                            messageId={message.id}
                            messageUser={
                              messageUser
                                ? {
                                    id: messageUser.id,
                                    username: messageUser.username,
                                    display_name: messageUser.display_name,
                                  }
                                : undefined
                            }
                          />
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    {compactMode ? (
                      <span className="inline font-[Inter,system-ui,sans-serif]">
                        <span
                          onClick={handleUsernameClick}
                          className={`text-[14px] sm:text-[15px] font-medium leading-tight hover:underline cursor-pointer mr-1.5 ${usernameColorClass}`}
                          style={usernameColorStyle}
                        >
                          {displayName}
                        </span>
                        {roleIconNode && priorityRoleWithIcon && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <RoleIconWrapper>
                                <span className="inline-flex items-center mr-1.5 cursor-help">{roleIconNode}</span>
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
                        <div className="flex items-baseline gap-2 mb-0.5 font-[Inter,system-ui,sans-serif]">
                          <span
                            onClick={handleUsernameClick}
                            className={`text-[14px] sm:text-[15px] font-medium leading-tight hover:underline cursor-pointer ${usernameColorClass}`}
                            style={usernameColorStyle}
                          >
                            {displayName}
                          </span>
                          {roleIconNode && priorityRoleWithIcon && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <RoleIconWrapper>
                                  <span className="inline-flex items-center cursor-help">{roleIconNode}</span>
                                </RoleIconWrapper>
                              </TooltipTrigger>
                              <TooltipContent>{priorityRoleWithIcon.name}</TooltipContent>
                            </Tooltip>
                          )}
                          {showTimestamps && (
                            <span className="text-[12px] sm:text-[13px] text-muted-foreground leading-none">
                              {formattedTimestamp}
                            </span>
                          )}
                          {message.is_pinned && <Pin className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      )
                    )}

                    {/* Reply reference */}
                    {message.reply_to && (
                      <div
                        className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground"
                        onClick={handleReplyClick}
                      >
                        <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
                        <span>Replying to</span>
                        {showReplyAuthorIdentity ? (
                          <span className="font-medium text-primary">
                            @{message.reply_to.user?.username || "unknown"}
                          </span>
                        ) : (
                          <span className="font-medium text-primary italic">Anonymous</span>
                        )}
                        {isPollMessageContent(message.reply_to.content) ? (
                          <span className="italic">poll</span>
                        ) : isImageOnlyMessage(message.reply_to.content) ? (
                          <img
                            src={message.reply_to.content.trim()}
                            alt="Image"
                            className="w-6 h-6 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <span className="truncate max-w-[200px]">
                            <ReplyPreview content={message.reply_to.content} maxLength={50} />
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message content */}
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          ref={textareaRef}
                          value={editContent}
                          onChange={handleEditContentChange}
                          className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 min-h-[60px] max-h-[300px] overflow-y-auto"
                          onKeyDown={handleKeyDown}
                          style={{
                            lineHeight: "1.5",
                          }}
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
                      <div className="text-[14px] sm:text-[14px] font-normal leading-[1.5] font-[Inter,system-ui,sans-serif]">
                        {pollId ? (
                          <PollMessage pollId={pollId} />
                        ) : currentChannel?.type === "announcement" ? (
                          (() => {
                            // Extract title and content for announcement channels
                            const content = message.content || "";
                            const parts = content.split("\n\n");
                            const title = parts.length > 1 ? parts[0].trim() : content.split("\n")[0].trim() || "";
                            const announcementContent =
                              parts.length > 1
                                ? parts.slice(1).join("\n\n").trim()
                                : content.split("\n").slice(1).join("\n").trim();

                            return (
                              <div className="space-y-2">
                                {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
                                {announcementContent && (
                                  <MessageContent
                                    content={announcementContent}
                                    currentUserId={user?.id}
                                    messageId={message.id}
                                    messageUser={
                                      messageUser
                                        ? {
                                            id: messageUser.id,
                                            username: messageUser.username,
                                            display_name: messageUser.display_name,
                                          }
                                        : undefined
                                    }
                                  />
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <MessageContent
                            content={message.content}
                            currentUserId={user?.id}
                            messageId={message.id}
                            messageUser={
                              messageUser
                                ? {
                                    id: messageUser.id,
                                    username: messageUser.username,
                                    display_name: messageUser.display_name,
                                  }
                                : undefined
                            }
                          />
                        )}
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

                    {/* Attachments - skip for system messages */}
                    {!message.is_system_message && message.attachments && message.attachments.length > 0 && (
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

                    {/* Reactions - skip for system messages */}
                    {!message.is_system_message && message.reactions && message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {message.reactions.map((reaction) => (
                          <HoverCard key={reaction.emoji} openDelay={200}>
                            <HoverCardTrigger asChild>
                              <span className="inline-flex">
                                <button
                                  onClick={() =>
                                    canAddReactions && handleReactionClick(reaction.emoji, reaction.hasReacted)
                                  }
                                  disabled={!canAddReactions}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 text-lg rounded-md border transition-colors duration-200 ${
                                    reaction.hasReacted
                                      ? "bg-primary/20 border-primary text-primary"
                                      : "bg-secondary border-transparent hover:border-border"
                                  } ${!canAddReactions ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                  {reactionEmojiNode(reaction.emoji)}
                                  <span className="text-xs">{reaction.count}</span>
                                </button>
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-auto p-1.5" align="start" side="top">
                              {(() => {
                                const names = getReactionUserNames(reaction.users);
                                const preview = names.slice(0, 4);
                                const remaining = Math.max(0, names.length - preview.length);
                                return (
                                  <div className="flex items-center gap-1">
                                    <div className="shrink-0">{reactionEmojiNodeLarge(reaction.emoji)}</div>
                                    <div className="min-w-0 text-sm leading-tight">
                                      <span className="text-muted-foreground">reacted by</span>{" "}
                                      {preview.map((name, idx) => (
                                        <span key={`${reaction.emoji}-${name}`}>
                                          <span className="truncate">{name}</span>
                                          {idx < preview.length - 1 ? ", " : ""}
                                        </span>
                                      ))}
                                      {remaining > 0 && (
                                        <>
                                          {preview.length > 0 ? ", " : ""}
                                          <button
                                            type="button"
                                            className="text-primary underline hover:no-underline"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setReactionDetailsEmoji(reaction.emoji);
                                            }}
                                          >
                                            {remaining} others
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })()}
                            </HoverCardContent>
                          </HoverCard>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Hover actions - Desktop only - skip for system messages */}
              {!isEditing && !message.is_system_message && (
                <div className="absolute right-2 -top-4 hidden md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200">
                  {/* Reactions - Desktop */}
                  {canAddReactions && (
                    <EmojiPicker
                      open={showDesktopEmojiPicker}
                      onOpenChange={setShowDesktopEmojiPicker}
                      onEmojiSelect={handleDesktopAddReaction}
                      serverId={currentServer?.id}
                    >
                      <button
                        className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="Add reaction"
                        title="Add reaction"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </EmojiPicker>
                  )}

                  {/* Reply - Hide for announcement channels */}
                  {currentChannel?.type !== "announcement" && (
                    <button
                      className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => setReplyingTo(message)}
                      aria-label="Reply"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                  )}

                  {/* Edit (own messages) - For announcements, trigger full edit box */}
                  {isOwnMessage && (
                    <button
                      className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        if (currentChannel?.type === "announcement") {
                          // Trigger edit in AnnouncementChannelArea
                          window.dispatchEvent(new CustomEvent("startEditAnnouncement", { detail: { message } }));
                        } else {
                          handleStartEditing();
                        }
                      }}
                      aria-label="Edit"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Pin - Hide for announcement channels */}
                  {canPinMessages && currentChannel?.type !== "announcement" && (
                    <button
                      className={cn(
                        "p-2 rounded-lg bg-transparent hover:bg-muted transition-colors",
                        message.is_pinned ? "text-primary" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={handlePin}
                      aria-label={message.is_pinned ? "Unpin" : "Pin"}
                      title={message.is_pinned ? "Unpin" : "Pin"}
                    >
                      <Pin className="w-4 h-4" />
                    </button>
                  )}

                  {/* Copy */}
                  <button
                    className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    onClick={handleCopyText}
                    aria-label="Copy text"
                    title="Copy text"
                  >
                    <Copy className="w-4 h-4" />
                  </button>

                  {/* More menu */}
                  <DropdownMenu open={showMoreMenu} onOpenChange={setShowMoreMenu}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        aria-label="More actions"
                        title="More"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                      <DropdownMenuItem onClick={handleCopyMessageId}>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Message ID
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Delete */}
                  {(isOwnMessage || isAdmin) && (
                    <>
                      <div className="w-px h-5 bg-border mx-0.5" />
                      <button
                        className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-destructive"
                        onClick={() => setShowDeleteModal(true)}
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent>
            <ContextMenuItem onClick={() => setReplyingTo(message)}>
              <Reply className="w-4 h-4 mr-2" />
              Reply
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyText}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Text
            </ContextMenuItem>
            {isOwnMessage && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleStartEditing}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Message
                </ContextMenuItem>
              </>
            )}
            {canPinMessages && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handlePin}>
                  <Pin className="w-4 h-4 mr-2" />
                  {message.is_pinned ? "Unpin Message" : "Pin Message"}
                </ContextMenuItem>
              </>
            )}
            {(isOwnMessage || isAdmin) && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => setShowDeleteModal(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Message
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      </div>

      {/* Mobile action drawer */}
      <Drawer open={showMobileActions} onOpenChange={setShowMobileActions}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-sm font-medium text-muted-foreground">Message Actions</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            {/* Quick reactions row - horizontally scrollable */}
            {canAddReactions && (
              <div className="mb-4 rounded-xl bg-muted/50 overflow-hidden">
                <div className="flex items-center gap-1.5 p-2 overflow-x-auto scrollbar-hide">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleMobileAddReaction(emoji)}
                      className="text-2xl p-2.5 hover:bg-accent rounded-xl active:scale-90 transition-all flex-shrink-0"
                    >
                      {emoji}
                    </button>
                  ))}
                  {/* Divider */}
                  <div className="w-px h-8 bg-border/50 mx-1 flex-shrink-0" />
                  {/* Full emoji picker - Mobile (separate state) */}
                  <EmojiPicker
                    open={showMobileEmojiPicker}
                    onOpenChange={setShowMobileEmojiPicker}
                    onEmojiSelect={handleMobileAddReaction}
                    serverId={currentServer?.id}
                  >
                    <button
                      className="p-2.5 rounded-xl bg-secondary/80 hover:bg-accent transition-colors flex-shrink-0"
                      aria-label="More emojis"
                    >
                      <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
                    </button>
                  </EmojiPicker>
                </div>
              </div>
            )}

            {/* Action buttons list */}
            <div className="space-y-1">
              {/* Reply */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-accent active:bg-accent text-left transition-colors"
                onClick={() => {
                  setReplyingTo(message);
                  setShowMobileActions(false);
                }}
              >
                <Reply className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Reply</span>
              </button>

              {/* Edit (own messages) */}
              {isOwnMessage && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-accent active:bg-accent text-left transition-colors"
                  onClick={() => {
                    handleStartEditing();
                    setShowMobileActions(false);
                  }}
                >
                  <Pencil className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Edit</span>
                </button>
              )}

              {/* Pin */}
              {canPinMessages && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-accent active:bg-accent text-left transition-colors"
                  onClick={() => {
                    handlePin();
                    setShowMobileActions(false);
                  }}
                >
                  <Pin className={cn("w-5 h-5", message.is_pinned ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-medium">{message.is_pinned ? "Unpin Message" : "Pin Message"}</span>
                </button>
              )}

              <div className="my-2 h-px bg-border" />

              {/* Copy Text */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-accent active:bg-accent text-left transition-colors"
                onClick={() => {
                  handleCopyText();
                  setShowMobileActions(false);
                }}
              >
                <Copy className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Copy Text</span>
              </button>

              {/* Copy Message ID */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-accent active:bg-accent text-left transition-colors"
                onClick={() => {
                  handleCopyMessageId();
                  setShowMobileActions(false);
                }}
              >
                <Copy className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Copy Message ID</span>
              </button>

              {/* Delete */}
              {(isOwnMessage || isAdmin) && (
                <>
                  <div className="my-2 h-px bg-border" />
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-destructive/10 active:bg-destructive/10 text-left text-destructive transition-colors"
                    onClick={() => {
                      setShowDeleteModal(true);
                      setShowMobileActions(false);
                    }}
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="font-medium">Delete Message</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation modal */}
      <DeleteMessageModal message={showDeleteModal ? message : null} onClose={() => setShowDeleteModal(false)} />

      {/* Reaction details dialog */}
      <Dialog open={!!reactionDetailsEmoji} onOpenChange={(open) => !open && setReactionDetailsEmoji(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="inline-flex">
                {reactionDetailsEmoji ? reactionEmojiNode(reactionDetailsEmoji) : null}
              </span>
              <span>Reactions</span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[320px] overflow-auto space-y-1">
            {selectedReactionNames.length > 0 ? (
              selectedReactionNames.map((name, idx) => (
                <div key={`${reactionDetailsEmoji ?? "reaction"}-${idx}`} className="text-sm">
                  {name}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">No reactions</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});
