import { useState, useRef, useCallback, useEffect, useMemo, memo } from "react";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { Smile, Reply, Pencil, Trash2, Copy, CornerUpLeft, MoreHorizontal, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { useDMStore } from "@/stores/dmStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatMessageTimestamp } from "@/lib/format";
import type { DirectMessage } from "@/types";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { MessageContent, ReplyPreview } from "@/components/chat/MessageContent";
import { isImageOnlyMessage } from "@/lib/message";
import { toast } from "sonner";

interface DMMessageItemProps {
  message: DirectMessage;
  isFirst: boolean;
  isHighlighted?: boolean;
  onReply: (message: DirectMessage) => void;
}

// Track messages that have already been animated to prevent double-animation
const animatedDMMessages = new Set<string>();

const getStableAnimationKey = (message: DirectMessage): string => {
  const timestamp = Math.floor(new Date(message.created_at || "").getTime() / 1000);
  const contentPrefix = message.content.substring(0, 50);
  return `${timestamp}-${message.sender_id}-${contentPrefix}`;
};

export const DMMessageItem = memo(function DMMessageItem({
  message,
  isFirst,
  isHighlighted,
  onReply,
}: DMMessageItemProps) {
  const { user } = useAuthStore();
  // Extract each DM store function separately to avoid re-renders on unrelated changes
  const editMessage = useDMStore((state) => state.editMessage);
  const deleteMessage = useDMStore((state) => state.deleteMessage);
  const addReaction = useDMStore((state) => state.addReaction);
  const removeReaction = useDMStore((state) => state.removeReaction);
  const otherUser = useDMStore((state) => state.currentConversation?.other_user);
  const openModal = useUIStore((state) => state.openModal);
  const isMobile = useIsMobile();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);
  const [reactionDetailsEmoji, setReactionDetailsEmoji] = useState<string | null>(null);
  const [showDesktopEmojiPicker, setShowDesktopEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Stable animation key
  const animationKey = useMemo(
    () => getStableAnimationKey(message),
    [message.created_at, message.sender_id, message.content],
  );

  // Check animation status ONCE on mount
  const shouldAnimate = useMemo(() => {
    if (animatedDMMessages.has(animationKey)) return false;
    animatedDMMessages.add(animationKey);
    if (animatedDMMessages.size > 500) {
      const entries = Array.from(animatedDMMessages);
      entries.slice(0, 250).forEach((key) => animatedDMMessages.delete(key));
    }
    return true;
  }, [animationKey]);

  const isOwnMessage = user?.id === message.sender_id;

  // Check if current user is mentioned in this message
  const isMentioned =
    user?.id &&
    (message.content.includes(`<@${user.id}>`) ||
      message.content.includes("@everyone") ||
      message.content.includes("@here"));

  // Memoized formatted timestamps
  const formattedTime = useMemo(() => {
    const timeStr = format(new Date(message.created_at || ""), "h:mm a");
    return timeStr.replace(/\s+/, "\u00A0");
  }, [message.created_at]);

  const formattedTimestamp = useMemo(() => formatMessageTimestamp(message.created_at || ""), [message.created_at]);

  // Long press handlers for mobile
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

  const handleEdit = async () => {
    if (!user) return;
    if (editContent.trim() && editContent !== message.content) {
      await editMessage(message.id, user.id, editContent.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(message.content);
  };

  const handleDelete = async () => {
    if (!user) return;
    await deleteMessage(message.id, user.id);
    setShowMobileActions(false);
  };

  const handleReactionClick = async (emoji: string) => {
    if (!user) return;
    const existingReaction = message.reactions?.find((r) => r.emoji === emoji);
    if (existingReaction?.hasReacted) {
      await removeReaction(message.id, user.id, emoji);
    } else {
      await addReaction(message.id, user.id, emoji);
    }
    setShowMobileActions(false);
  };

  const handleDesktopAddReaction = useCallback(
    async (emoji: string) => {
      if (!user) return;
      await addReaction(message.id, user.id, emoji);
      setShowDesktopEmojiPicker(false);
    },
    [user, message.id, addReaction],
  );

  const handleCopyText = useCallback(() => {
    navigator.clipboard.writeText(message.content);
    toast.success("Message copied");
  }, [message.content]);

  const handleCopyMessageId = useCallback(() => {
    navigator.clipboard.writeText(message.id);
    toast.success("Message ID copied");
  }, [message.id]);

  const handleStartEditing = useCallback(() => {
    setEditContent(message.content);
    setIsEditing(true);
  }, [message.content]);

  const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

  const nameForUserId = useCallback(
    (userId: string) => {
      if (user?.id && userId === user.id) return "You";
      if (otherUser?.id && userId === otherUser.id) return otherUser.display_name ?? otherUser.username;
      return userId;
    },
    [user?.id, otherUser?.id, otherUser?.display_name, otherUser?.username],
  );

  const getReactionUserNames = useCallback(
    (userIds: string[]) => {
      const unique = Array.from(new Set(userIds));
      return unique.map(nameForUserId);
    },
    [nameForUserId],
  );

  const selectedReaction = useMemo(() => {
    if (!reactionDetailsEmoji) return null;
    return message.reactions?.find((r) => r.emoji === reactionDetailsEmoji) ?? null;
  }, [message.reactions, reactionDetailsEmoji]);

  const selectedReactionNames = useMemo(() => {
    if (!selectedReaction) return [];
    return getReactionUserNames(selectedReaction.users);
  }, [selectedReaction, getReactionUserNames]);

  // Auto-resize textarea for edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  // Computed class names
  const outerClassName = useMemo(() => {
    const base = "px-0";
    const padding = isFirst ? "py-1" : "py-px";
    const animation = shouldAnimate ? "animate-message-slide-in" : "";
    return `${base} ${padding} ${animation}`.trim();
  }, [isFirst, shouldAnimate]);

  const innerClassName = useMemo(() => {
    const classes = [
      "group relative flex px-3 rounded-lg transition-colors duration-200 hover:bg-muted/40",
      isFirst ? "gap-3 py-1.5" : "gap-3 py-0.5",
    ];
    if (isMentioned) classes.push("bg-amber-950/50 border-l-2 border-l-amber-500");
    if (isHighlighted) classes.push("animate-highlight-message bg-primary/20 ring-2 ring-primary/50");
    return classes.join(" ");
  }, [isFirst, isMentioned]);

  return (
    <>
      <div
        id={`message-${message.id}`}
        className={outerClassName}
        style={shouldAnimate ? { animationFillMode: "both" } : undefined}
      >
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
              {/* Avatar / Timestamp column */}
              <div className="w-10 flex-shrink-0">
                {isFirst && message.sender ? (
                  <div
                    className="dm-avatar-click cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal("userProfile", { userId: message.sender_id });
                    }}
                  >
                    <AvatarWithDecoration user={message.sender} className="w-10 h-10" active={isRowHovered} />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[10px] font-[Inter,system-ui,sans-serif] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {formattedTime}
                    </span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {isFirst && (
                  <div className="flex items-baseline gap-2 mb-0.5 font-[Inter,system-ui,sans-serif]">
                    <span
                      className="dm-username-click text-[14px] sm:text-[15px] font-medium text-foreground leading-tight cursor-pointer hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        openModal("userProfile", { userId: message.sender_id });
                      }}
                    >
                      {message.sender?.display_name || message.sender?.username}
                    </span>
                    <span className="text-[11px] sm:text-[12px] text-muted-foreground leading-none">
                      {formattedTimestamp}
                    </span>
                  </div>
                )}

                {/* Reply preview */}
                {message.reply_to && (
                  <div
                    className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground flex-nowrap overflow-hidden"
                    onClick={(e) => {
                      e.stopPropagation();
                      const targetEl = document.getElementById(`message-${message.reply_to!.id}`);
                      if (targetEl) {
                        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
                        targetEl.classList.add("animate-highlight-message");
                        setTimeout(() => targetEl.classList.remove("animate-highlight-message"), 2000);
                      }
                    }}
                  >
                    <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
                    <span className="flex-shrink-0">Replying to</span>
                    <span className="font-medium text-primary flex-shrink-0">
                      @{message.reply_to.sender?.display_name || message.reply_to.sender?.username || "unknown"}
                    </span>
                    {(() => {
                      const replyContent = message.reply_to.content;
                      if (isImageOnlyMessage(replyContent)) {
                        return (
                          <span className="italic flex-shrink-0 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            attachment
                          </span>
                        );
                      }
                      const attachmentUrlPattern =
                        /https?:\/\/[^\s]*(?:supabase\.co\/storage\/v1\/|\.(?:jpg|jpeg|png|gif|webp|mp4|mov|pdf|zip|rar|doc|docx|xls|xlsx))(?:[^\s]*)/gi;
                      const textOnly = replyContent
                        .split("\n")
                        .map((line) => line.replace(attachmentUrlPattern, "").trim())
                        .filter((line) => line.length > 0)
                        .join(" ");
                      if (!textOnly) {
                        return (
                          <span className="italic flex-shrink-0 flex items-center gap-1">
                            <Paperclip className="w-3 h-3" />
                            attachment
                          </span>
                        );
                      }
                      return (
                        <span className="truncate max-w-[120px] sm:max-w-[200px]">
                          <ReplyPreview content={textOnly} maxLength={30} />
                        </span>
                      );
                    })()}
                  </div>
                )}

                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      ref={textareaRef}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm resize-none outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 min-h-[60px] max-h-[300px] overflow-y-auto"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleEdit();
                        }
                        if (e.key === "Escape") {
                          handleCancelEdit();
                        }
                      }}
                      style={{ lineHeight: "1.5" }}
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
                    <MessageContent content={message.content} currentUserId={user?.id} messageId={message.id} />
                  </div>
                )}

                {message.edited_at && !isEditing && <span className="text-[10px] text-muted-foreground">(edited)</span>}

                {/* Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {message.reactions.map((reaction) => (
                      <HoverCard key={reaction.emoji} openDelay={200}>
                        <HoverCardTrigger asChild>
                          <span className="inline-flex">
                            <button
                              onClick={() => handleReactionClick(reaction.emoji)}
                              className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-200",
                                reaction.hasReacted
                                  ? "bg-primary/20 border-primary text-primary"
                                  : "bg-secondary/80 border-transparent hover:border-border hover:bg-secondary",
                              )}
                            >
                              <FluentEmoji emoji={reaction.emoji} size={24} />
                              <span className="text-sm font-medium">{reaction.count}</span>
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
                                <div className="shrink-0">
                                  <FluentEmoji emoji={reaction.emoji} size={32} />
                                </div>
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
              </div>

              {/* Hover actions - Desktop only */}
              {!isEditing && (
                <div className="absolute right-2 -top-4 hidden md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200">
                  {/* Add reaction */}
                  <EmojiPicker
                    open={showDesktopEmojiPicker}
                    onOpenChange={setShowDesktopEmojiPicker}
                    onEmojiSelect={handleDesktopAddReaction}
                  >
                    <button
                      className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      aria-label="Add reaction"
                      title="Add reaction"
                    >
                      <Smile className="w-4 h-4" />
                    </button>
                  </EmojiPicker>

                  {/* Reply */}
                  <button
                    className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    onClick={() => onReply(message)}
                    aria-label="Reply"
                    title="Reply"
                  >
                    <Reply className="w-4 h-4" />
                  </button>

                  {/* Edit (own messages) */}
                  {isOwnMessage && (
                    <button
                      className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      onClick={handleStartEditing}
                      aria-label="Edit"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  <div className="w-px h-5 bg-border mx-0.5" />

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

                  {/* Delete (own messages) */}
                  {isOwnMessage && (
                    <button
                      className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                      onClick={handleDelete}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </ContextMenuTrigger>

          {/* Context Menu */}
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onReply(message)}>
              <Reply className="w-4 h-4 mr-2" />
              Reply
            </ContextMenuItem>
            {isOwnMessage && (
              <ContextMenuItem onClick={handleStartEditing}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Message
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={handleCopyText}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Text
            </ContextMenuItem>
            <ContextMenuItem onClick={handleCopyMessageId}>
              <Copy className="w-4 h-4 mr-2" />
              Copy Message ID
            </ContextMenuItem>
            {isOwnMessage && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
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
            {/* Quick reactions */}
            <div className="flex justify-center gap-3 mb-4 pb-4 border-b border-border">
              {quickReactions.map((emoji) => {
                const existingReaction = message.reactions?.find((r) => r.emoji === emoji);
                return (
                  <button
                    key={emoji}
                    onClick={() => handleReactionClick(emoji)}
                    className={cn(
                      "text-2xl p-2 rounded-full active:scale-90 transition-transform",
                      existingReaction?.hasReacted ? "bg-primary/20" : "hover:bg-accent",
                    )}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="space-y-1">
              <button
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent active:bg-accent text-left"
                onClick={() => {
                  onReply(message);
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

              {isOwnMessage && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-destructive/10 active:bg-destructive/10 text-left text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Reaction details dialog */}
      <Dialog open={!!reactionDetailsEmoji} onOpenChange={(open) => !open && setReactionDetailsEmoji(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reactionDetailsEmoji && <FluentEmoji emoji={reactionDetailsEmoji} size={18} />}
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
