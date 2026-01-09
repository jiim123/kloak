import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Smile, Reply, Pencil, Trash2, Pin, MoreHorizontal, CornerUpLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { MessageContent } from "./MessageContent";
import { OptimisticMessageIndicator } from "./OptimisticMessageIndicator";
import { getMessagePreview } from "@/lib/message";
import { formatMessageTimestamp } from "@/lib/format";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import type { Message, ServerRole } from "@/types";
import { format } from "date-fns";

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
  const compactMode = useUIStore((state) => state.compactMode);
  const showTimestamps = useUIStore((state) => state.showTimestamps);
  const { getOptimisticStatus, removeOptimisticItem } = useSyncStore();

  // State
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [dropdownState, setDropdownState] = useState({ emoji: false, more: false });

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

  // Optimistic status
  const optimisticStatus = useMemo(() => {
    return message.id.startsWith("temp-") ? getOptimisticStatus(message.id) || "pending" : null;
  }, [message.id, getOptimisticStatus]);

  const isFailed = optimisticStatus === "failed";

  const isOwnMessage = useMemo(() => user?.id === message.user_id, [user?.id, message.user_id]);
  const messageUser = message.user;

  // Memoize member lookups
  const { currentMember, messageMember } = useMemo(() => {
    return {
      currentMember: members.find((m) => m.user_id === user?.id),
      messageMember: members.find((m) => m.user_id === message.user_id),
    };
  }, [members, user?.id, message.user_id]);

  const isAdmin = useMemo(() => {
    const role = currentMember?.role;
    return role === "owner" || role === "admin" || role === "moderator";
  }, [currentMember?.role]);

  const isMentioned = useMemo(() => {
    if (!user?.id) return false;
    const content = message.content;
    return content.includes(`<@${user.id}>`) || content.includes("@everyone") || content.includes("@here");
  }, [user?.id, message.content]);

  // Memoize formatted timestamps
  const formattedTime = useMemo(() => format(new Date(message.created_at), "h:mm a"), [message.created_at]);

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
    if (isFailed) classes.push("bg-destructive/5 border border-destructive/20");
    if (isMentioned) classes.push("bg-primary/10 border-l-2 border-l-primary");
    if (isHighlighted) classes.push("animate-highlight-message bg-primary/20 ring-2 ring-primary/50");
    return classes.join(" ");
  }, [compactMode, isFailed, isMentioned, isHighlighted]);

  const roleColor = useMemo(() => getRoleColor(messageMember?.role), [messageMember?.role]);
  const displayName = messageMember?.nickname || messageUser?.display_name || messageUser?.username;

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
          onTouchStart={handleTouchStart}
          onTouchEnd={clearLongPress}
          onTouchMove={clearLongPress}
        >
          {/* Avatar / Timestamp column */}
          {compactMode ? (
            <div className="w-12 flex-shrink-0 flex items-start pt-0.5">
              <span
                className={`text-[10px] text-muted-foreground transition-opacity duration-150 ${
                  showTimestamps || !isGrouped ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                }`}
              >
                {formattedTime}
              </span>
            </div>
          ) : (
            <div className="w-10 flex-shrink-0">
              {!isGrouped && messageUser ? (
                <Avatar className="w-10 h-10 cursor-pointer">
                  <AvatarImage src={messageUser.avatar_url || undefined} />
                  <AvatarFallback style={{ backgroundColor: messageUser.banner_color || "#5865F2" }}>
                    {messageUser.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
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
                  className={`text-sm font-semibold tracking-tight hover:underline cursor-pointer mr-1.5 ${roleColor}`}
                >
                  {displayName}
                </span>
                {message.is_pinned && <Pin className="w-3 h-3 text-muted-foreground inline mr-1" />}
              </span>
            ) : (
              !isGrouped &&
              messageUser && (
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-sm font-semibold tracking-tight hover:underline cursor-pointer ${roleColor}`}>
                    {displayName}
                  </span>
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
                <span className="truncate max-w-[200px]">{getMessagePreview(message.reply_to.content, 50)}</span>
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

            {/* Failed message indicator */}
            {isFailed && (
              <OptimisticMessageIndicator
                status="failed"
                onRetry={() => removeOptimisticItem(message.id)}
                onCancel={() => {
                  removeMessage(message.id);
                  removeOptimisticItem(message.id);
                }}
                className="ml-2 inline-flex"
              />
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
                    onClick={() => handleReactionClick(reaction.emoji, reaction.hasReacted)}
                    className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border transition-colors duration-200 ${
                      reaction.hasReacted
                        ? "bg-primary/20 border-primary text-primary"
                        : "bg-secondary border-transparent hover:border-border"
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    <span className="text-[11px]">{reaction.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Hover actions - Desktop (CSS-driven visibility) */}
          {!isEditing && (
            <div className="absolute right-2 -top-3 hidden md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:flex items-center gap-0.5 bg-background border border-border rounded-lg shadow-lg p-0.5 transition-opacity duration-150">
              <DropdownMenu
                open={dropdownState.emoji}
                onOpenChange={(open) => setDropdownState((s) => ({ ...s, emoji: open }))}
              >
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-7 h-7 hover:bg-muted">
                    <Smile className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <div className="flex gap-1 p-1">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleAddReaction(emoji)}
                        className="text-xl hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

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

              {isAdmin && (
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

              {isAdmin && (
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
