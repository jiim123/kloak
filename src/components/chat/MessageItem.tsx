import { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef } from "react";
import { getTopEmojis } from "@/lib/emojiRecents";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import {
  Smile,
  Reply,
  Pencil,
  Trash2,
  Pin,
  MoreHorizontal,
  CornerUpLeft,
  Copy,
  Eye,
  EyeOff,
  Paperclip,
  Loader2,
} from "lucide-react";
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
import { useFriendStore } from "@/stores/friendStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageContent } from "./MessageContent";
import { PollMessage } from "./PollMessage";
import { isImageOnlyMessage, convertMentionsToReadable, convertMentionsToRaw } from "@/lib/message";
import { ReplyPreview } from "./MessageContent";
import { formatMessageTimestamp } from "@/lib/format";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { BotTag } from "@/components/ui/bot-tag";
import type { CustomServerRole, Message, ServerRole } from "@/types";
import { format } from "date-fns";
import {
  resolveEmojisByNameFallback,
  resolveQualifiedEmoji,
  type ResolvedEmoji,
} from "@/lib/globalEmojiResolver";
import { useMessageUser, fetchAndCacheUser, getUserFromCache, getOrFetchUser } from "@/stores/userCacheStore";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { getPollIdFromContent, isPollMessageContent } from "@/lib/poll";
import { canRevealGhostIdentityForUser } from "@/lib/ghostIdentity";

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
  externalEditTargetId?: string | null;
  onExternalEditHandled?: (messageId: string) => void;
  customEmojiMap?: Map<string, string>;
  globalEmojiMap?: Map<string, ResolvedEmoji>;
  authorStyleFallback?: {
    role?: ServerRole | null;
    nickname?: string | null;
    roles?: CustomServerRole[];
  };
}

const EMPTY_CUSTOM_EMOJI_MAP = new Map<string, string>();
const EMPTY_GLOBAL_EMOJI_MAP = new Map<string, ResolvedEmoji>();


