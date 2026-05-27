import React, { useState, useEffect, useRef, useCallback, useMemo, memo, forwardRef } from "react";
import { getTopEmojis } from "@/lib/emojiRecents";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import {
  Smile,
  Reply,
  Pencil,
  Trash2,
  Pin,
  MoreHorizontal,
  Share2,
  Link2,
  Copy,
  Eye,
  EyeOff,
  Paperclip,
  Loader2,
  UserX,
  Ban,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AudioPlayer } from "./AudioPlayer";
import { VideoPlayer } from "./VideoPlayer";
import { Button } from "@/components/ui/button";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { canModerateByRoles } from "@/lib/permissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageContent } from "./MessageContent";
import { AttachmentGallery } from "./AttachmentGallery";
import { PollMessage } from "./PollMessage";
import { isImageOnlyMessage, convertMentionsToReadable } from "@/lib/message";
import { ReplyPreview } from "./MessageContent";
import { useEditStore } from "@/stores/editStore";
import { formatMessageTimestamp } from "@/lib/format";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import { ImageLightbox } from "@/components/modals/ImageLightbox";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { BotTag } from "@/components/ui/bot-tag";
import type { CustomServerRole, Message, ServerRole } from "@/types";
import { format } from "date-fns";
import { resolveEmojisByNameFallback, resolveQualifiedEmoji, type ResolvedEmoji } from "@/lib/globalEmojiResolver";
import { useMessageUser, fetchAndCacheUser, getUserFromCache, getOrFetchUser } from "@/stores/userCacheStore";
import { useMessageMaps } from "./MessageMapsContext";
import { cn } from "@/lib/utils";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { useInView } from "@/hooks/useInView";
import { useBlurhash } from "@/hooks/useBlurhash";
import { markAttachmentDecoded, wasAttachmentDecoded } from "@/lib/attachmentLru";
import { FileAttachmentCard } from "@/components/chat/FileAttachmentCard";
import { getPollIdFromContent, isPollMessageContent, usePollLabel } from "@/lib/poll";
import { usePollStore } from "@/stores/pollStore";
import { canRevealGhostIdentityForUser } from "@/lib/ghostIdentity";
import { pickFirstNonBlank } from "@/lib/utils";
import { openUserProfileModal, SIDE_ALIGNED_USER_PROFILE_POPOVER } from "@/lib/userProfilePopover";
import { useRateLimit } from "@/hooks/useRateLimit";
import { rateLimitToast } from "@/lib/rateLimitToast";

// Static data moved outside component
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👋", "🔥", "👀", "💯", "🙌", "😍", "🤔"] as const;

const ROLE_COLORS: Record<string, string> = {
  owner: "text-yellow-400",
  admin: "text-red-400",
  moderator: "text-blue-400",
};

const getRoleColor = (role?: ServerRole): string => {
  return role ? ROLE_COLORS[role] || "text-foreground" : "text-foreground";
};

const isGradientColor = (value?: string | null) => !!value && value.startsWith("linear-gradient");

const gradientStyleCache = new Map<string, React.CSSProperties>();
const getGradientTextStyle = (gradient: string): React.CSSProperties => {
  let cached = gradientStyleCache.get(gradient);
  if (!cached) {
    cached = {
      background: gradient,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
      display: "inline-block",
    } as React.CSSProperties;
    gradientStyleCache.set(gradient, cached);
  }
  return cached;
};

export interface DMActions {
  editMessage: (messageId: string, userId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string, userId: string) => Promise<void>;
  addReaction: (messageId: string, userId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, userId: string, emoji: string) => Promise<void>;
  onReply: (message: Message) => void;
  conversationId?: string;
  /** Resolve display name for a user ID (for reaction tooltips) */
  nameForUserId?: (userId: string) => string;
}

interface MessageItemProps {
  message: Message;
  isGrouped: boolean;
  showNewDivider?: boolean;
  isHighlighted?: boolean;
  onStartEdit?: () => void;
  customEmojiMap?: Map<string, string>;
  globalEmojiMap?: Map<string, ResolvedEmoji>;
  authorStyleFallback?: {
    role?: ServerRole | null;
    nickname?: string | null;
    roles?: CustomServerRole[];
  };
  replyAuthorStyleFallback?: {
    role?: ServerRole | null;
    nickname?: string | null;
    roles?: CustomServerRole[];
  };
  /** When provided, component operates in DM mode (skips server features) */
  dmActions?: DMActions;
  flushOuterXPadding?: boolean;
}

const EMPTY_CUSTOM_EMOJI_MAP = new Map<string, string>();
const EMPTY_GLOBAL_EMOJI_MAP = new Map<string, ResolvedEmoji>();

const isSafeEmojiUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
};

// FIX 5: RoleIconWrapper defined outside MessageItem to avoid remount on every render
interface RoleIconWrapperProps extends React.HTMLAttributes<HTMLSpanElement> {
  children: React.ReactNode;
  isHovered: boolean;
  onHoverChange: (hovered: boolean) => void;
}

const RoleIconWrapper = forwardRef<HTMLSpanElement, RoleIconWrapperProps>(
  ({ children, className, isHovered, onHoverChange, onMouseEnter, onMouseLeave, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex h-4 w-4 shrink-0 items-center justify-center align-middle leading-none",
        isHovered && "animate-pulse",
        className,
      )}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        onHoverChange(true);
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
        onHoverChange(false);
      }}
      {...props}
    >
      {children}
    </span>
  ),
);
RoleIconWrapper.displayName = "RoleIconWrapper";

const ReplyConnector = memo(function ReplyConnector() {
  return (
    <span aria-hidden="true" className="relative h-3.5 w-7 flex-shrink-0 text-muted-foreground/70">
      <span className="absolute left-1 top-[2px] h-2.5 w-5 rounded-tl-md border-l-2 border-t-2 border-current" />
    </span>
  );
});
ReplyConnector.displayName = "ReplyConnector";

// Renders a single attachment, using a signed URL for private bucket images
const AttachmentItem = memo(function AttachmentItem({
  attachment,
  onImageClick,
  uploaderName,
  layout = "natural",
}: {
  attachment: {
    id: string;
    file_url: string;
    file_name: string;
    file_type?: string;
    file_size?: number;
    width?: number | null;
    height?: number | null;
    placeholder?: string | null;
    is_spoiler?: boolean | null;
    is_voice_message?: boolean | null;
  };
  onImageClick?: (url: string) => void;
  uploaderName?: string;
  /** "natural" uses intrinsic aspect & max 400x300; "fill" stretches to container (gallery cells). */
  layout?: "natural" | "fill";
}) {
  // Only fetch the signed blob URL once the attachment scrolls near the viewport.
  // 200px keeps off-screen rows as BlurHash-only, which matters a lot in long
  // channels. Was 600px historically to mask flicker — BlurHash now covers that.
  const [inViewRef, inView] = useInView<HTMLDivElement>({ rootMargin: "200px", once: true });
  const blurhashUrl = useBlurhash(attachment.id, attachment.placeholder ?? null);
  const isSpoiler = !!attachment.is_spoiler;
  const [revealed, setRevealed] = useState(!isSpoiler);
  // Spoiler attachments don't fetch until clicked.
  const shouldFetch = inView && revealed;
  const { url: signedUrl, refresh } = useSignedUrl(
    shouldFetch ? attachment.file_url : null,
    { withRefresh: true },
  );
  const isImage = attachment.file_type?.startsWith("image/");
  const isVideo = attachment.file_type?.startsWith("video/");
  const isAudio = attachment.file_type?.startsWith("audio/");

  // Compute constrained dimensions to reserve space and prevent layout shift
  const reservedStyle = useMemo(() => {
    if ((!isImage && !isVideo) || !attachment.width || !attachment.height) {
      if (isImage) return { width: 300, height: 200 };
      if (isVideo) return { width: 400, height: 225 };
      return undefined;
    }
    const maxW = 400;
    const maxH = 300;
    let w = attachment.width;
    let h = attachment.height;
    if (w > maxW) {
      h = Math.round(h * (maxW / w));
      w = maxW;
    }
    if (h > maxH) {
      w = Math.round(w * (maxH / h));
      h = maxH;
    }
    return { width: w, height: h };
  }, [isImage, isVideo, attachment.width, attachment.height]);

  // Fade-in state per media element. Decoded LRU lets a re-mount skip the
  // ghost entirely when the bitmap is already in the browser's cache.
  const [isLoaded, setIsLoaded] = useState(() => wasAttachmentDecoded(attachment.id));
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!wasAttachmentDecoded(attachment.id)) {
      setIsLoaded(false);
    }
  }, [signedUrl, attachment.id]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !signedUrl) return;
    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === "function") {
        img.decode().then(() => {
          setIsLoaded(true);
          markAttachmentDecoded(attachment.id);
        }).catch(() => {
          setIsLoaded(true);
          markAttachmentDecoded(attachment.id);
        });
      } else {
        setIsLoaded(true);
        markAttachmentDecoded(attachment.id);
      }
    }
  }, [signedUrl, attachment.id]);

  // Audio has no visual surface — render compact loader/player inline.
  if (isAudio) {
    return (
      <div ref={inViewRef}>
        {!signedUrl ? (
          <div className="flex items-center justify-center rounded-lg bg-muted/20 h-12 w-[280px]">
            {inView && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
        ) : (
          <AudioPlayer
            src={signedUrl}
            fileName={attachment.file_name}
            fileSize={attachment.file_size}
            onError={refresh}
          />
        )}
      </div>
    );
  }

  if (isImage) {
    const placeholderBg = blurhashUrl
      ? { backgroundImage: `url(${blurhashUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
      : undefined;
    const isFill = layout === "fill";
    const containerStyle = isFill
      ? undefined
      : reservedStyle
        ? { width: reservedStyle.width, height: reservedStyle.height }
        : undefined;
    return (
      <div
        ref={inViewRef}
        className={cn(
          "relative rounded-lg overflow-hidden bg-muted/30",
          isFill && "w-full h-full",
        )}
        style={containerStyle}
      >
        {/* BlurHash placeholder (or muted gray when no hash yet) */}
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            blurhashUrl ? "" : "bg-muted/40",
            isLoaded && signedUrl ? "opacity-0" : "opacity-100",
            !blurhashUrl && !(isLoaded && signedUrl) && "animate-pulse",
            isSpoiler && !revealed && "scale-110",
          )}
          style={{
            ...placeholderBg,
            ...(isSpoiler && !revealed ? { filter: "blur(20px)" } : undefined),
          }}
          aria-hidden
        />
        {isSpoiler && !revealed && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setRevealed(true); }}
            className="absolute inset-0 z-10 flex items-center justify-center"
          >
            <span className="rounded-full bg-background/80 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-foreground shadow-sm">
              Spoiler
            </span>
          </button>
        )}
        {signedUrl && (
          <img
            ref={imgRef}
            src={signedUrl}
            alt={attachment.file_name}
            width={isFill ? undefined : reservedStyle?.width}
            height={isFill ? undefined : reservedStyle?.height}
            className={cn(
              "relative w-full h-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity duration-200",
              isFill ? "object-cover" : "object-contain",
              isLoaded ? "opacity-100" : "opacity-0",
            )}
            decoding="async"
            loading="lazy"
            onClick={() => onImageClick?.(signedUrl)}
            onLoad={() => { setIsLoaded(true); markAttachmentDecoded(attachment.id); }}
            onError={() => { setIsLoaded(false); refresh(); }}
          />
        )}
      </div>
    );
  }

  if (isVideo) {
    return (
      <div
        ref={inViewRef}
        className="relative rounded-2xl overflow-hidden bg-muted/30 w-full max-w-[480px]"
        style={reservedStyle ? { aspectRatio: `${reservedStyle.width} / ${reservedStyle.height}` } : undefined}
      >
        <div
          className={cn(
            "absolute inset-0 bg-muted/40 transition-opacity duration-200 pointer-events-none z-10",
            isLoaded && signedUrl ? "opacity-0" : "opacity-100 animate-pulse",
          )}
          aria-hidden
        />
        {signedUrl && (
          <VideoPlayer
            src={signedUrl}
            fileName={attachment.file_name}
            onError={() => { setIsLoaded(false); refresh(); }}
            onReady={() => setIsLoaded(true)}
          />
        )}
      </div>
    );
  }

  // Generic file attachment
  return <FileAttachmentCard ref={inViewRef as unknown as React.Ref<HTMLDivElement>} attachment={attachment} />;
});

export const MessageItem = memo(function MessageItem({
  message,
  isGrouped,
  showNewDivider,
  isHighlighted,
  onStartEdit,
  customEmojiMap: sharedCustomEmojiMap,
  globalEmojiMap: sharedGlobalEmojiMap,
  authorStyleFallback,
  replyAuthorStyleFallback,
  dmActions,
  flushOuterXPadding = false,
}: MessageItemProps) {
  const isDM = !!dmActions;
  const effectiveAuthorStyle = isDM ? undefined : authorStyleFallback;
  // Selectors - granular to prevent unnecessary re-renders
  const user = useAuthStore((state) => state.user);
  // Extract each message store function separately to avoid re-renders on unrelated changes
  const setReplyingTo = useMessageStore((state) => state.setReplyingTo);
  const channelEditMessage = useMessageStore((state) => state.editMessage);
  const pinMessage = useMessageStore((state) => state.pinMessage);
  const channelAddReaction = useMessageStore((state) => state.addReaction);
  const channelRemoveReaction = useMessageStore((state) => state.removeReaction);
  const setEmbedHidden = useMessageStore((state) => state.setEmbedHidden);
  // NOTE: `members` and `channels` are NOT subscribed to here — doing so would
  // cascade-re-render every MessageItem when any member joins/leaves/presence-updates.
  // Instead we read pre-built maps + specific records from MessageMapsContext below.
  const roles = useServerStore((state) => state.roles);
  const currentServer = useServerStore((state) => state.currentServer);
  const currentChannel = useServerStore((state) => state.currentChannel);
  const compactMode = useUIStore((state) => state.compactMode);
  const showTimestamps = useUIStore((state) => state.showTimestamps);
  const openModal = useUIStore((state) => state.openModal);
  const getOptimisticStatus = useSyncStore((state) => state.getOptimisticStatus);
  const isMobile = useIsMobile();
  const topEmojis = useMemo(() => getTopEmojis(3), []);
  // Unified action wrappers — in DM mode, delegate to dmActions; in channel mode, use stores
  const editMessage = isDM
    ? (id: string, content: string, userId: string) => dmActions!.editMessage(id, userId, content)
    : channelEditMessage;
  const addReaction = isDM
    ? (id: string, userId: string, emoji: string) => dmActions!.addReaction(id, userId, emoji)
    : channelAddReaction;
  const removeReaction = isDM
    ? (id: string, userId: string, emoji: string) => dmActions!.removeReaction(id, userId, emoji)
    : channelRemoveReaction;

  // State - SEPARATE states for desktop and mobile emoji pickers
  const editingMessage = useEditStore((s) => s.editingMessage);
  const isBeingEdited = editingMessage?.id === message.id;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showDesktopEmojiPicker, setShowDesktopEmojiPicker] = useState(false);
  const [showMobileEmojiPicker, setShowMobileEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isRowHovered, setIsRowHovered] = useState(false);
  const customEmojiMap = sharedCustomEmojiMap ?? EMPTY_CUSTOM_EMOJI_MAP;
  const globalEmojiMap = sharedGlobalEmojiMap ?? EMPTY_GLOBAL_EMOJI_MAP;
  const [hoveredRoleIcon, setHoveredRoleIcon] = useState(false);

  const [reactionDetailsEmoji, setReactionDetailsEmoji] = useState<string | null>(null);
  const [attachmentLightboxUrl, setAttachmentLightboxUrl] = useState<string | null>(null);
  const [reactionUserNameOverrides, setReactionUserNameOverrides] = useState<Map<string, string>>(new Map());
  const [reactionDrawerOpen, setReactionDrawerOpen] = useState(false);

  // Refs
  // Refs
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactionLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if pending optimistic message
  const isPending = useMemo(() => {
    return message.id.startsWith("temp-") || getOptimisticStatus(message.id) === "pending";
  }, [message.id, getOptimisticStatus]);

  const isOwnMessage = useMemo(
    () => message.is_own ?? user?.id === message.user_id,
    [message.is_own, user?.id, message.user_id],
  );

  // Strip attachment URLs from content to avoid duplicate rendering with AttachmentItem
  const displayContent = useMemo(() => {
    if (!message.attachments || message.attachments.length === 0) return message.content;
    let cleaned = message.content;
    for (const att of message.attachments) {
      if (att.file_url) {
        cleaned = cleaned.replace(att.file_url, "").trim();
      }
    }
    // Also strip any Supabase signed attachment URLs and kloak-attachment:// references
    cleaned = cleaned
      .replace(/https?:\/\/[^\s]*supabase\.co\/storage\/v1\/object\/sign\/attachments\/[^\s]*/g, "")
      .trim();
    cleaned = cleaned.replace(/kloak-attachment:\/\/[^\s]*/g, "").trim();
    cleaned = cleaned.replace(/https?:\/\/kloakcdn\.b-cdn\.net\/attachments\/[^\s]*/g, "").trim();
    return cleaned;
  }, [message.content, message.attachments]);

  // Check if this message author is blocked (either direction)
  const isBlockedUser = useFriendStore(
    useCallback((s) => s.visibilityBlockedUserIds.includes(message.user_id), [message.user_id]),
  );

  // Phase 1: Look up user from centralized cache (no fallback to message.user)
  const messageUser = useMessageUser(message.user_id);
  const hasMessageDecoration = Boolean(messageUser?.avatar_decoration);
  const messageAvatarSizeClass = hasMessageDecoration ? "w-9 h-9" : "w-10 h-10";

  // Pre-built maps from context (computed once in MessageList, not per item)
  const { usersMap, channelsMap, memberNameById, messageMemberByUserId, membersList } = useMessageMaps();

  const { currentMember, messageMember } = useMemo(() => {
    if (isDM) {
      return { currentMember: undefined, messageMember: undefined };
    }
    return {
      currentMember: messageMemberByUserId.get(user?.id ?? ""),
      messageMember: messageMemberByUserId.get(message.user_id),
    };
  }, [messageMemberByUserId, user?.id, message.user_id, isDM]);

  const messageRoles = useMemo(
    () => (isDM ? [] : (messageMember?.roles ?? effectiveAuthorStyle?.roles ?? [])),
    [isDM, messageMember?.roles, effectiveAuthorStyle?.roles],
  );
  const messageBaseRole = isDM ? undefined : (messageMember?.role ?? effectiveAuthorStyle?.role);

  // Note: avoid per-message global listeners/effects in message rows.

  const priorityRoleWithIcon = useMemo<Pick<CustomServerRole, "name" | "icon"> | null>(() => {
    if (isDM) return null;
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
  }, [isDM, messageRoles, roles]);

  const roleIconNode = useMemo(() => {
    if (!priorityRoleWithIcon?.icon) return null;
    const icon = priorityRoleWithIcon.icon;
    const match = icon.match(/^:([a-z0-9_]{2,12}):$/);
    if (match) {
      const url = customEmojiMap.get(match[1]);
      if (!url) return null;
      return (
        <img src={url} alt={icon} className="block h-4 w-4 object-contain" loading="lazy" />
      );
    }
    return <FluentEmoji emoji={icon} size={16} className="block" />;
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
      if (url && isSafeEmojiUrl(url)) {
        return <img src={url} alt={emoji} className="w-5 h-5 object-contain" decoding="async" />;
      }
      // Check if it looks like a custom emoji that we can't resolve locally
      if (/^:[a-z0-9_]{2,12}:$/i.test(emoji)) {
        const m = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
        const fallbackUrl = m ? fallbackEmojiUrls.get(m[1]) : null;
        if (fallbackUrl && isSafeEmojiUrl(fallbackUrl)) {
          return <img src={fallbackUrl} alt={emoji} className="w-5 h-5 object-contain" decoding="async" />;
        }
        return <span className="text-xs leading-none text-muted-foreground">{emoji}</span>;
      }
      return <FluentEmoji emoji={emoji} size={20} />;
    },
    [fallbackEmojiUrls, resolveCustomEmojiUrl],
  );

  const reactionEmojiNodeLarge = useCallback(
    (emoji: string) => {
      const url = resolveCustomEmojiUrl(emoji);
      if (url && isSafeEmojiUrl(url)) {
        return <img src={url} alt={emoji} className="w-8 h-8 object-contain" decoding="async" />;
      }
      if (/^:[a-z0-9_]{2,12}:$/i.test(emoji)) {
        const m = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
        const fallbackUrl = m ? fallbackEmojiUrls.get(m[1]) : null;
        if (fallbackUrl && isSafeEmojiUrl(fallbackUrl)) {
          return <img src={fallbackUrl} alt={emoji} className="w-8 h-8 object-contain" decoding="async" />;
        }
        return <span className="text-sm leading-none text-muted-foreground">{emoji}</span>;
      }
      return <FluentEmoji emoji={emoji} size={32} />;
    },
    [fallbackEmojiUrls, resolveCustomEmojiUrl],
  );

  // memberNameById is now provided by MessageMapsContext

  const getReactionUserNames = useCallback(
    (userIds: string[]) => {
      const unique = Array.from(new Set(userIds));
      return unique
        .map((id) => {
          if (id === user?.id) return "You";
          const memberName = memberNameById.get(id);
          if (memberName) return memberName;
          const overrideName = reactionUserNameOverrides.get(id);
          if (overrideName === "[deleted]") return null; // deleted account
          if (overrideName) return overrideName;
          const cachedUser = getUserFromCache(id);
          if (cachedUser) return cachedUser.display_name ?? cachedUser.username ?? null;
          return null; // unresolved — don't show UUID
        })
        .filter((name): name is string => name !== null);
    },
    [memberNameById, reactionUserNameOverrides, user?.id],
  );

  const ensureReactionUserNames = useCallback((userIds: string[]) => {
    const unresolvedReactionUserIds = Array.from(
      new Set(
        userIds.filter((uid) => {
          if (!uid || uid === user?.id) return false;
          if (uid.startsWith("ghost_")) return false;
          if (memberNameById.has(uid)) return false;
          if (reactionUserNameOverrides.has(uid)) return false;
          return true;
        }),
      ),
    );
    if (unresolvedReactionUserIds.length === 0) return () => undefined;

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
          if (cancelled) return;
          const displayName = fetchedUser?.display_name ?? fetchedUser?.username;
          const value = displayName || "[deleted]";
          setReactionUserNameOverrides((prev) => {
            if (prev.get(uid) === value) return prev;
            const next = new Map(prev);
            next.set(uid, value);
            return next;
          });
        })
        .catch(() => {
          if (cancelled) return;
          setReactionUserNameOverrides((prev) => {
            if (prev.has(uid)) return prev;
            const next = new Map(prev);
            next.set(uid, "[deleted]");
            return next;
          });
        });
    });

    return () => {
      cancelled = true;
    };
  }, [memberNameById, reactionUserNameOverrides, user?.id]);

  useEffect(() => {
    if (!reactionDrawerOpen) return;
    const dispose = ensureReactionUserNames((message.reactions ?? []).flatMap((reaction) => reaction.users));
    return dispose;
  }, [ensureReactionUserNames, message.reactions, reactionDrawerOpen]);

  const selectedReaction = useMemo(() => {
    if (!reactionDetailsEmoji) return null;
    return message.reactions?.find((r) => r.emoji === reactionDetailsEmoji) ?? null;
  }, [message.reactions, reactionDetailsEmoji]);

  useEffect(() => {
    if (!selectedReaction) return;
    const dispose = ensureReactionUserNames(selectedReaction.users);
    return dispose;
  }, [ensureReactionUserNames, selectedReaction]);

  const selectedReactionNames = useMemo(() => {
    if (!selectedReaction) return [];
    return getReactionUserNames(selectedReaction.users);
  }, [selectedReaction, getReactionUserNames]);

  // RoleIconWrapper moved outside component body (FIX 5)

  // Permissions — in DM mode, grant basic permissions and skip server-only features
  const { hasPermission, isOwner: currentUserIsOwner } = useMemberPermissions(isDM ? undefined : message.channel_id);
  const canPinMessages = isDM ? false : hasPermission("pin_messages");
  const canManageMessages = isDM ? false : hasPermission("manage_messages");
  const canAddReactions = isDM ? true : hasPermission("add_reactions");
  const reactionsDisabled = !isDM && currentChannel?.disable_reactions && !currentUserIsOwner && !canManageMessages;
  const effectiveCanAddReactions = canAddReactions && !reactionsDisabled;
  const canUseExternalEmojis = isDM ? true : hasPermission("use_external_emojis");
  const canEmbedLinks = isDM ? true : hasPermission("embed_links");
  const isAdmin = canManageMessages;

  // Kick/Ban permissions for avatar context menu — disabled in DM mode
  const isMessageAuthorOwner = isDM ? false : currentServer?.owner_id === message.user_id;
  const canModTarget = isDM
    ? false
    : canModerateByRoles(currentUserIsOwner, currentMember?.roles, isMessageAuthorOwner, messageRoles);
  const canKickUser = hasPermission("kick_members") && canModTarget && !isOwnMessage;
  const canBanUser = hasPermission("ban_members") && canModTarget && !isOwnMessage;
  const hasModActions = canKickUser || canBanUser;

  const isMentioned = useMemo(() => {
    if (!user?.id) return false;
    const content = message.content;
    return content.includes(`<@${user.id}>`) || content.includes("@everyone") || content.includes("@here");
  }, [user?.id, message.content]);

  const pollId = useMemo(() => getPollIdFromContent(message.content), [message.content]);
  const replyPollId = useMemo(
    () => (message.reply_to ? getPollIdFromContent(message.reply_to.content) : null),
    [message.reply_to],
  );
  const replyPollLabel = usePollLabel(replyPollId, 40);

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

  // Ghost mode - hide avatar/username for non-admin message authors (disabled in DM mode)
  const isGhostMode = isDM ? false : currentChannel?.ghost_mode || false;
  const showMessageAuthorIdentity = useMemo(
    () =>
      isDM
        ? true
        : canRevealGhostIdentityForUser({
            isGhostMode,
            authorUserId: message.user_id,
            members: membersList,
            ownerId: currentServer?.owner_id,
          }),
    [isGhostMode, message.user_id, membersList, currentServer?.owner_id],
  );
  const showGhostIdentity = isGhostMode && !showMessageAuthorIdentity;

  const replyUser = useMessageUser(message.reply_to?.user_id);
  const replyMember = useMemo(() => {
    if (isDM || !message.reply_to?.user_id) return undefined;
    return messageMemberByUserId.get(message.reply_to.user_id);
  }, [isDM, message.reply_to?.user_id, messageMemberByUserId]);
  const replyRoles = useMemo(
    () => (isDM ? [] : (replyMember?.roles ?? replyAuthorStyleFallback?.roles ?? [])),
    [isDM, replyAuthorStyleFallback?.roles, replyMember?.roles],
  );
  const replyBaseRole = isDM ? undefined : (replyMember?.role ?? replyAuthorStyleFallback?.role);

  const showReplyAuthorIdentity = useMemo(
    () =>
      canRevealGhostIdentityForUser({
        isGhostMode,
        authorUserId: message.reply_to?.user_id,
        members: membersList,
        ownerId: currentServer?.owner_id,
    }),
    [isGhostMode, message.reply_to?.user_id, membersList, currentServer?.owner_id],
  );

  const topReplyCustomRoleColor = useMemo(() => {
    if (isDM || replyRoles.length === 0) return null;

    const resolved = replyRoles.map((mr) => roles.find((r) => r.id === mr.id) ?? mr).filter(Boolean);

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
  }, [isDM, replyRoles, roles]);

  const replyUsernameColorClass = useMemo(() => {
    if (isDM) return "text-foreground";
    if (!topReplyCustomRoleColor) return getRoleColor(replyBaseRole ?? undefined);
    return isGradientColor(topReplyCustomRoleColor) ? "text-transparent" : "text-foreground";
  }, [isDM, replyBaseRole, topReplyCustomRoleColor]);

  const replyUsernameColorStyle = useMemo(() => {
    if (!topReplyCustomRoleColor) return undefined;
    return isGradientColor(topReplyCustomRoleColor)
      ? getGradientTextStyle(topReplyCustomRoleColor)
      : ({ color: topReplyCustomRoleColor } as React.CSSProperties);
  }, [topReplyCustomRoleColor]);

  const replyDisplayName = useMemo(
    () =>
      pickFirstNonBlank(
        replyMember?.nickname,
        replyAuthorStyleFallback?.nickname,
        replyUser?.display_name,
        replyUser?.username,
      ) ?? "unknown",
    [replyAuthorStyleFallback?.nickname, replyMember?.nickname, replyUser?.display_name, replyUser?.username],
  );

  // Memoize formatted timestamps
  const formattedTime = useMemo(() => {
    const timeStr = format(new Date(message.created_at), "h:mm a");
    return timeStr.replace(/\s+/, "\u00A0");
  }, [message.created_at]);

  const formattedTimestamp = useMemo(() => formatMessageTimestamp(message.created_at), [message.created_at]);

  // Client-side rate limit guards (UX defense — server enforces real limits)
  const checkReactionLimit = useRateLimit(15, 10_000);
  const checkEditLimit = useRateLimit(10, 30_000);
  const checkPinLimit = useRateLimit(5, 30_000);
  const checkDeleteLimit = useRateLimit(10, 15_000);

  // Auto-resize textarea for edit mode
  // (Inline edit textarea removed — editing now happens in MessageInput)

  // Callbacks — editing now delegates to editStore
  const handleStartEditing = useCallback(() => {
    if (!checkEditLimit()) { rateLimitToast("Editing too fast"); return; }
    const { startEditing } = useEditStore.getState();
    startEditing({
      id: message.id,
      channelId: message.channel_id || (dmActions ? "" : ""),
      content: convertMentionsToReadable(message.content, usersMap, channelsMap),
      isDM: !!dmActions,
    });
  }, [message.id, message.channel_id, message.content, dmActions, checkEditLimit, usersMap, channelsMap]);

  // For DMs, channel_id won't exist — use conversation context
  // The channelId for DMs is set via the dmActions context in DMChatArea

  const handlePin = useCallback(async () => {
    if (!user) return;
    if (!checkPinLimit()) { rateLimitToast("Pinning/unpinning too fast"); return; }
    try {
      await pinMessage(message.id, !message.is_pinned, user.id);
      toast.success(message.is_pinned ? "Message unpinned" : "Message pinned");
    } catch (error) {
      console.error("Failed to pin/unpin message:", error);
      toast.error(error instanceof Error ? error.message : "Failed to pin/unpin message");
    }
  }, [user, message.id, message.is_pinned, pinMessage, checkPinLimit]);

  // Poll-specific state and actions (for own poll messages)
  const pollIsClosed = usePollStore((s) => (pollId ? !!s.pollsById[pollId]?.is_closed : false));
  const handleEndPoll = useCallback(async () => {
    if (!pollId) return;
    const ok = await usePollStore.getState().closePoll(pollId);
    if (ok) toast.success("Poll ended");
    else toast.error("Failed to end poll");
  }, [pollId]);

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
      if (!checkReactionLimit()) { rateLimitToast("Adding reactions too fast"); return; }
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
    [user, message.id, addReaction, removeReaction, isExternalEmoji, canUseExternalEmojis, checkReactionLimit],
  );

  const handleAddReaction = useCallback(
    (emoji: string) => {
      if (!user) return;
      if (!checkReactionLimit()) { rateLimitToast("Adding reactions too fast"); return; }
      if (isExternalEmoji(emoji) && !canUseExternalEmojis) {
        toast.error("You don't have permission to use external emojis");
        return;
      }
      addReaction(message.id, user.id, emoji);
    },
    [user, message.id, addReaction, isExternalEmoji, canUseExternalEmojis, checkReactionLimit],
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

  const messageLink = useMemo(() => {
    if (typeof window === "undefined") return "";

    const origin = window.location.origin;
    if (isDM) {
      const params = new URLSearchParams();
      if (dmActions?.conversationId) params.set("conversation", dmActions.conversationId);
      params.set("message", message.id);
      return `${origin}/app/friends?${params.toString()}`;
    }

    const serverId = currentServer?.id;
    const channelId = message.channel_id || currentChannel?.id;
    if (!serverId || !channelId) return "";

    const params = new URLSearchParams({ message: message.id });
    return `${origin}/app/servers/${serverId}/channels/${channelId}?${params.toString()}`;
  }, [isDM, dmActions?.conversationId, message.id, message.channel_id, currentServer?.id, currentChannel?.id]);

  const handleCopyMessageLink = useCallback(async () => {
    if (!messageLink) {
      toast.error("Message link is unavailable");
      return;
    }

    try {
      await navigator.clipboard.writeText(messageLink);
      toast.success("Message link copied");
    } catch (error) {
      console.error("Failed to copy message link:", error);
      toast.error("Failed to copy message link");
    }
  }, [messageLink]);

  const handleShareMessage = useCallback(async () => {
    const readableContent = convertMentionsToReadable(message.content, usersMap, channelsMap);
    const shareText = messageLink ? `${readableContent}\n${messageLink}`.trim() : readableContent;

    try {
      if (navigator.share) {
        await navigator.share({
          text: readableContent || undefined,
          url: messageLink || undefined,
        });
        return;
      }

      await navigator.clipboard.writeText(shareText);
      toast.success("Message copied for sharing");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Failed to share message:", error);
      toast.error("Failed to share message");
    }
  }, [message.content, usersMap, channelsMap, messageLink]);

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

  // Unified reply handler — delegates to dmActions in DM mode
  const handleReply = useCallback(() => {
    if (isDM) {
      dmActions!.onReply(message);
    } else {
      setReplyingTo(message);
    }
  }, [isDM, dmActions, message, setReplyingTo]);

  const MESSAGE_CHAR_LIMIT = 2000;

  const messageContentUser = useMemo(() => {
    if (!messageUser) return undefined;
    return {
      id: messageUser.id,
      username: messageUser.username,
      display_name: messageUser.display_name,
    };
  }, [messageUser?.id, messageUser?.username, messageUser?.display_name]);

  // Computed class names — Discord-style spacing:
  // Non-grouped (first in group): top margin for visual group separation
  // Grouped (chained): zero extra spacing for uniform line density
  const outerClassName = useMemo(() => {
    const base = flushOuterXPadding ? "px-0" : "px-2";
    const spacing = compactMode ? "py-0" : isGrouped ? "mt-[3px]" : "mt-[10px]";
    return `${base} ${spacing}`.trim();
  }, [compactMode, flushOuterXPadding, isGrouped]);

  const isAnnouncementChannel = currentChannel?.type === "announcement";

  const innerClassName = useMemo(() => {
    const messageSpacing = compactMode
      ? "gap-2 py-0.5"
      : isAnnouncementChannel && !isGrouped
        ? "gap-3 py-3"
        : isGrouped
          ? "gap-3 py-[1px]"
          : "gap-3 py-0.5";
    const classes = [
      "group relative z-0 hover:z-10 focus-within:z-10 flex px-4 rounded-lg hover:bg-muted/40",
      messageSpacing,
    ];
    if (isAnnouncementChannel && !isGrouped) {
      classes.push("bg-primary/5 border-l-2 border-l-primary/50 ml-1");
    }
    if (isMentioned) classes.push("bg-primary/10 border-l-2 border-l-amber-500");
    if (isHighlighted) classes.push("animate-highlight-message bg-primary/20 ring-2 ring-primary/50");
    if (isPending) classes.push("opacity-70");
    return classes.join(" ");
  }, [compactMode, isMentioned, isHighlighted, isPending, isAnnouncementChannel, isGrouped]);

  const messageContentClassName = useMemo(
    () =>
      cn(
        "text-[14px] font-normal leading-[1.5] sm:leading-[1.45] font-[Inter,system-ui,sans-serif] [&>div]:flex [&>div]:items-center [&>div]:flex-wrap overflow-hidden",
        isAnnouncementChannel ? "w-full max-w-[90%] sm:max-w-none" : "max-w-[90%] sm:max-w-none",
      ),
    [isAnnouncementChannel],
  );

  const topCustomRoleColor = useMemo(() => {
    if (isDM) return null;
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
  }, [isDM, messageRoles, roles]);

  const usernameColorClass = useMemo(() => {
    if (isDM) return "text-foreground";
    if (showGhostIdentity) return "text-muted-foreground";
    if (!topCustomRoleColor) return getRoleColor(messageBaseRole ?? undefined);
    return isGradientColor(topCustomRoleColor) ? "text-transparent" : "text-foreground";
  }, [isDM, topCustomRoleColor, messageBaseRole, showGhostIdentity]);

  const usernameColorStyle = useMemo(() => {
    if (showGhostIdentity) return undefined;
    if (!topCustomRoleColor) return undefined;
    return isGradientColor(topCustomRoleColor)
      ? getGradientTextStyle(topCustomRoleColor)
      : ({ color: topCustomRoleColor } as React.CSSProperties);
  }, [topCustomRoleColor, showGhostIdentity]);

  const displayName = showGhostIdentity
    ? "Anonymous"
    : isDM
      ? (pickFirstNonBlank(messageUser?.display_name, messageUser?.username) ?? "Unknown")
      : (pickFirstNonBlank(
          messageMember?.nickname,
          effectiveAuthorStyle?.nickname,
          messageUser?.display_name,
          messageUser?.username,
        ) ?? "Unknown");
  const isBotMessageAuthor = !showGhostIdentity && Boolean(messageUser?.is_bot);

  const handleUsernameClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Don't show profile in ghost mode for non-admins
      if (showGhostIdentity || isBotMessageAuthor) return;
      if (message.user_id) {
        openUserProfileModal(openModal, message.user_id, e.currentTarget, {
          user: messageUser,
          ...SIDE_ALIGNED_USER_PROFILE_POPOVER,
        });
      }
    },
    [isBotMessageAuthor, message.user_id, messageUser, openModal, showGhostIdentity],
  );

  const handleKickUser = useCallback(() => {
    if (!messageMember) return;
    openModal("confirmAction", {
      action: "kick",
      member: messageMember,
      title: `Kick ${displayName}`,
      message: `Are you sure you want to kick ${displayName} from the server?`,
    });
  }, [messageMember, displayName, openModal]);

  const handleBanUser = useCallback(() => {
    if (!messageMember) return;
    openModal("confirmAction", {
      action: "ban",
      member: messageMember,
      title: `Ban ${displayName}`,
      message: `Are you sure you want to ban ${displayName} from the server? They will not be able to rejoin.`,
    });
  }, [messageMember, displayName, openModal]);

  const handleRowMouseEnter = useCallback(() => setIsRowHovered(true), []);
  const handleRowMouseLeave = useCallback(() => setIsRowHovered(false), []);

  // Stable callbacks for delete modal
  const handleShowDeleteModal = useCallback(() => {
    if (!checkDeleteLimit()) { rateLimitToast("Deleting too fast"); return; }
    setShowDeleteModal(true);
  }, [checkDeleteLimit]);

  // Stable touch propagation stopper
  const stopTouchPropagation = useCallback((e: React.TouchEvent) => e.stopPropagation(), []);

  // Stable reaction touch handlers
  const handleReactionTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isMobile) return;
    reactionLongPressRef.current = setTimeout(() => {
      e.preventDefault();
      setReactionDrawerOpen(true);
    }, 500);
  }, [isMobile]);

  const clearReactionLongPress = useCallback(() => {
    if (reactionLongPressRef.current) {
      clearTimeout(reactionLongPressRef.current);
      reactionLongPressRef.current = null;
    }
  }, []);

  // Stable mobile action callbacks
  const handleMobileReply = useCallback(() => {
    handleReply();
    setShowMobileActions(false);
  }, [handleReply]);

  const handleMobileEdit = useCallback(() => {
    handleStartEditing();
    setShowMobileActions(false);
  }, [handleStartEditing]);

  const handleMobilePin = useCallback(() => {
    handlePin();
    setShowMobileActions(false);
  }, [handlePin]);

  const handleMobileRemoveEmbed = useCallback(() => {
    handleRemoveEmbed();
    setShowMobileActions(false);
  }, [handleRemoveEmbed]);

  const handleMobileCopy = useCallback(() => {
    handleCopyText();
    setShowMobileActions(false);
  }, [handleCopyText]);

  const handleMobileCopyId = useCallback(() => {
    handleCopyMessageId();
    setShowMobileActions(false);
  }, [handleCopyMessageId]);

  const handleMobileDelete = useCallback(() => {
    setShowDeleteModal(true);
    setShowMobileActions(false);
  }, []);

  const handleMobileKick = useCallback(() => {
    handleKickUser();
    setShowMobileActions(false);
  }, [handleKickUser]);

  const handleMobileBan = useCallback(() => {
    handleBanUser();
    setShowMobileActions(false);
  }, [handleBanUser]);

  const handleReplyClick = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (message.reply_to?.id) {
        // Dispatch a custom event instead of using useSearchParams (which causes every MessageItem to re-render)
        window.dispatchEvent(new CustomEvent("scrollToMessage", { detail: { messageId: message.reply_to.id } }));
      }
    },
    [message.reply_to?.id],
  );

  const replyReferenceNode = message.reply_to ? (
    <button
      type="button"
      className="mb-0.5 flex max-w-full cursor-pointer items-center gap-1.5 overflow-hidden text-left text-[11px] leading-4 text-muted-foreground transition-colors duration-150 hover:text-foreground/90 sm:text-[12px]"
      onClick={handleReplyClick}
      onTouchStart={stopTouchPropagation}
      onTouchEnd={stopTouchPropagation}
    >
      <ReplyConnector />
      {showReplyAuthorIdentity && replyUser ? (
        <>
          <img src={replyUser.avatar_url || undefined} alt="" className="h-4 w-4 flex-shrink-0 rounded-full object-cover" />
          <span className={cn("flex-shrink-0 font-medium", replyUsernameColorClass)} style={replyUsernameColorStyle}>
            {replyDisplayName}
          </span>
        </>
      ) : showReplyAuthorIdentity ? (
        <span className={cn("flex-shrink-0 font-medium", replyUsernameColorClass)} style={replyUsernameColorStyle}>
          {replyDisplayName}
        </span>
      ) : (
        <span className="flex-shrink-0 font-medium italic">Anonymous</span>
      )}
      {(() => {
        const replyContent = message.reply_to.content;
        if (isPollMessageContent(replyContent)) {
          return <span className="truncate italic text-muted-foreground/90 sm:max-w-[320px] max-w-[190px]">{replyPollLabel.toLowerCase()}</span>;
        }
        if (isImageOnlyMessage(replyContent)) {
          return (
            <span className="flex flex-shrink-0 items-center gap-1 italic">
              <Paperclip className="h-3 w-3" />
              attachment
            </span>
          );
        }
        const attachmentUrlPattern =
          /https?:\/\/[^\s]*(?:supabase\.co\/storage\/v1\/|\.(?:jpg|jpeg|png|gif|webp|mp4|mov|pdf|zip|rar|doc|docx|xls|xlsx))(?:[^\s]*)/gi;
        const kloakAttachmentPattern = /kloak-attachment:\/\/[^\s]*/g;
        const textOnly = replyContent
          .split("\n")
          .map((line) => line.replace(attachmentUrlPattern, "").replace(kloakAttachmentPattern, "").trim())
          .filter((line) => line.length > 0)
          .join(" ");
        if (!textOnly) {
          return (
            <span className="flex flex-shrink-0 items-center gap-1 italic">
              <Paperclip className="h-3 w-3" />
              attachment
            </span>
          );
        }
        return (
          <span className="truncate text-muted-foreground/90 sm:max-w-[320px] max-w-[190px]">
            <ReplyPreview
              content={textOnly}
              maxLength={50}
              customEmojiMap={customEmojiMap}
              globalEmojiMap={globalEmojiMap}
            />
          </span>
        );
      })()}
    </button>
  ) : null;

  return (
    <>
      {showNewDivider && (
        <div className="flex items-center gap-2 my-3 px-4">
          <div className="flex-1 h-px bg-destructive/50" />
          <span className="text-[10px] text-destructive font-medium uppercase tracking-wider">NEW</span>
          <div className="flex-1 h-px bg-destructive/50" />
        </div>
      )}

      <div id={`message-${message.id}`} className={outerClassName}>
        {/* ContextMenu is disabled on mobile (use Drawer instead) */}
        <ContextMenu>
          <ContextMenuTrigger asChild disabled={isMobile}>
            <div
              className={innerClassName}
              onMouseEnter={handleRowMouseEnter}
              onMouseLeave={handleRowMouseLeave}
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
                        className={`text-[11px] font-[Inter,system-ui,sans-serif] text-muted-foreground/50 transition-opacity duration-150 whitespace-nowrap block ${
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
                        ) : hasModActions ? (
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <AvatarWithDecoration
                                user={messageUser}
                                className={cn(messageAvatarSizeClass, "cursor-pointer")}
                                active={isRowHovered}
                                onClick={handleUsernameClick}
                                freezeGifUntilHover
                              />
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-48 z-[60]">
                              {canKickUser && (
                                <ContextMenuItem
                                  onClick={handleKickUser}
                                  className="text-orange-400 focus:text-orange-400"
                                >
                                  <UserX className="w-4 h-4 text-destructive" />
                                  Kick {displayName}
                                </ContextMenuItem>
                              )}
                              {canBanUser && (
                                <ContextMenuItem
                                  onClick={handleBanUser}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Ban className="w-4 h-4 text-destructive" />
                                  Ban {displayName}
                                </ContextMenuItem>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        ) : (
                          <AvatarWithDecoration
                            user={messageUser}
                            className={cn(messageAvatarSizeClass, "cursor-pointer")}
                            active={isRowHovered}
                            onClick={handleUsernameClick}
                            freezeGifUntilHover
                          />
                        )
                      ) : (
                        <div className="h-full flex items-center justify-center">
                          <span className="text-[11px] font-[Inter,system-ui,sans-serif] text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                            {formattedTime}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Content */}
              <div className="flex-1 min-w-0 overflow-hidden flex flex-col gap-[2px]">
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
                            active={isRowHovered}
                            onClick={handleUsernameClick}
                            freezeGifUntilHover
                          />
                        )}
                        <span className="text-sm text-muted-foreground tracking-tight inline-flex items-center gap-1.5">
                          {isPollResult && pollIcon}
                          <MessageContent
                            content={cleanedContent}
                            currentUserId={user?.id}
                            messageId={message.id}
                            hideEmbeds={isEmbedHidden}
                            hideLinksPreview={!canEmbedLinks}
                            customEmojiMap={customEmojiMap}
                            globalEmojiMap={globalEmojiMap}
                            messageUser={messageContentUser}
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
                    {replyReferenceNode}

                    {/* Header */}
                    {compactMode ? (
                      <span className="inline font-[Inter,system-ui,sans-serif]">
                        <span
                          onClick={handleUsernameClick}
                          className={`text-[14px] font-medium leading-tight hover:underline cursor-pointer mr-1.5 ${usernameColorClass}`}
                          style={usernameColorStyle}
                        >
                          {displayName}
                        </span>
                        {isBotMessageAuthor && <BotTag className="mr-1.5" />}
                        {roleIconNode && priorityRoleWithIcon && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <RoleIconWrapper
                                className="mr-1.5 cursor-help"
                                isHovered={hoveredRoleIcon}
                                onHoverChange={setHoveredRoleIcon}
                              >
                                {roleIconNode}
                              </RoleIconWrapper>
                            </TooltipTrigger>
                            <TooltipContent>
                              {priorityRoleWithIcon.name}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {message.is_pinned && <Pin className="w-3 h-3 text-muted-foreground inline mr-1" />}
                      </span>
                    ) : (
                      !isGrouped &&
                      messageUser && (
                        <div className="flex items-center gap-1.5 font-[Inter,system-ui,sans-serif]">
                          <span
                            onClick={handleUsernameClick}
                            className={`text-[14px] font-medium leading-tight hover:underline cursor-pointer ${usernameColorClass}`}
                            style={usernameColorStyle}
                          >
                            {displayName}
                          </span>
                          {isBotMessageAuthor && <BotTag />}
                          {roleIconNode && priorityRoleWithIcon && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <RoleIconWrapper
                                  className="cursor-help"
                                  isHovered={hoveredRoleIcon}
                                  onHoverChange={setHoveredRoleIcon}
                                >
                                  {roleIconNode}
                                </RoleIconWrapper>
                              </TooltipTrigger>
                              <TooltipContent>
                                {priorityRoleWithIcon.name}
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {showTimestamps && (
                            <span className="text-[12px] text-muted-foreground/60 leading-none">
                              {formattedTimestamp}
                            </span>
                          )}
                          {message.is_pinned && <Pin className="w-3 h-3 text-muted-foreground" />}
                        </div>
                      )
                    )}

                    {/* Message content */}
                    {pollId ? (
                      <div className="mt-1 max-w-[520px]">
                        <PollMessage pollId={pollId} />
                      </div>
                    ) : (
                      <div className={messageContentClassName}>
                        {currentChannel?.type === "announcement" ? (
                          (() => {
                            // Only show title+body split when there's an explicit double-newline separator
                            const content = displayContent || "";
                            const doubleNewlineIdx = content.indexOf("\n\n");
                            const hasTitle = doubleNewlineIdx > 0;
                            const title = hasTitle ? content.slice(0, doubleNewlineIdx).trim() : "";
                            const announcementContent = hasTitle ? content.slice(doubleNewlineIdx + 2).trim() : content;

                            return (
                              <div className="space-y-2 !block">
                                {title && <h3 className="text-lg font-semibold text-foreground">{title}</h3>}
                                {announcementContent && (
                                  <MessageContent
                                    content={announcementContent}
                                    currentUserId={user?.id}
                                    messageId={message.id}
                                    hideEmbeds={isEmbedHidden}
                                    hideLinksPreview={!canEmbedLinks}
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
                            content={displayContent}
                            currentUserId={user?.id}
                            messageId={message.id}
                            hideEmbeds={isEmbedHidden}
                            hideLinksPreview={!canEmbedLinks}
                            customEmojiMap={customEmojiMap}
                            globalEmojiMap={globalEmojiMap}
                            messageUser={messageContentUser}
                          />
                        )}
                      </div>
                    )}

                    {/* Edited indicator */}
                    {message.edited_at && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[10px] text-muted-foreground cursor-help ml-1">(edited)</span>
                        </TooltipTrigger>
                        <TooltipContent>
                          {new Date(message.edited_at).toLocaleString()}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Attachments - skip for system messages */}
                    {!message.is_system_message && message.attachments && message.attachments.length > 0 && (() => {
                      const images = message.attachments.filter((a) => a.file_type?.startsWith("image/") && !a.is_spoiler);
                      const others = message.attachments.filter((a) => !(a.file_type?.startsWith("image/") && !a.is_spoiler));
                      const useGallery = images.length >= 2 && images.length <= 4;
                      return (
                        <div className="flex flex-col gap-2 mt-2 w-full">
                          {useGallery && (
                            <AttachmentGallery
                              attachments={images}
                              renderCell={(a) => (
                                <AttachmentItem
                                  attachment={a}
                                  onImageClick={setAttachmentLightboxUrl}
                                  uploaderName={displayName}
                                  layout="fill"
                                />
                              )}
                            />
                          )}
                          {(!useGallery || others.length > 0) && (
                            <div className="flex flex-wrap gap-2 w-full">
                              {(useGallery ? others : message.attachments).map((attachment) => (
                                <AttachmentItem
                                  key={attachment.id}
                                  attachment={attachment}
                                  onImageClick={setAttachmentLightboxUrl}
                                  uploaderName={displayName}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                  </>
                )}
              </div>

              {/* Hover actions - Desktop only - skip for system messages */}
              {!isBeingEdited && !message.is_system_message && (
                <div
                  className={cn(
                    "absolute right-2 -top-4 z-20 hidden md:flex items-center gap-0.5 rounded-md border border-[hsl(var(--menu-border))] bg-[hsl(var(--menu))] p-0.5 text-[hsl(var(--menu-foreground))] shadow-xl shadow-black/30 transition-opacity duration-100",
                    showMoreMenu || showDesktopEmojiPicker || isRowHovered
                      ? "md:opacity-100"
                      : "md:opacity-0",
                  )}
                >
                  {effectiveCanAddReactions &&
                    !isBlockedUser &&
                    topEmojis.map((emoji) => (
                      <button
                        key={`quick-${emoji}`}
                         className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent transition-colors hover:bg-[hsl(var(--menu-hover))]"
                        onClick={() => handleAddReaction(emoji)}
                        aria-label={`React with ${emoji}`}
                        title={`React with ${emoji}`}
                      >
                        <FluentEmoji emoji={emoji} size={18} />
                      </button>
                    ))}
                  {/* Reactions - Desktop */}
                  {effectiveCanAddReactions && !isBlockedUser && (
                    <EmojiPicker
                      open={showDesktopEmojiPicker}
                      onOpenChange={setShowDesktopEmojiPicker}
                      onEmojiSelect={handleDesktopAddReaction}
                      serverId={currentServer?.id}
                    >
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-[hsl(var(--menu-foreground))]/70 transition-colors hover:bg-[hsl(var(--menu-hover))] hover:text-[hsl(var(--menu-foreground))]"
                        aria-label="Add reaction"
                        title="Add reaction"
                      >
                        <Smile className="w-4 h-4" />
                      </button>
                    </EmojiPicker>
                  )}
                  {effectiveCanAddReactions && !isBlockedUser && (
                    <div className="mx-0.5 h-4 w-px bg-[hsl(var(--menu-separator))]" aria-hidden="true" />
                  )}

                  {/* Reply - Hide for blocked users */}
                  {!isBlockedUser && (
                    <button
                       className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-[hsl(var(--menu-foreground))]/70 transition-colors hover:bg-[hsl(var(--menu-hover))] hover:text-[hsl(var(--menu-foreground))]"
                      onClick={handleReply}
                      aria-label="Reply"
                      title="Reply"
                    >
                      <Reply className="w-4 h-4" />
                    </button>
                  )}

                  {/* Delete */}
                  {(isOwnMessage || isAdmin) && (
                    <button
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-destructive transition-colors hover:bg-destructive/10"
                      onClick={handleShowDeleteModal}
                      aria-label="Delete"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </button>
                  )}

                  {/* More menu */}
                  <DropdownMenu
                    open={showMoreMenu}
                    onOpenChange={(open) => {
                      setShowMoreMenu(open);
                      if (!open) {
                        setIsRowHovered(false);
                      }
                    }}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                       className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-[hsl(var(--menu-foreground))]/70 transition-colors hover:bg-[hsl(var(--menu-hover))] hover:text-[hsl(var(--menu-foreground))]"
                        aria-label="More actions"
                        title="More"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[190px] overflow-hidden rounded-md p-0">
                      {isOwnMessage && !pollId && (
                        <DropdownMenuItem onClick={handleStartEditing} className="rounded-none px-3 py-2">
                          <Pencil className="h-4 w-4 shrink-0 mr-2" />
                          Edit
                        </DropdownMenuItem>
                      )}
                      {isOwnMessage && pollId && !pollIsClosed && (
                        <DropdownMenuItem onClick={handleEndPoll} className="rounded-none px-3 py-2">
                          <Pencil className="h-4 w-4 shrink-0 mr-2" />
                          End poll
                        </DropdownMenuItem>
                      )}
                      {isOwnMessage && <DropdownMenuSeparator className="mx-0 my-0" />}
                      <DropdownMenuItem onClick={handleShareMessage} className="rounded-none px-3 py-2">
                        <Share2 className="h-4 w-4 shrink-0 mr-2" />
                        Share message
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="mx-0 my-0" />
                      <DropdownMenuItem onClick={handleCopyMessageLink} className="rounded-none px-3 py-2">
                        <Link2 className="h-4 w-4 shrink-0 mr-2" />
                        Copy link
                      </DropdownMenuItem>
                      {canPinMessages && <DropdownMenuSeparator className="mx-0 my-0" />}
                      {canPinMessages && (
                        <DropdownMenuItem onClick={handlePin} className="rounded-none px-3 py-2">
                          <Pin className="h-4 w-4 shrink-0 mr-2" />
                          {message.is_pinned ? "Unpin message" : "Pin message"}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent className="w-56">
            {!isBlockedUser && (
              <ContextMenuItem onClick={handleReply}>
                <Reply className="w-4 h-4" />
                Reply
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={handleCopyText}>
              <Copy className="w-4 h-4" />
              Copy Text
            </ContextMenuItem>
            {isOwnMessage && !pollId && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleStartEditing}>
                  <Pencil className="w-4 h-4" />
                  Edit Message
                </ContextMenuItem>
              </>
            )}
            {isOwnMessage && pollId && !pollIsClosed && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleEndPoll}>
                  <Pencil className="w-4 h-4" />
                  End Poll
                </ContextMenuItem>
              </>
            )}
            {canPinMessages && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handlePin}>
                  <Pin className="w-4 h-4" />
                  {message.is_pinned ? "Unpin Message" : "Pin Message"}
                </ContextMenuItem>
              </>
            )}
            {isOwnMessage && hasEmbeddableUrls && !isEmbedHidden && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleRemoveEmbed}>
                  <EyeOff className="w-4 h-4" />
                  Remove Embed
                </ContextMenuItem>
              </>
            )}
            {(isOwnMessage || isAdmin) && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={handleShowDeleteModal}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                  {pollId ? "Delete Poll" : "Delete Message"}
                </ContextMenuItem>
              </>
            )}
            {hasModActions && (
              <>
                <ContextMenuSeparator />
                {canKickUser && (
                  <ContextMenuItem onClick={handleKickUser}>
                    <UserX className="w-4 h-4 text-destructive" />
                    Kick {displayName}
                  </ContextMenuItem>
                )}
                {canBanUser && (
                  <ContextMenuItem onClick={handleBanUser}>
                    <Ban className="w-4 h-4 text-destructive" />
                    Ban {displayName}
                  </ContextMenuItem>
                )}
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>

        {/* Reactions - rendered outside ContextMenu to avoid interfering with message actions */}
        {!message.is_system_message && message.reactions && message.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap items-center gap-1.5 px-4", compactMode ? "pl-4" : "pl-[68px]")}>
            {message.reactions.map((reaction) => (
              <HoverCard
                key={reaction.emoji}
                openDelay={200}
                onOpenChange={(open) => {
                  if (open && !isGhostMode) {
                    ensureReactionUserNames(reaction.users);
                  }
                }}
              >
                <HoverCardTrigger asChild>
                  <span className="inline-flex">
                    <button
                      onClick={() =>
                        effectiveCanAddReactions && handleReactionClick(reaction.emoji, reaction.hasReacted)
                      }
                      onTouchStart={handleReactionTouchStart}
                      onTouchEnd={clearReactionLongPress}
                      onTouchMove={clearReactionLongPress}
                      disabled={!effectiveCanAddReactions}
                        className={cn(
                        "inline-flex h-7 items-center gap-1 rounded-full border px-2 py-0 transition-colors duration-150",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                        reaction.hasReacted
                          ? "border-primary/40 bg-primary/15 text-foreground hover:bg-primary/20"
                          : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground",
                        !effectiveCanAddReactions && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      {reactionEmojiNode(reaction.emoji)}
                      <span className={cn("text-[11px] leading-none", reaction.hasReacted ? "font-semibold text-foreground" : "font-normal text-muted-foreground")}>
                        {reaction.count}
                      </span>
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
            {/* Ghost emoji suggestions appended after existing reactions */}
            {effectiveCanAddReactions && !isBlockedUser && (
              <div className="hidden md:flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                {["👍", "❤️", "🔥"].map((emoji) => {
                  const alreadyReacted = message.reactions?.some((r) => r.emoji === emoji);
                  if (alreadyReacted) return null;
                  return (
                    <button
                      key={`ghost-${emoji}`}
                      onClick={() => handleReactionClick(emoji, false)}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-border/70 px-2 py-1 bg-background/40 cursor-pointer opacity-50 hover:opacity-100 hover:bg-muted/45 hover:border-border transition-all duration-150 text-muted-foreground"
                    >
                      {reactionEmojiNode(emoji)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile action drawer */}
      <Drawer open={showMobileActions} onOpenChange={setShowMobileActions}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="text-sm font-medium text-muted-foreground">Message Actions</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            {/* Quick reactions row - horizontally scrollable */}
            {effectiveCanAddReactions && !isBlockedUser && (
              <div className="mb-4 rounded-xl bg-muted/50 overflow-hidden">
                <div className="flex items-center gap-1.5 p-2 overflow-x-auto scrollbar-hide">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleMobileAddReaction(emoji)}
                      className="p-2.5 hover:bg-secondary/40 active:bg-secondary/60 rounded-xl transition-all flex-shrink-0"
                    >
                      <FluentEmoji emoji={emoji} size={28} />
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
                      className="p-2.5 rounded-xl bg-secondary/60 hover:bg-secondary/40 transition-colors flex-shrink-0"
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
              {!isBlockedUser && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 text-left transition-colors"
                  onClick={handleMobileReply}
                >
                  <Reply className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Reply</span>
                </button>
              )}
              {/* Edit (own messages) */}
              {isOwnMessage && !pollId && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 text-left transition-colors"
                  onClick={handleMobileEdit}
                >
                  <Pencil className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Edit</span>
                </button>
              )}
              {/* End poll (own poll messages) */}
              {isOwnMessage && pollId && !pollIsClosed && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 text-left transition-colors"
                  onClick={() => { handleEndPoll(); setShowMobileActions(false); }}
                >
                  <Pencil className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">End poll</span>
                </button>
              )}

              {/* Pin */}
              {canPinMessages && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 text-left transition-colors"
                  onClick={handleMobilePin}
                >
                  <Pin className={cn("w-5 h-5", message.is_pinned ? "text-primary" : "text-muted-foreground")} />
                  <span className="font-medium">{message.is_pinned ? "Unpin Message" : "Pin Message"}</span>
                </button>
              )}

              {/* Remove Embed */}
              {isOwnMessage && hasEmbeddableUrls && !isEmbedHidden && (
                <button
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 text-left transition-colors"
                  onClick={handleMobileRemoveEmbed}
                >
                  <EyeOff className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Remove Embed</span>
                </button>
              )}

              <div className="my-2 h-px bg-border" />

              {/* Copy Text */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 text-left transition-colors"
                onClick={handleMobileCopy}
              >
                <Copy className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Copy Text</span>
              </button>

              {/* Copy Message ID */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 text-left transition-colors"
                onClick={handleMobileCopyId}
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
                    onClick={handleMobileDelete}
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="font-medium">{pollId ? "Delete Poll" : "Delete Message"}</span>
                  </button>
                </>
              )}

              {/* Kick / Ban */}
              {hasModActions && (
                <>
                  <div className="my-2 h-px bg-border" />
                  {canKickUser && (
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-orange-500/10 active:bg-orange-500/10 text-left text-orange-400 transition-colors"
                      onClick={handleMobileKick}
                    >
                      <UserX className="w-5 h-5" />
                      <span className="font-medium">Kick {displayName}</span>
                    </button>
                  )}
                  {canBanUser && (
                    <button
                      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-destructive/10 active:bg-destructive/10 text-left text-destructive transition-colors"
                      onClick={handleMobileBan}
                    >
                      <Ban className="w-5 h-5" />
                      <span className="font-medium">Ban {displayName}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Reaction details drawer (mobile long-press) */}
      <Drawer open={reactionDrawerOpen} onOpenChange={setReactionDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>Reactions</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 overflow-y-auto space-y-4">
            {/* Tap-to-toggle reaction row */}
            {effectiveCanAddReactions && !isBlockedUser && (
              <div className="flex flex-wrap gap-2">
                {(message.reactions ?? []).map((reaction) => (
                  <button
                    key={`drawer-toggle-${reaction.emoji}`}
                    onClick={() => {
                      handleReactionClick(reaction.emoji, reaction.hasReacted);
                    }}
                    className={`flex items-center gap-1 bg-transparent border-none cursor-pointer transition-opacity duration-150 ${
                      reaction.hasReacted ? "text-foreground opacity-100" : "text-muted-foreground opacity-60"
                    }`}
                  >
                    {reactionEmojiNode(reaction.emoji)}
                    <span className="text-sm font-medium">{reaction.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Who reacted list */}
            {(message.reactions ?? []).map((reaction) => {
              const names = isGhostMode ? [] : getReactionUserNames(reaction.users);
              return (
                <div key={`drawer-details-${reaction.emoji}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    {reactionEmojiNodeLarge(reaction.emoji)}
                    <span className="text-sm font-semibold text-foreground">{reaction.count}</span>
                  </div>
                  {isGhostMode ? (
                    <p className="text-sm text-muted-foreground pl-10">
                      {reaction.count} {reaction.count === 1 ? "person" : "people"} reacted
                    </p>
                  ) : (
                    <div className="pl-10 space-y-1">
                      {names.map((name, idx) => (
                        <p key={`${reaction.emoji}-user-${idx}`} className="text-sm text-foreground">
                          {name}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Delete confirmation modal */}
      <DeleteMessageModal
        message={showDeleteModal ? message : null}
        onClose={() => setShowDeleteModal(false)}
        customDeleteHandler={isDM ? dmActions?.deleteMessage : undefined}
      />

      {/* Attachment image lightbox */}
      <ImageLightbox imageUrl={attachmentLightboxUrl} onClose={() => setAttachmentLightboxUrl(null)} />

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
}, (prev, next) => {
  return (
    prev.message === next.message &&
    prev.isGrouped === next.isGrouped &&
    prev.showNewDivider === next.showNewDivider &&
    prev.isHighlighted === next.isHighlighted &&
    prev.customEmojiMap === next.customEmojiMap &&
    prev.globalEmojiMap === next.globalEmojiMap &&
    prev.authorStyleFallback === next.authorStyleFallback &&
    prev.replyAuthorStyleFallback === next.replyAuthorStyleFallback &&
    prev.dmActions === next.dmActions &&
    prev.flushOuterXPadding === next.flushOuterXPadding &&
    prev.onStartEdit === next.onStartEdit
  );
});