// Renders a single attachment, using a signed URL for private bucket images
const AttachmentItem = memo(function AttachmentItem({
  attachment,
}: {
  attachment: { id: string; file_url: string; file_name: string; file_type?: string; file_size?: number; width?: number | null; height?: number | null };
}) {
  const signedUrl = useSignedUrl(attachment.file_url);
  const isImage = attachment.file_type?.startsWith("image/");

  // Compute constrained dimensions to reserve space and prevent layout shift
  const reservedStyle = useMemo(() => {
    if (!isImage || !attachment.width || !attachment.height) {
      return isImage ? { width: 300, height: 200 } : undefined;
    }
    const maxW = 400;
    const maxH = 300;
    let w = attachment.width;
    let h = attachment.height;
    if (w > maxW) { h = Math.round(h * (maxW / w)); w = maxW; }
    if (h > maxH) { w = Math.round(w * (maxH / h)); h = maxH; }
    return { width: w, height: h };
  }, [isImage, attachment.width, attachment.height]);

  return (
    <div className="relative">
      {isImage ? (
        <div
          className="rounded-lg overflow-hidden bg-muted/30"
          style={reservedStyle ? { width: reservedStyle.width, height: reservedStyle.height } : undefined}
        >
          {signedUrl ? (
            <img
              src={signedUrl}
              alt={attachment.file_name}
              className="w-full h-full object-contain rounded-lg cursor-pointer hover:opacity-90"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      ) : (
        <a
          href={signedUrl ?? attachment.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 p-3 bg-secondary rounded-lg hover:bg-secondary/80"
        >
          <span className="text-sm font-medium">{attachment.file_name}</span>
          {attachment.file_size && (
            <span className="text-xs text-muted-foreground">({Math.round(attachment.file_size / 1024)} KB)</span>
          )}
        </a>
      )}
    </div>
  );
});

export const MessageItem = memo(function MessageItem({
  message,
  isGrouped,
  showNewDivider,
  isHighlighted,
  onStartEdit,
  externalEditTargetId,
  onExternalEditHandled,
  customEmojiMap: sharedCustomEmojiMap,
  globalEmojiMap: sharedGlobalEmojiMap,
  authorStyleFallback,
}: MessageItemProps) {
  // Selectors - granular to prevent unnecessary re-renders
  const user = useAuthStore((state) => state.user);
  // Extract each message store function separately to avoid re-renders on unrelated changes
  const setReplyingTo = useMessageStore((state) => state.setReplyingTo);
  const editMessage = useMessageStore((state) => state.editMessage);
  const pinMessage = useMessageStore((state) => state.pinMessage);
  const addReaction = useMessageStore((state) => state.addReaction);
  const removeReaction = useMessageStore((state) => state.removeReaction);
  const setEmbedHidden = useMessageStore((state) => state.setEmbedHidden);
  const members = useServerStore((state) => state.members);
  const roles = useServerStore((state) => state.roles);
  const currentServer = useServerStore((state) => state.currentServer);
  const currentChannel = useServerStore((state) => state.currentChannel);
  const compactMode = useUIStore((state) => state.compactMode);
  const showTimestamps = useUIStore((state) => state.showTimestamps);
  const openModal = useUIStore((state) => state.openModal);
  const getOptimisticStatus = useSyncStore((state) => state.getOptimisticStatus);
  const isMobile = useIsMobile();
  const topEmojis = useMemo(() => getTopEmojis(3), []);

  // State - SEPARATE states for desktop and mobile emoji pickers
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showDesktopEmojiPicker, setShowDesktopEmojiPicker] = useState(false);
  const [showMobileEmojiPicker, setShowMobileEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const customEmojiMap = sharedCustomEmojiMap ?? EMPTY_CUSTOM_EMOJI_MAP;
  const globalEmojiMap = sharedGlobalEmojiMap ?? EMPTY_GLOBAL_EMOJI_MAP;
  const [hoveredRoleIcon, setHoveredRoleIcon] = useState(false);
  
  const [reactionDetailsEmoji, setReactionDetailsEmoji] = useState<string | null>(null);
  const [reactionUserNameOverrides, setReactionUserNameOverrides] = useState<Map<string, string>>(new Map());

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if pending optimistic message
  const isPending = useMemo(() => {
    return message.id.startsWith("temp-") || getOptimisticStatus(message.id) === "pending";
  }, [message.id, getOptimisticStatus]);

  const isOwnMessage = useMemo(
    () => message.is_own ?? user?.id === message.user_id,
    [message.is_own, user?.id, message.user_id],
  );

  // Phase 1: Look up user from centralized cache (no fallback to message.user)
  const messageUser = useMessageUser(message.user_id);
  const hasMessageDecoration = Boolean(messageUser?.avatar_decoration);
  const messageAvatarSizeClass = hasMessageDecoration ? "w-9 h-9" : "w-10 h-10";

  // Memoize member lookups
  const channels = useServerStore((state) => state.channels);

  const { currentMember, messageMember, usersMap, channelsMap } = useMemo(() => {
    const userMap = new Map<string, { username: string; display_name?: string | null; nickname?: string | null }>();
    members.forEach((m) => {
      if (m.user) {
        userMap.set(m.user_id, {
          username: m.user.username,
          display_name: m.user.display_name,
          nickname: m.nickname,
        });
      }
    });

    const channelMap = new Map<string, { name: string }>();
    channels.forEach((c) => {
      channelMap.set(c.id, { name: c.name });
    });

    return {
      currentMember: members.find((m) => m.user_id === user?.id),
      messageMember: members.find((m) => m.user_id === message.user_id),
      usersMap: userMap,
      channelsMap: channelMap,
    };
  }, [members, channels, user?.id, message.user_id]);

  const messageRoles = useMemo(
    () => messageMember?.roles ?? authorStyleFallback?.roles ?? [],
    [messageMember?.roles, authorStyleFallback?.roles],
  );
  const messageBaseRole = messageMember?.role ?? authorStyleFallback?.role;

  // Note: avoid per-message global listeners/effects in message rows.

  const priorityRoleWithIcon = useMemo<Pick<CustomServerRole, "name" | "icon"> | null>(() => {
    const memberRoles = messageRoles;
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
  }, [messageRoles, roles]);

  const roleIconNode = useMemo(() => {
    if (!priorityRoleWithIcon?.icon) return null;
    const icon = priorityRoleWithIcon.icon;
    const match = icon.match(/^:([a-z0-9_]{2,12}):$/);
    if (match) {
      const url = customEmojiMap.get(match[1]);
      if (!url) return null;
      return (
        <img src={url} alt={icon} className="inline-block w-4 h-4 align-text-bottom object-contain" loading="lazy" />
      );
    }
    return <FluentEmoji emoji={icon} size={16} className="align-text-bottom" />;
  }, [priorityRoleWithIcon?.icon, customEmojiMap]);

  const resolveCustomEmojiUrl = useCallback(
    (emoji: string): string | undefined => {
      // Match unqualified :name: or qualified :name~ServerName:
      const qualifiedMatch = emoji.match(/^:([a-z0-9_]{2,12})~(.+):$/i);
      if (qualifiedMatch) {
        const qualifiedKey = `${qualifiedMatch[1]}~${qualifiedMatch[2]}`;
        const qualifiedResolved = resolveQualifiedEmoji(qualifiedKey);
        if (qualifiedResolved) return qualifiedResolved.url;
        return globalEmojiMap.get(qualifiedMatch[1])?.url;
      }
      const unqualifiedMatch = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
      if (unqualifiedMatch) {
        return customEmojiMap.get(unqualifiedMatch[1]) || globalEmojiMap.get(unqualifiedMatch[1])?.url;
      }
      return undefined;
    },
    [customEmojiMap, globalEmojiMap],
  );

  // Stable key for reaction emoji names — only re-fetch when the set of custom emoji names changes
  const reactionEmojiKey = useMemo(() => {
    const reactions = message.reactions ?? [];
    const names: string[] = [];
    for (const r of reactions) {
      const m = r.emoji.match(/^:([a-z0-9_]{2,12}):$/i);
      if (m) names.push(m[1]);
    }
    return names.sort().join(",");
  }, [message.reactions]);

  const [fallbackEmojiUrls, setFallbackEmojiUrls] = useState<Map<string, string | null>>(new Map());
  useEffect(() => {
    if (!reactionEmojiKey) return;
    const names = reactionEmojiKey.split(",");
    // Filter to only unresolved names
    const unresolved = names.filter((name) => !resolveCustomEmojiUrl(`:${name}:`));
    if (unresolved.length === 0) return;
    let cancelled = false;
    resolveEmojisByNameFallback(unresolved)
      .then((map) => {
        if (cancelled) return;
        setFallbackEmojiUrls((prev) => {
          const next = new Map(prev);
          for (const [k, v] of map) next.set(k, v);
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [reactionEmojiKey, resolveCustomEmojiUrl]);

  const reactionEmojiNode = useCallback(
    (emoji: string) => {
      const url = resolveCustomEmojiUrl(emoji);
      if (url) {
        return <img src={url} alt={emoji} className="w-6 h-6 object-contain" decoding="async" />;
      }
      // Check if it looks like a custom emoji that we can't resolve locally
      if (/^:[a-z0-9_]{2,12}:$/i.test(emoji)) {
        const m = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
        const fallbackUrl = m ? fallbackEmojiUrls.get(m[1]) : null;
        if (fallbackUrl) {
          return <img src={fallbackUrl} alt={emoji} className="w-6 h-6 object-contain" decoding="async" />;
        }
        return <span className="text-sm leading-none text-muted-foreground">{emoji}</span>;
      }
      return <FluentEmoji emoji={emoji} size={24} />;
    },
    [fallbackEmojiUrls, resolveCustomEmojiUrl],
  );

  const reactionEmojiNodeLarge = useCallback(
    (emoji: string) => {
      const url = resolveCustomEmojiUrl(emoji);
      if (url) {
        return <img src={url} alt={emoji} className="w-8 h-8 object-contain" decoding="async" />;
      }
      if (/^:[a-z0-9_]{2,12}:$/i.test(emoji)) {
        const m = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
        const fallbackUrl = m ? fallbackEmojiUrls.get(m[1]) : null;
        if (fallbackUrl) {
          return <img src={fallbackUrl} alt={emoji} className="w-8 h-8 object-contain" decoding="async" />;
        }
        return <span className="text-sm leading-none text-muted-foreground">{emoji}</span>;
      }
      return <FluentEmoji emoji={emoji} size={32} />;
    },
    [fallbackEmojiUrls, resolveCustomEmojiUrl],
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
      return unique.map((id) => {
        if (id === user?.id) return "You";
        const memberName = memberNameById.get(id);
        if (memberName) return memberName;
        const overrideName = reactionUserNameOverrides.get(id);
        if (overrideName) return overrideName;
        const cachedUser = getUserFromCache(id);
        if (cachedUser) return cachedUser.display_name ?? cachedUser.username ?? id;
        return id;
      });
    },
    [memberNameById, reactionUserNameOverrides, user?.id],
  );

  const unresolvedReactionUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const reaction of message.reactions ?? []) {
      for (const uid of reaction.users) {
        if (!uid || uid === user?.id) continue;
        if (uid.startsWith("ghost_")) continue;
        if (memberNameById.has(uid)) continue;
        if (reactionUserNameOverrides.has(uid)) continue;
        ids.add(uid);
      }
    }
    return Array.from(ids);
  }, [memberNameById, message.reactions, reactionUserNameOverrides, user?.id]);

  useEffect(() => {
    if (unresolvedReactionUserIds.length === 0) return;
    let cancelled = false;

    unresolvedReactionUserIds.forEach((uid) => {
      const cachedUser = getUserFromCache(uid);
      if (cachedUser) {
        const displayName = cachedUser.display_name ?? cachedUser.username;
        if (displayName) {
          setReactionUserNameOverrides((prev) => {
            if (prev.get(uid) === displayName) return prev;
            const next = new Map(prev);
            next.set(uid, displayName);
            return next;
          });
        }
        return;
      }

      void getOrFetchUser(uid)
        .then((fetchedUser) => {
          if (cancelled || !fetchedUser) return;
          const displayName = fetchedUser.display_name ?? fetchedUser.username;
          if (!displayName) return;
          setReactionUserNameOverrides((prev) => {
            if (prev.get(uid) === displayName) return prev;
            const next = new Map(prev);
            next.set(uid, displayName);
            return next;
          });
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [unresolvedReactionUserIds]);

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
  const canUseExternalEmojis = hasPermission("use_external_emojis");
  const isAdmin = canManageMessages;

  const isMentioned = useMemo(() => {
    if (!user?.id) return false;
    const content = message.content;
    return content.includes(`<@${user.id}>`) || content.includes("@everyone") || content.includes("@here");
  }, [user?.id, message.content]);

  const pollId = useMemo(() => getPollIdFromContent(message.content), [message.content]);

  // Check if message has embeddable URLs (non-image links that generate previews)
  const hasEmbeddableUrls = useMemo(() => {
    const urlPattern = /https?:\/\/[^\s<>`\]]+/g;
    const urls = message.content.match(urlPattern) || [];
    // Filter out image URLs
    const imageExtensions = /\.(gif|jpe?g|png|webp|bmp|svg)(\?.*)?$/i;
    const imageHosts = [/media\d*\.giphy\.com/i, /i\.giphy\.com/i, /tenor\.com.*\.gif/i, /i\.imgur\.com/i];
    return urls.some((url) => {
      if (imageExtensions.test(url)) return false;
      if (imageHosts.some((pattern) => pattern.test(url))) return false;
      return true;
    });
  }, [message.content]);

  // Use embed_hidden from database (applies to all users)
  const isEmbedHidden = message.embed_hidden === true;

  const handleRemoveEmbed = useCallback(async () => {
    if (!user) return;
    await setEmbedHidden(message.id, user.id, true);
    toast.success("Embed removed");
  }, [setEmbedHidden, message.id, user]);

  // Ghost mode - hide avatar/username for non-admin message authors
  const isGhostMode = currentChannel?.ghost_mode || false;
  const showMessageAuthorIdentity = useMemo(
    () =>
      canRevealGhostIdentityForUser({
        isGhostMode,
        authorUserId: message.user_id,
        members,
        ownerId: currentServer?.owner_id,
      }),
    [isGhostMode, message.user_id, members, currentServer?.owner_id],
  );
  const showGhostIdentity = isGhostMode && !showMessageAuthorIdentity;

  const replyUser = useMessageUser(message.reply_to?.user_id);

  const showReplyAuthorIdentity = useMemo(
    () =>
      canRevealGhostIdentityForUser({
        isGhostMode,
        authorUserId: message.reply_to?.user_id,
        members,
        ownerId: currentServer?.owner_id,
      }),
    [isGhostMode, message.reply_to?.user_id, members, currentServer?.owner_id],
  );

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

  useEffect(() => {
    if (externalEditTargetId !== message.id || !isOwnMessage) return;
    const readableContent = convertMentionsToReadable(message.content, usersMap, channelsMap);
    setEditContent(readableContent);
    setIsEditing(true);
    onStartEdit?.();
    onExternalEditHandled?.(message.id);
  }, [
    externalEditTargetId,
    message.id,
    message.content,
    isOwnMessage,
    onStartEdit,
    onExternalEditHandled,
    usersMap,
    channelsMap,
  ]);

  // Callbacks
  const handleEdit = useCallback(async () => {
    const trimmed = editContent.trim();
    if (trimmed && user) {
      // Convert readable mentions back to UUID format before saving
      const rawContent = convertMentionsToRaw(trimmed, usersMap, channelsMap);
      if (rawContent !== message.content) {
        await editMessage(message.id, rawContent, user.id);
      }
    }
    setIsEditing(false);
  }, [editContent, message.content, message.id, user, editMessage, usersMap, channelsMap]);

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

  const isExternalEmoji = useCallback(
    (emoji: string): boolean => {
      const match = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
      if (!match) return false; // native emoji
      // If it exists in the current server's emoji map, it's not external
      if (customEmojiMap.has(match[1])) return false;
      return true;
    },
    [customEmojiMap],
  );

  const handleReactionClick = useCallback(
    async (emoji: string, hasReacted: boolean) => {
      if (!user) return;
      if (hasReacted) {
        await removeReaction(message.id, user.id, emoji);
      } else {
        if (isExternalEmoji(emoji) && !canUseExternalEmojis) {
          toast.error("You don't have permission to use external emojis");
          return;
        }
        await addReaction(message.id, user.id, emoji);
      }
    },
    [user, message.id, addReaction, removeReaction, isExternalEmoji, canUseExternalEmojis],
  );

  const handleAddReaction = useCallback(
    (emoji: string) => {
      if (!user) return;
      if (isExternalEmoji(emoji) && !canUseExternalEmojis) {
        toast.error("You don't have permission to use external emojis");
        return;
      }
      addReaction(message.id, user.id, emoji);
    },
    [user, message.id, addReaction, isExternalEmoji, canUseExternalEmojis],
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
      // Convert UUID mentions to readable format before copying
      const readableContent = convertMentionsToReadable(message.content, usersMap, channelsMap);
      await navigator.clipboard.writeText(readableContent);
      toast.success("Message copied to clipboard");
    } catch (error) {
      console.error("Failed to copy text:", error);
      toast.error("Failed to copy message");
    }
  }, [message.content, usersMap, channelsMap]);

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
    const readableContent = convertMentionsToReadable(message.content, usersMap, channelsMap);
    setEditContent(readableContent);
    setIsEditing(true);
  }, [message.content, usersMap, channelsMap]);

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
    const padding = compactMode ? "py-0" : isGrouped ? "py-px" : "py-1";
    return `${base} ${padding}`.trim();
  }, [compactMode, isGrouped]);

  const isAnnouncementChannel = currentChannel?.type === "announcement";

  const innerClassName = useMemo(() => {
    const classes = [
      "group relative flex px-3 rounded-lg hover:bg-muted/40",
      compactMode ? "gap-2 py-0.5" : isGrouped ? "gap-3 py-0.5" : "gap-3 py-1.5",
    ];
    if (isAnnouncementChannel && !isGrouped) {
      classes.push("bg-primary/5 border-l-2 border-l-primary/50 ml-1");
    }
    if (isMentioned) classes.push("bg-amber-950/50 border-l-2 border-l-amber-500");
    if (isHighlighted) classes.push("animate-highlight-message bg-primary/20 ring-2 ring-primary/50");
    if (isPending) classes.push("opacity-70");
    return classes.join(" ");
  }, [compactMode, isMentioned, isHighlighted, isPending, isAnnouncementChannel, isGrouped]);

  const topCustomRoleColor = useMemo(() => {
    const memberRoles = messageRoles;
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
  }, [messageRoles, roles]);

  const usernameColorClass = useMemo(() => {
    if (showGhostIdentity) return "text-muted-foreground";
    if (!topCustomRoleColor) return getRoleColor(messageBaseRole ?? undefined);
    return isGradientColor(topCustomRoleColor) ? "text-transparent" : "text-foreground";
  }, [topCustomRoleColor, messageBaseRole, showGhostIdentity]);

  const usernameColorStyle = useMemo(() => {
    if (showGhostIdentity) return undefined;
    if (!topCustomRoleColor) return undefined;
    return isGradientColor(topCustomRoleColor)
      ? getGradientTextStyle(topCustomRoleColor)
      : ({ color: topCustomRoleColor } as React.CSSProperties);
  }, [topCustomRoleColor, showGhostIdentity]);

  const displayName = showGhostIdentity
    ? "Anonymous"
    : messageMember?.nickname || authorStyleFallback?.nickname || messageUser?.display_name || messageUser?.username;
  const isBotMessageAuthor = !showGhostIdentity && Boolean(messageUser?.is_bot);

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
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (message.reply_to?.id) {
        // Dispatch a custom event instead of using useSearchParams (which causes every MessageItem to re-render)
        window.dispatchEvent(
          new CustomEvent("scrollToMessage", { detail: { messageId: message.reply_to.id } }),
        );
      }
    },
    [message.reply_to?.id],
  );

  return (
    <>
      {showNewDivider && (
        <div className="flex items-center gap-2 my-3 px-4">
          <div className="flex-1 h-px bg-destructive/50" />
          <span className="text-[10px] text-destructive font-medium uppercase tracking-wider">NEW</span>
          <div className="flex-1 h-px bg-destructive/50" />
        </div>
      )}

      <div
        id={`message-${message.id}`}
        className={outerClassName}
        style={undefined}
      >
        {/* ContextMenu is disabled on mobile (use Drawer instead) */}
        <ContextMenu>
          <ContextMenuTrigger asChild disabled={isMobile}>
            <div
              className={innerClassName}
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
                        className={`text-[10px] font-[Inter,system-ui,sans-serif] text-muted-foreground/70 transition-opacity duration-150 whitespace-nowrap block ${
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
                            className={cn(messageAvatarSizeClass, "cursor-pointer")}
                            active={false}
                            onClick={handleUsernameClick}
                          />
                        )
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <span className="text-[10px] font-[Inter,system-ui,sans-serif] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            {formattedTime}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0 overflow-hidden">
                {/* System Message - Special rendering */}
                {message.is_system_message ? (
                  (() => {
                    // Detect poll result system messages by content pattern
                    const isPollResult = message.content?.includes("Poll ended");
                    // Strip the 📊 emoji (and variants) from content for poll results
                    const cleanedContent = isPollResult
                      ? message.content.replace(/📊\s*/g, "").trim()
                      : message.content;

                    const pollIcon = (
                      <svg
                        viewBox="0 0 24 24"
                        className="w-4 h-4 fill-current flex-shrink-0"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M11.7518706,1.99956021 C13.2716867,1.99956021 14.5037411,3.23161462 14.5037411,4.75143076 L14.5037411,19.2499651 C14.5037411,20.7697812 13.2716867,22.0018356 11.7518706,22.0018356 C10.2320544,22.0018356 9,20.7697812 9,19.2499651 L9,4.75143076 C9,3.23161462 10.2320544,1.99956021 11.7518706,1.99956021 Z M18.7518706,6.99956021 C20.2716867,6.99956021 21.5037411,8.23161462 21.5037411,9.75143076 L21.5037411,19.2499651 C21.5037411,20.7697812 20.2716867,22.0018356 18.7518706,22.0018356 C17.2320544,22.0018356 16,20.7697812 16,19.2499651 L16,9.75143076 C16,8.23161462 17.2320544,6.99956021 18.7518706,6.99956021 Z M4.75187055,11.9995602 C6.27168669,11.9995602 7.5037411,13.2316146 7.5037411,14.7514308 L7.5037411,19.2499651 C7.5037411,20.7697812 6.27168669,22.0018356 4.75187055,22.0018356 C3.23205441,22.0018356 2,20.7697812 2,19.2499651 L2,14.7514308 C2,13.2316146 3.23205441,11.9995602 4.75187055,11.9995602 Z" />
                      </svg>
                    );

                    const systemContent = (
                      <div className="flex items-center gap-2 py-1">
                        {messageUser && (
                          <AvatarWithDecoration
                            user={messageUser}
                            className="w-5 h-5 cursor-pointer flex-shrink-0"
                            active={false}
                            onClick={handleUsernameClick}
                          />
                        )}
                        <span className="text-sm text-muted-foreground tracking-tight inline-flex items-center gap-1.5">
                          {isPollResult && pollIcon}
                          <MessageContent
                            content={cleanedContent}
                            currentUserId={user?.id}
                            messageId={message.id}
                            hideEmbeds={isEmbedHidden}
                            customEmojiMap={customEmojiMap}
                            globalEmojiMap={globalEmojiMap}
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
                      </div>
                    );

                    if (isPollResult) {
                      const targetId = message.reply_to_id;
                      return (
                        <button
                          type="button"
                          className="text-left cursor-pointer w-full"
                          onClick={() => {
                            const el = targetId ? document.getElementById(`message-${targetId}`) : null;
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              el.classList.add("bg-primary/10");
                              setTimeout(() => el.classList.remove("bg-primary/10"), 2000);
                            }
                          }}
                        >
                          {systemContent}
                        </button>
                      );
                    }
                    return systemContent;
                  })()
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
                        {isBotMessageAuthor && (
                          <BotTag className="mr-1.5" />
                        )}
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
                          {isBotMessageAuthor && (
                            <BotTag />
                          )}
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
                            <span className="text-[11px] sm:text-[12px] text-muted-foreground leading-none">
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
                        className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1 cursor-pointer hover:text-foreground flex-nowrap overflow-hidden"
                        onClick={handleReplyClick}
                        onTouchStart={(e) => {
                          // Stop parent long-press timer from starting when tapping reply preview
                          e.stopPropagation();
                        }}
                        onTouchEnd={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
                        <span className="flex-shrink-0">Replying to</span>
                        {showReplyAuthorIdentity ? (
                          <span className="font-medium text-primary flex-shrink-0">
                            @{replyUser?.display_name || replyUser?.username || "unknown"}
                          </span>
                        ) : (
                          <span className="font-medium text-primary italic flex-shrink-0">Anonymous</span>
                        )}
                        {(() => {
                          const replyContent = message.reply_to.content;
                          if (isPollMessageContent(replyContent)) {
                            return <span className="italic flex-shrink-0">poll</span>;
                          }
                          if (isImageOnlyMessage(replyContent)) {
                            return (
                              <span className="italic flex-shrink-0 flex items-center gap-1">
                                <Paperclip className="w-3 h-3" />
                                attachment
                              </span>
                            );
                          }
                          // Strip attachment/image URLs from content for preview
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
                              <ReplyPreview
                                content={textOnly}
                                maxLength={30}
                                customEmojiMap={customEmojiMap}
                                globalEmojiMap={globalEmojiMap}
                              />
                            </span>
                          );
                        })()}
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
                    ) : pollId ? (
                      <div className="mt-1 max-w-[520px]">
                        <PollMessage pollId={pollId} />
                      </div>
                    ) : (
                      <div className="text-[14px] sm:text-[14px] font-normal leading-[1.5] font-[Inter,system-ui,sans-serif] [&>div]:flex [&>div]:items-center [&>div]:flex-wrap overflow-hidden max-w-full">
                        {currentChannel?.type === "announcement" ? (
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
                              <div className="space-y-2 !block">
                                {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
                                {announcementContent && (
                                  <MessageContent
                                    content={announcementContent}
                                    currentUserId={user?.id}
                                    messageId={message.id}
                                    hideEmbeds={isEmbedHidden}
                                    customEmojiMap={customEmojiMap}
                                    globalEmojiMap={globalEmojiMap}
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
                            hideEmbeds={isEmbedHidden}
                            customEmojiMap={customEmojiMap}
                            globalEmojiMap={globalEmojiMap}
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
                          <AttachmentItem key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    )}

                    {/* Reactions - skip for system messages */}
                    {!message.is_system_message && message.reactions && message.reactions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {message.reactions.map((reaction) => (
                          <HoverCard key={reaction.emoji} openDelay={200}>
                            <HoverCardTrigger asChild>
                              <span className="inline-flex">
                                <button
                                  onClick={() =>
                                    canAddReactions && handleReactionClick(reaction.emoji, reaction.hasReacted)
                                  }
                                  disabled={!canAddReactions}
                                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                                    reaction.hasReacted
                                      ? "bg-primary/20 border-primary text-primary"
                                      : "bg-secondary/80 border-transparent hover:border-border hover:bg-secondary"
                                  } ${!canAddReactions ? "opacity-50 cursor-not-allowed" : ""}`}
                                >
                                  {reactionEmojiNode(reaction.emoji)}
                                  <span className="text-sm font-medium">{reaction.count}</span>
                                </button>
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-auto p-1.5" align="start" side="top">
                              {isGhostMode ? (
                                <div className="flex items-center gap-1">
                                  <div className="shrink-0">{reactionEmojiNodeLarge(reaction.emoji)}</div>
                                  <div className="min-w-0 text-sm leading-tight text-muted-foreground">
                                    {reaction.count} {reaction.count === 1 ? "person" : "people"} reacted
                                  </div>
                                </div>
                              ) : (
                                (() => {
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
                                })()
                              )}
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
                <div className="absolute right-2 -top-4 hidden md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 md:flex items-center gap-1 bg-background border border-border rounded-xl shadow-md p-1 transition-opacity duration-100">
                  {/* Quick reactions - top 3 most used */}
                  {canAddReactions && topEmojis.map((emoji) => (
                    <button
                      key={`quick-${emoji}`}
                      className="p-1.5 rounded-lg bg-transparent hover:bg-muted transition-colors"
                      onClick={() => handleAddReaction(emoji)}
                      aria-label={`React with ${emoji}`}
                      title={`React with ${emoji}`}
                    >
                      <FluentEmoji emoji={emoji} size={18} />
                    </button>
                  ))}
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
                  {
                    <button
                      className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => setReplyingTo(message)}
                      aria-label="Reply"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                  }

                  {/* Edit (own messages) */}
                  {isOwnMessage && (
                    <button
                      className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      onClick={() => handleStartEditing()}
                      aria-label="Edit"
                      title="Edit"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Pin - Hide for announcement channels */}
                  {canPinMessages && (
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
            {isOwnMessage && hasEmbeddableUrls && !isEmbedHidden && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleRemoveEmbed}>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Remove Embed
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

              {/* Remove Embed */}
              {isOwnMessage && hasEmbeddableUrls && !isEmbedHidden && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-accent active:bg-accent text-left transition-colors"
                  onClick={() => {
                    handleRemoveEmbed();
                    setShowMobileActions(false);
                  }}
                >
                  <EyeOff className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Remove Embed</span>
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
            {isGhostMode ? (
              <div className="text-sm text-muted-foreground">
                {selectedReaction ? selectedReaction.count : 0}{" "}
                {(selectedReaction?.count ?? 0) === 1 ? "person" : "people"} reacted
              </div>
            ) : selectedReactionNames.length > 0 ? (
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
