import { useState, useEffect, useCallback, useRef, useMemo, type CSSProperties } from "react";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { useSignedUrl } from "@/hooks/useSignedUrl";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useTyping } from "@/hooks/useTyping";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthorStyles } from "@/hooks/useAuthorStyles";
import { useUnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import {
  MessageSquare,
  Hash,
  ArrowRight,
  Clock,
  Send,
  Loader2,
  X,
  ArrowUp,
  Paperclip,
  Reply,
  Smile,
  Pencil,
  Trash2,
  CornerUpLeft,
  ArrowLeft,
  Users,
  Layers,
  Plus,
  Pin,
  Lock,
  LockOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormatToolbar, FORMAT_SYNTAX } from "@/components/chat/FormatToolbar";
import { AttachmentPreviewBar, type PendingAttachment } from "@/components/chat/AttachmentPreviewBar";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { DeleteMessageModal } from "@/components/modals/DeleteMessageModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload } from "@/lib/storageUpload";
import { handleError, showSuccess, showWarning } from "@/lib/errorHandler";
import { formatMessageTimestamp } from "@/lib/format";
import { formatDistanceToNow } from "date-fns";
import { isImageOnlyMessage } from "@/lib/message";
import { isPollMessageContent } from "@/lib/poll";
import { MessageContent, ReplyPreview } from "@/components/chat/MessageContent";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { encodeCustomEmojisForTransport } from "@/lib/globalEmojiResolver";
import { getUserFromCache, getOrFetchUser, useMessageUser, bulkSetUsersInCache } from "@/stores/userCacheStore";
import { cn, pickFirstNonBlank } from "@/lib/utils";
import type { Message, User, ReactionGroup, CustomServerRole, ServerMember, ServerRole } from "@/types";
import { openUserProfileModal, SIDE_ALIGNED_USER_PROFILE_POPOVER } from "@/lib/userProfilePopover";

interface Thread {
  id: string;
  message_id: string;
  channel_id: string;
  created_by: string;
  created_at: string;
  is_pinned: boolean;
  is_closed: boolean;
  message?: Message;
  message_count?: number;
  last_activity?: string;
  last_message_author?: User;
}

type BroadcastMutationOp = "INSERT" | "UPDATE" | "DELETE";
type ForumBroadcastRow = {
  id?: string;
  channel_id?: string;
  thread_id?: string;
  message_id?: string;
};
type BroadcastMutationPayload<T> = {
  op?: BroadcastMutationOp;
  new?: T;
  old?: T;
};

const MIN_REPLY_TEXTAREA_HEIGHT = 40;
const MAX_REPLY_TEXTAREA_HEIGHT = 160;
type ForumImageUploadTarget = "create" | "reply";
const FORUM_COMPOSER_MAX_ATTACHMENTS = 10;

const ROLE_COLORS: Record<ServerRole, string> = {
  owner: "text-yellow-400",
  admin: "text-red-400",
  moderator: "text-blue-400",
  member: "text-foreground",
};

const getRoleColorClass = (role?: ServerRole | null): string => {
  return role ? ROLE_COLORS[role] || "text-foreground" : "text-foreground";
};

const isGradientColor = (value?: string | null) => !!value && value.startsWith("linear-gradient");
const getGradientTextStyle = (gradient: string): CSSProperties =>
  ({
    background: gradient,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    color: "transparent",
    display: "inline-block",
  }) as CSSProperties;
const forumMetaChipClass =
  "inline-flex items-center gap-1.5 text-[13px] text-muted-foreground";

const sortThreads = (threadList: Thread[]) =>
  [...threadList].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const aTime = new Date(a.last_activity ?? a.created_at).getTime();
    const bTime = new Date(b.last_activity ?? b.created_at).getTime();
    return bTime - aTime;
  });

const parseThreadMessageContent = (content: string) => {
  const trimmed = content.trim();
  const parts = trimmed.split("\n\n");
  const title = (parts.length > 1 ? parts[0] : trimmed.split("\n")[0] || "").trim();
  const description =
    parts.length > 1 ? parts.slice(1).join("\n\n").trim() : trimmed.split("\n").slice(1).join("\n").trim();
  return { title, description };
};

const revokeAttachmentPreviews = (attachments: PendingAttachment[]) => {
  attachments.forEach((attachment) => URL.revokeObjectURL(attachment.preview));
};

const ForumThreadThumbnail = ({ attachmentPath }: { attachmentPath: string }) => {
  const signedUrl = useSignedUrl(`kloak-attachment://${attachmentPath}`);
  if (!signedUrl) return null;
  return (
    <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-md overflow-hidden bg-muted">
      <img src={signedUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
    </div>
  );
};

const ThreadAttachmentGalleryItem = ({ path, onClick }: { path: string; onClick: (url: string) => void }) => {
  const signedUrl = useSignedUrl(`kloak-attachment://${path}`);
  if (!signedUrl) return <div className="w-20 h-20 rounded-md bg-muted animate-pulse" />;
  return (
    <button type="button" onClick={() => onClick(signedUrl)} className="block">
      <img
        src={signedUrl}
        alt=""
        className="w-20 h-20 rounded-md object-cover border border-border/60 hover:opacity-80 transition-opacity cursor-pointer"
        loading="lazy"
      />
    </button>
  );
};

const ThreadAttachmentGallery = ({ content }: { content: string }) => {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const matches = content.match(/kloak-attachment:\/\/([^\s]+)/g);
  if (!matches || matches.length === 0) return null;
  const paths = matches.map((m) => m.replace("kloak-attachment://", ""));
  return (
    <>
      <div className="rounded-lg border border-border bg-muted/20 p-3">
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground font-medium">
          <Paperclip className="h-3.5 w-3.5" />
          <span>Attachments ({paths.length})</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {paths.map((path, i) => (
            <ThreadAttachmentGalleryItem key={i} path={path} onClick={setLightboxUrl} />
          ))}
        </div>
      </div>
      <ImageLightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </>
  );
};
const ForumThreadsSkeleton = () => (
  <div className="divide-y divide-border">
    {Array.from({ length: 6 }).map((_, index) => (
      <div key={index} className="p-3 md:p-4">
        <Skeleton className="mb-2 h-5 w-2/3 md:w-1/3" />
        <Skeleton className="mb-1 h-4 w-full" />
        <Skeleton className="mb-3 h-4 w-5/6" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-28 rounded-sm" />
          <Skeleton className="h-6 w-24 rounded-sm" />
          <Skeleton className="h-6 w-32 rounded-sm" />
        </div>
      </div>
    ))}
  </div>
);

interface ForumChannelAreaProps {
  showHeader?: boolean;
}

export const ForumChannelArea = ({ showHeader = true }: ForumChannelAreaProps) => {
  const { currentChannel, currentServer, members, roles } = useServerStore();
  const { user } = useAuthStore();
  const { sendMessage } = useMessageStore();
  const { setMobileSidebarOpen, setMemberSidebarOpen, openModal } = useUIStore();
  const { markAsRead } = useUnreadChannelsContext();
  const { typingUsers, startTyping, stopTyping } = useTyping(currentChannel?.id || null);
  const isMobile = useIsMobile();
  const { hasPermission } = useMemberPermissions(currentChannel?.id);
  const canManageMessages = hasPermission("manage_messages");

  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Record<string, Message[]>>({});
  const [isCreatingThread, setIsCreatingThread] = useState(false);
  const [newThreadTitle, setNewThreadTitle] = useState("");
  const [newThreadContent, setNewThreadContent] = useState("");
  const [replyingToThread, setReplyingToThread] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [threadComposerFocused, setThreadComposerFocused] = useState(false);
  const [threadComposerEmojiOpen, setThreadComposerEmojiOpen] = useState(false);
  const [isCreateTopicFocused, setIsCreateTopicFocused] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [imageUploadTarget, setImageUploadTarget] = useState<ForumImageUploadTarget>("create");
  const [createPendingAttachments, setCreatePendingAttachments] = useState<PendingAttachment[]>([]);
  const [replyPendingAttachments, setReplyPendingAttachments] = useState<PendingAttachment[]>([]);
  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [isEditingThreadPost, setIsEditingThreadPost] = useState(false);
  const [threadPostEditTitle, setThreadPostEditTitle] = useState("");
  const [threadPostEditBody, setThreadPostEditBody] = useState("");
  const [isSavingThreadPostEdit, setIsSavingThreadPostEdit] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [showDeleteThreadModal, setShowDeleteThreadModal] = useState(false);
  const [threadToDelete, setThreadToDelete] = useState<Thread | null>(null);
  const [reactionUserNameOverrides, setReactionUserNameOverrides] = useState<Map<string, string>>(new Map());
  const createTopicTitleRef = useRef<HTMLInputElement>(null);
  const createTopicTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const threadPostTitleInputRef = useRef<HTMLInputElement>(null);
  const forumAttachmentInputRef = useRef<HTMLInputElement>(null);
  const createPendingAttachmentsRef = useRef<PendingAttachment[]>([]);
  const replyPendingAttachmentsRef = useRef<PendingAttachment[]>([]);

  // Use ref to track current thread ID for realtime subscription
  const selectedThreadIdRef = useRef<string | null>(null);
  const threadMessagesRef = useRef<Record<string, Message[]>>({});

  // Reset thread selection when channel changes
  useEffect(() => {
    setSelectedThreadId(null);
    setReplyContent("");
    setReplyingToThread(null);
    setEditingMessageId(null);
    setEditContent("");
    setIsEditingThreadPost(false);
    setThreadPostEditTitle("");
    setThreadPostEditBody("");
    setCreatePendingAttachments((prev) => {
      revokeAttachmentPreviews(prev);
      return [];
    });
    setReplyPendingAttachments((prev) => {
      revokeAttachmentPreviews(prev);
      return [];
    });
  }, [currentChannel?.id]);

  useEffect(() => {
    setIsEditingThreadPost(false);
    setThreadPostEditTitle("");
    setThreadPostEditBody("");
  }, [selectedThreadId]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    threadMessagesRef.current = threadMessages;
  }, [threadMessages]);

  useEffect(() => {
    createPendingAttachmentsRef.current = createPendingAttachments;
  }, [createPendingAttachments]);

  useEffect(() => {
    replyPendingAttachmentsRef.current = replyPendingAttachments;
  }, [replyPendingAttachments]);

  useEffect(() => {
    return () => {
      revokeAttachmentPreviews(createPendingAttachmentsRef.current);
      revokeAttachmentPreviews(replyPendingAttachmentsRef.current);
    };
  }, []);

  const swipeRef = useSwipeGestureRef({
    onSwipeRight: () => setMobileSidebarOpen(true),
    onSwipeLeft: () => setMemberSidebarOpen(true),
    threshold: 50,
    enabled: isMobile,
  });

  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const fetchThreadsInFlightRef = useRef<Promise<void> | null>(null);

  const membersByUserId = useMemo(() => {
    const map = new Map<string, ServerMember>();
    members.forEach((member) => {
      map.set(member.user_id, member);
    });
    return map;
  }, [members]);

  const rolesById = useMemo(() => {
    const map = new Map<string, CustomServerRole>();
    roles.forEach((role) => {
      map.set(role.id, role);
    });
    return map;
  }, [roles]);

  const authorStyleTargetIds = useMemo(() => {
    const ids = new Set<string>();
    for (const thread of threads) {
      if (thread.created_by) ids.add(thread.created_by);
      if (thread.message?.user_id) ids.add(thread.message.user_id);
      // user objects no longer on messages — user_id is sufficient
      if (thread.last_message_author?.id) ids.add(thread.last_message_author.id);
    }
    Object.values(threadMessages).forEach((messages) => {
      messages.forEach((msg) => {
        if (msg.user_id) ids.add(msg.user_id);
        // user objects no longer on messages
      });
    });
    return Array.from(ids);
  }, [threads, threadMessages]);

  const authorStyles = useAuthorStyles(currentChannel?.server_id ?? currentServer?.id, authorStyleTargetIds);

  const getDisplayName = useCallback(
    (userId?: string | null, _messageUser?: User | null) => {
      if (!userId) return "Unknown";
      const member = membersByUserId.get(userId);
      const fallback = authorStyles[userId];
      const cached = getUserFromCache(userId);
      return pickFirstNonBlank(
        member?.nickname ||
        fallback?.nickname,
        cached?.display_name,
        cached?.username,
        _messageUser?.display_name,
        _messageUser?.username,
      ) ?? "Unknown";
    },
    [membersByUserId, authorStyles],
  );

  const getUsernameColor = useCallback(
    (userId?: string | null): { className: string; style?: CSSProperties; isGradient?: boolean } => {
      if (!userId) return { className: "text-foreground", isGradient: false };

      const member = membersByUserId.get(userId);
      const fallback = authorStyles[userId];
      const memberRoles = member?.roles ?? fallback?.roles ?? [];
      let topCustomRole: CustomServerRole | null = null;

      for (const roleRef of memberRoles) {
        const resolvedRole = rolesById.get(roleRef.id) ?? roleRef;
        if (!topCustomRole) {
          topCustomRole = resolvedRole;
          continue;
        }

        const aPos = typeof resolvedRole.position === "number" ? resolvedRole.position : Number.POSITIVE_INFINITY;
        const bPos = typeof topCustomRole.position === "number" ? topCustomRole.position : Number.POSITIVE_INFINITY;
        if (aPos < bPos) topCustomRole = resolvedRole;
      }

      if (topCustomRole?.color) {
        if (isGradientColor(topCustomRole.color)) {
          return {
            className: "text-transparent",
            style: getGradientTextStyle(topCustomRole.color),
            isGradient: true,
          };
        }

        return {
          className: "text-foreground",
          style: { color: topCustomRole.color },
          isGradient: false,
        };
      }

      return { className: getRoleColorClass(member?.role ?? fallback?.role), isGradient: false };
    },
    [membersByUserId, rolesById, authorStyles],
  );

  useEffect(() => {
    let cancelled = false;
    const unresolvedUserIds = new Set<string>();

    Object.values(threadMessages).forEach((messages) => {
      messages.forEach((msg) => {
        (msg.reactions || []).forEach((reaction) => {
          reaction.users.forEach((reactorId) => {
            if (!reactorId || reactorId === user?.id || reactorId.startsWith("ghost_")) return;
            if (reactionUserNameOverrides.has(reactorId)) return;

            const member = membersByUserId.get(reactorId);
            if (member?.nickname || member?.user?.display_name || member?.user?.username) return;

            const existingFromMessages = messages.find((m) => m.user_id === reactorId || m.user?.id === reactorId);
            if (existingFromMessages?.user?.display_name || existingFromMessages?.user?.username) return;

            const cached = getUserFromCache(reactorId);
            const cachedName = cached?.display_name ?? cached?.username ?? null;
            if (cachedName) {
              setReactionUserNameOverrides((prev) => {
                if (prev.get(reactorId) === cachedName) return prev;
                const next = new Map(prev);
                next.set(reactorId, cachedName);
                return next;
              });
              return;
            }

            unresolvedUserIds.add(reactorId);
          });
        });
      });
    });

    unresolvedUserIds.forEach((reactorId) => {
      void getOrFetchUser(reactorId)
        .then((fetched) => {
          if (cancelled || !fetched) return;
          const displayName = fetched.display_name ?? fetched.username;
          if (!displayName) return;
          setReactionUserNameOverrides((prev) => {
            if (prev.get(reactorId) === displayName) return prev;
            const next = new Map(prev);
            next.set(reactorId, displayName);
            return next;
          });
        })
        .catch(() => undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [membersByUserId, reactionUserNameOverrides, threadMessages, user?.id]);

  const getReactionDisplayName = useCallback(
    (reactorId: string) => {
      if (reactorId === user?.id) return "You";

      const member = membersByUserId.get(reactorId);
      if (member) return member.nickname || member.user?.display_name || member.user?.username || reactorId;

      const overrideName = reactionUserNameOverrides.get(reactorId);
      if (overrideName) return overrideName;

      const cached = getUserFromCache(reactorId);
      if (cached) return cached.display_name ?? cached.username ?? reactorId;

      // User data no longer on messages — cache lookup above covers it

      return reactorId;
    },
    [membersByUserId, reactionUserNameOverrides, threadMessages, user?.id],
  );

  // Load server emojis for custom emoji rendering
  useEffect(() => {
    if (!currentServer?.id) return;

    let cancelled = false;
    (async () => {
      try {
        const emojis = await fetchServerEmojis(currentServer.id);
        if (!cancelled) {
          const map = new Map<string, string>();
          emojis.forEach((emoji) => {
            map.set(emoji.name, emoji.url);
          });
          setCustomEmojiMap(map);
        }
      } catch (error) {
        if (!cancelled) {
          setCustomEmojiMap(new Map());
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentServer?.id]);

  // Helper to render emoji (custom or unicode)
  const reactionEmojiNode = useCallback(
    (emoji: string) => {
      const match = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
      if (match) {
        const url = customEmojiMap.get(match[1]);
        if (url) {
          return <img src={url} alt={emoji} className="w-6 h-6 object-contain" loading="lazy" />;
        }
      }
      return <FluentEmoji emoji={emoji} size={24} />;
    },
    [customEmojiMap],
  );

  const resizeReplyComposer = useCallback(() => {
    const el = replyTextareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_REPLY_TEXTAREA_HEIGHT), MAX_REPLY_TEXTAREA_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    resizeReplyComposer();
  }, [replyContent, resizeReplyComposer]);

  const insertIntoReplyComposer = useCallback((text: string) => {
    const el = replyTextareaRef.current;
    if (!el) {
      setReplyContent((prev) => prev + text);
      return;
    }

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    setReplyContent((prev) => {
      const next = prev.slice(0, start) + text + prev.slice(end);
      return next;
    });

    requestAnimationFrame(() => {
      const pos = start + text.length;
      el.focus();
      el.setSelectionRange(pos, pos);
      resizeReplyComposer();
    });
  }, [resizeReplyComposer]);

  const addPendingAttachment = useCallback(
    (target: ForumImageUploadTarget, file: File) => {
      const appendAttachment = (prev: PendingAttachment[]) => {
        if (prev.length >= FORUM_COMPOSER_MAX_ATTACHMENTS) {
          showWarning("Attachment limit reached", `Maximum ${FORUM_COMPOSER_MAX_ATTACHMENTS} images per message.`);
          return prev;
        }
        return [...prev, { file, preview: URL.createObjectURL(file) }];
      };

      if (target === "reply") {
        setReplyPendingAttachments(appendAttachment);
      } else {
        setCreatePendingAttachments(appendAttachment);
      }
    },
    [],
  );

  const openAttachmentPicker = useCallback((target: ForumImageUploadTarget) => {
    setImageUploadTarget(target);
    forumAttachmentInputRef.current?.click();
  }, []);

  const clearPendingAttachments = useCallback((target: ForumImageUploadTarget) => {
    if (target === "reply") {
      setReplyPendingAttachments((prev) => {
        revokeAttachmentPreviews(prev);
        return [];
      });
      return;
    }

    setCreatePendingAttachments((prev) => {
      revokeAttachmentPreviews(prev);
      return [];
    });
  }, []);

  useEffect(() => {
    if (!selectedThreadId) {
      clearPendingAttachments("reply");
    }
  }, [selectedThreadId, clearPendingAttachments]);

  const uploadPendingAttachments = useCallback(
    async (attachments: PendingAttachment[]): Promise<string[]> => {
      if (!user?.id || attachments.length === 0) return [];

      const urls: string[] = [];
      for (const attachment of attachments) {
        const ext = attachment.file.name.split(".").pop() || "png";
        const fileName = `${user.id}/forum/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const result = await secureUpload("attachments", fileName, attachment.file, {
          contentType: attachment.file.type,
        });
        urls.push(`kloak-attachment://${result.path}`);
      }
      return urls;
    },
    [user?.id],
  );

  const fetchThreads = useCallback(async () => {
    if (!currentChannel || !user?.id) return;
    if (fetchThreadsInFlightRef.current) return fetchThreadsInFlightRef.current;

    const inFlight = (async () => {
      setIsLoading(true);
      try {
        // Fetch all threads for this channel
        const { data: threadsData, error: threadsError } = await supabase
          .from("threads")
          .select("*")
          .eq("channel_id", currentChannel.id)
          .order("created_at", { ascending: false });

        if (threadsError) throw threadsError;

        const threadIds = (threadsData || []).map((t) => t.id);
        const messageIds = (threadsData || []).map((t) => t.message_id);

        if (messageIds.length === 0) {
          setThreads([]);
          return;
        }

        // Fetch the original messages for each thread (single query)
        const { data: messagesData, error: messagesError } = await supabase.rpc("get_messages_by_ids_secure", {
          _message_ids: messageIds,
          _user_id: user!.id,
          _blocked_user_ids: [],
        });

        if (messagesError) throw messagesError;

        // Batch fetch message_count + last_activity + last_message_author for ALL threads (single RPC)
        const { data: summaryData, error: summaryError } = await (supabase.rpc as any)("get_thread_summaries", {
          _thread_ids: threadIds,
        });
        if (summaryError) throw summaryError;

        const summaries = typeof summaryData === "string" ? JSON.parse(summaryData) : summaryData;
        const summaryByThreadId = new Map<string, any>();
        if (Array.isArray(summaries)) {
          for (const s of summaries) {
            if (s?.thread_id) summaryByThreadId.set(s.thread_id, s);
          }
        }

        const threadsWithInfo: Thread[] = (threadsData || []).map((thread) => {
          const rawMessage = ((messagesData || []) as any[]).find((m: any) => m.id === thread.message_id);
          const summary = summaryByThreadId.get(thread.id);

          // Transform raw reactions to ReactionGroup format
          let reactions: ReactionGroup[] = [];
          if (rawMessage?.reactions && Array.isArray(rawMessage.reactions)) {
            const reactionMap = new Map<string, { count: number; users: string[] }>();
            for (const r of rawMessage.reactions) {
              const existing = reactionMap.get(r.emoji);
              if (existing) {
                existing.count++;
                existing.users.push(r.user_id);
              } else {
                reactionMap.set(r.emoji, { count: 1, users: [r.user_id] });
              }
            }
            reactions = Array.from(reactionMap.entries()).map(([emoji, data]) => ({
              emoji,
              count: data.count,
              users: data.users,
              hasReacted: user ? data.users.includes(user.id) : false,
            }));
          }

          // Build the message with properly typed reactions
          const message: Message | undefined = rawMessage
            ? ({
                ...rawMessage,
                is_pinned: rawMessage.is_pinned ?? false,
                reactions,
              } as Message)
            : undefined;

          return {
            ...thread,
            message: message as Message,
            message_count: summary?.message_count ?? 0,
            last_activity: summary?.last_activity ?? thread.created_at,
            last_message_author: summary?.last_message_author ?? undefined,
          };
        });

        setThreads(sortThreads(threadsWithInfo));
      } catch (error) {
        handleError(error, "Failed to fetch threads");
      } finally {
        setIsLoading(false);
      }
    })();

    fetchThreadsInFlightRef.current = inFlight;
    try {
      await inFlight;
    } finally {
      if (fetchThreadsInFlightRef.current === inFlight) {
        fetchThreadsInFlightRef.current = null;
      }
    }
  }, [currentChannel, user?.id]);

  const fetchThreadMessagesById = useCallback(
    async (threadId: string) => {
      if (!threadId) return;

      const { data, error } = await supabase.rpc("get_thread_messages", {
        _thread_id: threadId,
        _limit: 50,
      });

      if (error) throw error;

      const messages = typeof data === "string" ? JSON.parse(data) : data;
      const messageIds = (messages || []).map((m: any) => m.id);
      const reactionsMap: Record<string, any[]> = {};

      if (messageIds.length > 0) {
        const { data: reactionsData } = await supabase.from("thread_reactions").select("*").in("message_id", messageIds);

        if (reactionsData) {
          reactionsData.forEach((reaction) => {
            if (!reactionsMap[reaction.message_id]) {
              reactionsMap[reaction.message_id] = [];
            }
            reactionsMap[reaction.message_id].push(reaction);
          });
        }
      }

      const groupReactions = (reactions: any[], currentUserId?: string) => {
        const groups: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> = {};
        reactions.forEach((reaction) => {
          if (!groups[reaction.emoji]) {
            groups[reaction.emoji] = {
              emoji: reaction.emoji,
              count: 0,
              users: [],
              hasReacted: false,
            };
          }
          groups[reaction.emoji].count++;
          groups[reaction.emoji].users.push(reaction.user_id);
          if (reaction.user_id === currentUserId) {
            groups[reaction.emoji].hasReacted = true;
          }
        });
        return Object.values(groups);
      };

      // Extract users into cache, then strip from messages
      const uniqueUsers = new Map<string, User>();
      for (const msg of (messages || [])) {
        if (msg.user && typeof msg.user === 'object' && msg.user.id) {
          uniqueUsers.set(msg.user.id, msg.user as User);
        }
      }
      if (uniqueUsers.size > 0) {
        bulkSetUsersInCache(Array.from(uniqueUsers.values()));
      }

      const messagesWithUsers = (messages || []).map(
        (msg: any) =>
          ({
            id: msg.id,
            thread_id: msg.thread_id,
            user_id: msg.user_id,
            content: msg.content,
            reply_to_id: msg.reply_to_id,
            reply_to: msg.reply_to ? { id: msg.reply_to.id, content: msg.reply_to.content, user_id: msg.reply_to.user_id || msg.reply_to.user?.id } : null,
            edited_at: msg.edited_at,
            created_at: msg.created_at,
            channel_id: currentChannel?.id || "",
            is_pinned: false,
            reactions: groupReactions(reactionsMap[msg.id] || [], user?.id),
          }) as Message,
      );

      setThreadMessages((prev) => ({
        ...prev,
        [threadId]: messagesWithUsers,
      }));
    },
    [currentChannel?.id, user?.id],
  );

  useEffect(() => {
    fetchThreads();

    // Subscribe to thread changes
    if (!currentChannel) return;

    const channel = supabase
      .channel(`forum-threads:${currentChannel.id}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        "broadcast",
        { event: "threads" },
        () => {
          void fetchThreads();
        },
      )
      .on(
        "broadcast",
        { event: "thread_messages" },
        () => {
          void fetchThreads();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "threads",
          filter: `channel_id=eq.${currentChannel.id}`,
        },
        () => {
          fetchThreads();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentChannel, fetchThreads]);

  // Subscribe to thread messages for realtime updates
  useEffect(() => {
    if (!selectedThreadId || !currentChannel) return;

    const threadId = selectedThreadId; // Capture in closure

    const channel = supabase
      .channel(`thread-messages:${threadId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on(
        "broadcast",
        { event: "thread_messages" },
        ({ payload }) => {
          const eventPayload = payload as BroadcastMutationPayload<ForumBroadcastRow>;
          const changedThreadId = eventPayload?.new?.thread_id ?? eventPayload?.old?.thread_id;

          if (changedThreadId && changedThreadId !== threadId) return;

          void fetchThreadMessagesById(threadId);
        },
      )
      .on(
        "broadcast",
        { event: "thread_reactions" },
        ({ payload }) => {
          const eventPayload = payload as BroadcastMutationPayload<ForumBroadcastRow>;
          const changedMessageId = eventPayload?.new?.message_id ?? eventPayload?.old?.message_id;

          if (changedMessageId) {
            const messages = threadMessagesRef.current[threadId] || [];
            if (!messages.some((m) => m.id === changedMessageId)) return;
          }

          void fetchThreadMessagesById(threadId);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          try {
            const newMsg = payload.new as any;
            const msgThreadId = newMsg.thread_id;

            // Verify this is for the current thread (use ref to get latest value)
            const currentThreadId = selectedThreadIdRef.current;
            if (msgThreadId !== currentThreadId) {
              return;
            }

            // Check if message already exists using functional update
            let shouldAdd = false;
            setThreadMessages((prev) => {
              const currentMessages = prev[currentThreadId] || [];
              if (currentMessages.some((m) => m.id === newMsg.id)) {
                return prev;
              }
              shouldAdd = true;
              return prev; // Return unchanged for now
            });

            if (!shouldAdd) return;

            // Fetch user data for the new message (cached + in-flight deduped)
            const userData = await getOrFetchUser(newMsg.user_id);
            if (!userData) return;

            // Fetch reply_to data if it exists
            let replyToData = null;
            if (newMsg.reply_to_id) {
              try {
                const { data: replyMsg, error: replyError } = await supabase
                  .from("thread_messages")
                  .select("id, user_id, content, created_at")
                  .eq("id", newMsg.reply_to_id)
                  .single();

                if (!replyError && replyMsg) {
                  // Fetch reply user (cached + in-flight deduped)
                  const replyUser = await getOrFetchUser(replyMsg.user_id);

                  replyToData = {
                    id: replyMsg.id,
                    user_id: replyMsg.user_id,
                    content: replyMsg.content,
                    created_at: replyMsg.created_at,
                    user: replyUser || null,
                  };
                }
              } catch (err) {
                // Failed to fetch reply_to data
              }
            }

            // Create message object
            const message: Message = {
              id: newMsg.id,
              user_id: newMsg.user_id,
              content: newMsg.content,
              reply_to_id: newMsg.reply_to_id,
              reply_to: replyToData,
              edited_at: newMsg.edited_at,
              created_at: newMsg.created_at,
              channel_id: currentChannel?.id || "",
              is_pinned: false,
              user: userData,
            };

            // Add message to state
            setThreadMessages((prev) => {
              const existing = prev[currentThreadId] || [];
              // Double-check message doesn't exist (race condition protection)
              if (existing.some((m) => m.id === newMsg.id)) {
                return prev;
              }
              return {
                ...prev,
                [currentThreadId]: [...existing, message],
              };
            });

            // Update thread message count locally instead of full refresh
            setThreads((prev) =>
              sortThreads(
                prev.map((thread) => {
                  if (thread.id === currentThreadId) {
                    return {
                      ...thread,
                      message_count: (thread.message_count || 0) + 1,
                      last_activity: newMsg.created_at,
                      last_message_author: userData,
                    };
                  }
                  return thread;
                }),
              ),
            );
          } catch (error) {
            // Failed to handle new thread message
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "thread_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        async (payload) => {
          try {
            const updatedMsg = payload.new as any;

            setThreadMessages((prev) => {
              const messages = prev[selectedThreadId] || [];
              const updated = messages.map((msg) =>
                msg.id === updatedMsg.id
                  ? { ...msg, content: updatedMsg.content, edited_at: updatedMsg.edited_at }
                  : msg,
              );
              return {
                ...prev,
                [selectedThreadId]: updated,
              };
            });
          } catch (error) {
            // Failed to handle thread message update
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_reactions",
        },
        async (payload) => {
          try {
            const newReaction = payload.new as any;
            const messageId = newReaction.message_id;

            // Check if this reaction is for a message in the current thread
            const messages = threadMessagesRef.current[threadId] || [];
            if (!messages.some((m) => m.id === messageId)) return;

            // Fetch updated reactions for this message
            const { data: reactionsData } = await supabase
              .from("thread_reactions")
              .select("*")
              .eq("message_id", messageId);

            if (reactionsData) {
              const groupReactions = (reactions: any[], currentUserId?: string) => {
                const groups: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> =
                  {};
                reactions.forEach((reaction) => {
                  if (!groups[reaction.emoji]) {
                    groups[reaction.emoji] = {
                      emoji: reaction.emoji,
                      count: 0,
                      users: [],
                      hasReacted: false,
                    };
                  }
                  groups[reaction.emoji].count++;
                  groups[reaction.emoji].users.push(reaction.user_id);
                  if (reaction.user_id === currentUserId) {
                    groups[reaction.emoji].hasReacted = true;
                  }
                });
                return Object.values(groups);
              };

              const reactions = groupReactions(reactionsData, user?.id);

              setThreadMessages((prev) => {
                const messages = prev[threadId] || [];
                return {
                  ...prev,
                  [threadId]: messages.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
                };
              });
            }
          } catch (error) {
            // Failed to handle reaction insert
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "thread_reactions",
        },
        async (payload) => {
          try {
            const deletedReaction = payload.old as any;
            const messageId = deletedReaction.message_id;

            // Check if this reaction is for a message in the current thread
            const messages = threadMessagesRef.current[threadId] || [];
            if (!messages.some((m) => m.id === messageId)) return;

            // Fetch updated reactions for this message
            const { data: reactionsData } = await supabase
              .from("thread_reactions")
              .select("*")
              .eq("message_id", messageId);

            if (reactionsData !== null) {
              const groupReactions = (reactions: any[], currentUserId?: string) => {
                const groups: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> =
                  {};
                reactions.forEach((reaction) => {
                  if (!groups[reaction.emoji]) {
                    groups[reaction.emoji] = {
                      emoji: reaction.emoji,
                      count: 0,
                      users: [],
                      hasReacted: false,
                    };
                  }
                  groups[reaction.emoji].count++;
                  groups[reaction.emoji].users.push(reaction.user_id);
                  if (reaction.user_id === currentUserId) {
                    groups[reaction.emoji].hasReacted = true;
                  }
                });
                return Object.values(groups);
              };

              const reactions = groupReactions(reactionsData, user?.id);

              setThreadMessages((prev) => {
                const messages = prev[threadId] || [];
                return {
                  ...prev,
                  [threadId]: messages.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
                };
              });
            }
          } catch (error) {
            // Failed to handle reaction delete
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "thread_messages",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          try {
            const deletedId = payload.old?.id;
            if (!deletedId) return;

            setThreadMessages((prev) => {
              const messages = prev[threadId] || [];
              const filtered = messages.filter((msg) => msg.id !== deletedId);
              return {
                ...prev,
                [threadId]: filtered,
              };
            });

            // Update thread message count locally
            setThreads((prev) =>
              sortThreads(
                prev.map((thread) => {
                  if (thread.id === threadId) {
                    return {
                      ...thread,
                      message_count: Math.max(0, (thread.message_count || 0) - 1),
                    };
                  }
                  return thread;
                }),
              ),
            );
          } catch (error) {
            // Failed to handle thread message delete
          }
        },
      )
      .subscribe(() => {
        // Subscription status callback
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedThreadId, currentChannel?.id, fetchThreadMessagesById]);

  const handleCreateThread = useCallback(async () => {
    if (!user || !currentChannel) return;

    const title = newThreadTitle.trim();
    const textContent = newThreadContent.trim();
    const hasAttachments = createPendingAttachments.length > 0;
    const baseContent = hasAttachments ? (textContent ? `${textContent}\n` : "") : textContent;

    // If title is provided, use it; otherwise use first line of content as title
    const finalTitle = title || baseContent.split("\n")[0] || "";
    const finalContent = title ? baseContent : baseContent.split("\n").slice(1).join("\n").trim();

    if (!finalTitle.trim()) return;

    setIsCreatingThread(true);
    try {
      const attachmentUrls = await uploadPendingAttachments(createPendingAttachments);
      const contentWithAttachments = [finalContent, ...attachmentUrls].filter(Boolean).join("\n").trim();
      const fullContent = contentWithAttachments ? `${finalTitle}\n\n${contentWithAttachments}` : finalTitle;
      const encodedFullContent = await encodeCustomEmojisForTransport(fullContent);

      // First, send a message with title and content
      const message = await sendMessage(currentChannel.id, user.id, encodedFullContent);
      if (!message) {
        throw new Error("Failed to send message");
      }

      // Then create a thread from that message
      const { data: threadId, error } = await supabase.rpc("create_thread", {
        _message_id: message.id,
        _user_id: user.id,
      });

      if (error) throw error;

      // Clear inputs and refresh threads
      setNewThreadTitle("");
      setNewThreadContent("");
      clearPendingAttachments("create");
      setIsCreateTopicFocused(false);
      setShowFormatToolbar(false);
      await fetchThreads();
      showSuccess("Thread created successfully");
    } catch (error) {
      handleError(error, "Failed to create thread");
    } finally {
      setIsCreatingThread(false);
    }
  }, [
    user,
    currentChannel,
    sendMessage,
    fetchThreads,
    newThreadTitle,
    newThreadContent,
    createPendingAttachments,
    uploadPendingAttachments,
    clearPendingAttachments,
  ]);

  const handleAttachmentInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      files.forEach((file) => addPendingAttachment(imageUploadTarget, file));
      e.target.value = "";
    },
    [imageUploadTarget, addPendingAttachment],
  );

  const handleReplyToThread = useCallback(
    async (threadId: string) => {
      if (!user || (!replyContent.trim() && replyPendingAttachments.length === 0)) return;

      const targetThread = threads.find((thread) => thread.id === threadId);
      if (targetThread?.is_closed && !canManageMessages) {
        showWarning("Thread closed", "This topic is closed.");
        return;
      }

      const content = replyContent.trim();
      setIsSendingReply(true);

      // Get reply_to_id if replying to a message
      const replyToId = replyingToThread || null;

      // Clear reply input and reply target immediately for better UX
      setReplyContent("");
      setReplyingToThread(null);

      try {
        const attachmentUrls = await uploadPendingAttachments(replyPendingAttachments);
        const finalContent = [content, ...attachmentUrls].filter(Boolean).join("\n").trim();
        const encodedFinalContent = await encodeCustomEmojisForTransport(finalContent);

        const { data: result, error } = await supabase.rpc("send_thread_message", {
          _thread_id: threadId,
          _user_id: user.id,
          _content: encodedFinalContent,
          _reply_to_id: replyToId,
        });

        if (error) {
          throw error;
        }

        // Parse the result to get the message data
        const messageData = typeof result === "string" ? JSON.parse(result) : result;

        if (messageData && messageData.id) {
          // Add message immediately with user data and reply_to data
          // Find the reply_to message if we're replying to something
          let replyToData = null;
          if (replyToId && threadMessages[threadId]) {
            const replyToMsg = threadMessages[threadId].find((m) => m.id === replyToId);
            if (replyToMsg) {
              replyToData = {
                id: replyToMsg.id,
                user_id: replyToMsg.user_id,
                content: replyToMsg.content,
              };
            }
          }

          const newMessage: Message = {
            id: messageData.id,
            user_id: user.id,
            content: encodedFinalContent,
            reply_to_id: messageData.reply_to_id || null,
            reply_to: replyToData,
            edited_at: messageData.edited_at || null,
            created_at: messageData.created_at || new Date().toISOString(),
            channel_id: currentChannel?.id || "",
            is_pinned: false,
            // user data lives in cache, not on message
          };

          setThreadMessages((prev) => {
            const existing = prev[threadId] || [];
            // Check if message already exists (shouldn't happen, but safety check)
            if (existing.some((m) => m.id === messageData.id)) {
              return prev;
            }
            return {
              ...prev,
              [threadId]: [...existing, newMessage],
            };
          });
        }

        // Update thread message count locally instead of full refresh
        setThreads((prev) =>
          sortThreads(
            prev.map((thread) => {
              if (thread.id === threadId) {
                return {
                  ...thread,
                  message_count: (thread.message_count || 0) + 1,
                  last_activity: messageData.created_at || new Date().toISOString(),
                };
              }
              return thread;
            }),
          ),
        );
        if (currentChannel?.id) {
          void markAsRead(currentChannel.id);
        }
        clearPendingAttachments("reply");
      } catch (error) {
        // Restore reply content on error
        setReplyContent(content);
        handleError(error, "Failed to send reply");
      } finally {
        setIsSendingReply(false);
      }
    },
    [
      user,
      replyContent,
      currentChannel,
      replyingToThread,
      replyPendingAttachments,
      uploadPendingAttachments,
      clearPendingAttachments,
      markAsRead,
      threads,
      canManageMessages,
    ],
  );

  const handleUpdateThreadModeration = useCallback(
    async (threadId: string, updates: { is_pinned?: boolean; is_closed?: boolean }) => {
      if (!user) return;

      try {
        const { data, error } = await (supabase.rpc as any)("update_forum_thread_moderation", {
          _thread_id: threadId,
          _user_id: user.id,
          _is_pinned: typeof updates.is_pinned === "boolean" ? updates.is_pinned : null,
          _is_closed: typeof updates.is_closed === "boolean" ? updates.is_closed : null,
        });

        if (error) throw error;

        const moderation = typeof data === "string" ? JSON.parse(data) : data;
        setThreads((prev) =>
          sortThreads(
            prev.map((thread) =>
              thread.id === threadId
                ? {
                    ...thread,
                    is_pinned: moderation?.is_pinned ?? thread.is_pinned,
                    is_closed: moderation?.is_closed ?? thread.is_closed,
                  }
                : thread,
            ),
          ),
        );

        if (updates.is_pinned !== undefined) {
          showSuccess(updates.is_pinned ? "Topic pinned" : "Topic unpinned");
        }
        if (updates.is_closed !== undefined) {
          showSuccess(updates.is_closed ? "Topic closed" : "Topic reopened");
        }
      } catch (error) {
        handleError(error, "Failed to update topic");
      }
    },
    [user],
  );

  const handleThreadClick = useCallback(
    async (threadId: string, messageId: string) => {
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
        return;
      }

      setIsEditingThreadPost(false);
      setThreadPostEditTitle("");
      setThreadPostEditBody("");
      setSelectedThreadId(threadId);
      if (currentChannel?.id) {
        void markAsRead(currentChannel.id, messageId);
      }

      // Fetch thread messages if not already loaded
      if (!threadMessages[threadId]) {
        try {
          await fetchThreadMessagesById(threadId);
        } catch (error) {
          handleError(error, "Failed to fetch thread messages");
        }
      }
    },
    [selectedThreadId, threadMessages, fetchThreadMessagesById, currentChannel?.id, markAsRead],
  );

  if (!currentChannel) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-medium text-foreground">No Channel Selected</h2>
          <p className="text-muted-foreground max-w-md text-sm leading-relaxed mt-2">
            Choose a forum channel from the sidebar to view threads
          </p>
        </div>
      </div>
    );
  }

  const handleFormat = useCallback(
    (formatType: string) => {
      const textarea = createTopicTextareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = newThreadContent.slice(start, end);
      const syntax = FORMAT_SYNTAX[formatType];

      if (!syntax) return;

      const { prefix, suffix } = syntax;
      const textToWrap = selectedText || "text";
      const newContent = newThreadContent.slice(0, start) + prefix + textToWrap + suffix + newThreadContent.slice(end);

      setNewThreadContent(newContent);

      requestAnimationFrame(() => {
        if (selectedText) {
          const newPos = start + prefix.length + selectedText.length + suffix.length;
          textarea.setSelectionRange(newPos, newPos);
        } else {
          const selectStart = start + prefix.length;
          const selectEnd = selectStart + 4;
          textarea.setSelectionRange(selectStart, selectEnd);
        }
        textarea.focus();
      });
    },
    [newThreadContent],
  );

  const handleCancelCreate = useCallback(() => {
    setNewThreadTitle("");
    setNewThreadContent("");
    clearPendingAttachments("create");
    setIsCreateTopicFocused(false);
    setShowFormatToolbar(false);
  }, [clearPendingAttachments]);

  const selectedThread = selectedThreadId ? threads.find((thread) => thread.id === selectedThreadId) ?? null : null;
  const selectedThreadIsClosed = !!selectedThread?.is_closed;
  const canReplyToSelectedThread = !!selectedThread && (!selectedThreadIsClosed || canManageMessages);

  const handleSaveThreadPostEdit = useCallback(
    async (threadId: string) => {
      if (!user) return;

      const title = threadPostEditTitle.trim();
      const body = threadPostEditBody.trim();
      if (!title) {
        showWarning("Topic title required", "Add a title before saving.");
        return;
      }

      const content = body ? `${title}\n\n${body}` : title;
      const encodedBody = await encodeCustomEmojisForTransport(body);
      setIsSavingThreadPostEdit(true);

      try {
        const { data, error } = await (supabase.rpc as any)("edit_forum_thread_post", {
          _thread_id: threadId,
          _title: title,
          _content: encodedBody,
        });

        if (error) {
          throw error;
        }

        const updated = typeof data === "string" ? JSON.parse(data) : data;
        const updatedContent = typeof updated?.content === "string" ? updated.content : content;
        const updatedEditedAt = updated?.edited_at || new Date().toISOString();

        setThreads((prev) =>
          sortThreads(
            prev.map((thread) =>
              thread.id === threadId
                ? {
                    ...thread,
                    message: thread.message
                      ? {
                          ...thread.message,
                          content: updatedContent,
                          edited_at: updatedEditedAt,
                        }
                      : thread.message,
                  }
                : thread,
            ),
          ),
        );
        setIsEditingThreadPost(false);
        showSuccess("Topic updated");
      } catch (error) {
        handleError(error, "Failed to edit topic");
      } finally {
        setIsSavingThreadPostEdit(false);
      }
    },
    [user, threadPostEditTitle, threadPostEditBody],
  );

  const handleEditMessage = useCallback(
    async (messageId: string) => {
      if (!user || !editContent.trim()) return;

      try {
        const trimmed = editContent.trim();
        const encodedTrimmed = await encodeCustomEmojisForTransport(trimmed);
        const { data, error } = await (supabase.rpc as any)("edit_thread_message", {
          _message_id: messageId,
          _content: encodedTrimmed,
        });

        if (error) throw error;

        const updatedMsg = typeof data === "string" ? JSON.parse(data) : data;
        const updatedContent = typeof updatedMsg?.content === "string" ? updatedMsg.content : trimmed;
        const updatedEditedAt = updatedMsg?.edited_at || new Date().toISOString();

        // Update local state
        setThreadMessages((prev) => {
          const threadId = selectedThreadId;
          if (!threadId || !prev[threadId]) return prev;

          return {
            ...prev,
            [threadId]: prev[threadId].map((m) =>
              m.id === messageId ? { ...m, content: updatedContent, edited_at: updatedEditedAt } : m,
            ),
          };
        });

        setEditingMessageId(null);
        setEditContent("");
      } catch (error) {
        handleError(error, "Failed to edit message");
      }
    },
    [user, editContent, selectedThreadId],
  );

  const handleDeleteMessage = useCallback(
    async (messageId: string) => {
      if (!user || !selectedThreadId) {
        return;
      }

      try {
        // Use RPC function that handles permission checks (allows admins to delete)
        const { data, error } = await supabase.rpc("delete_thread_message", {
          _message_id: messageId,
          _user_id: user.id,
        });

        if (error) {
          throw error;
        }

        // Update local state
        setThreadMessages((prev) => {
          if (!prev[selectedThreadId]) return prev;

          return {
            ...prev,
            [selectedThreadId]: prev[selectedThreadId].filter((m) => m.id !== messageId),
          };
        });

        // Update thread count
        setThreads((prev) =>
          sortThreads(
            prev.map((thread) => {
              if (thread.id === selectedThreadId) {
                return {
                  ...thread,
                  message_count: Math.max(0, (thread.message_count || 0) - 1),
                };
              }
              return thread;
            }),
          ),
        );

        setShowDeleteModal(false);
        setMessageToDelete(null);
      } catch (error) {
        handleError(error, "Failed to delete message");
      }
    },
    [user, selectedThreadId],
  );

  const handleDeleteThread = useCallback(
    async (thread: Thread) => {
      if (!user) return;

      try {
        const { error } = await (supabase.rpc as any)("delete_forum_thread", {
          _thread_id: thread.id,
          _user_id: user.id,
        });

        if (error) throw error;

        // Update local state
        setThreads((prev) => prev.filter((t) => t.id !== thread.id));
        if (selectedThreadId === thread.id) {
          setSelectedThreadId(null);
          setReplyContent("");
          setReplyingToThread(null);
        }
        setShowDeleteThreadModal(false);
        setThreadToDelete(null);
        showSuccess("Thread deleted successfully");
      } catch (error) {
        handleError(error, "Failed to delete thread");
      }
    },
    [user, selectedThreadId],
  );

  const handleAddReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!user || !selectedThreadId) {
        return;
      }

      try {
        // Check if reaction already exists
        const { data: existing, error: checkError } = await supabase
          .from("thread_reactions")
          .select("*")
          .eq("message_id", messageId)
          .eq("user_id", user.id)
          .eq("emoji", emoji)
          .maybeSingle();

        if (checkError && checkError.code !== "PGRST116") {
          throw checkError;
        }

        if (existing) {
          // Remove reaction
          const { error: deleteError } = await supabase
            .from("thread_reactions")
            .delete()
            .eq("message_id", messageId)
            .eq("user_id", user.id)
            .eq("emoji", emoji);

          if (deleteError) {
            throw deleteError;
          }
        } else {
          // Add reaction
          const { error: insertError } = await supabase.from("thread_reactions").insert({
            message_id: messageId,
            user_id: user.id,
            emoji: emoji,
          });

          if (insertError) {
            throw insertError;
          }
        }

        // Refresh reactions for this message
        const { data: reactionsData } = await supabase.from("thread_reactions").select("*").eq("message_id", messageId);

        if (reactionsData) {
          const groupReactions = (reactions: any[], currentUserId?: string) => {
            const groups: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> = {};
            reactions.forEach((reaction) => {
              if (!groups[reaction.emoji]) {
                groups[reaction.emoji] = {
                  emoji: reaction.emoji,
                  count: 0,
                  users: [],
                  hasReacted: false,
                };
              }
              groups[reaction.emoji].count++;
              groups[reaction.emoji].users.push(reaction.user_id);
              if (reaction.user_id === currentUserId) {
                groups[reaction.emoji].hasReacted = true;
              }
            });
            return Object.values(groups);
          };

          const reactions = groupReactions(reactionsData, user?.id);

          setThreadMessages((prev) => {
            if (!selectedThreadId || !prev[selectedThreadId]) return prev;
            return {
              ...prev,
              [selectedThreadId]: prev[selectedThreadId].map((m) => (m.id === messageId ? { ...m, reactions } : m)),
            };
          });
        }

        setShowEmojiPicker(null);
      } catch (error) {
        handleError(error, "Failed to add reaction");
      }
    },
    [user, selectedThreadId],
  );

  const renderThreadReplyComposer = (threadId: string) => {
    const thread = threads.find((item) => item.id === threadId);
    const isClosed = !!thread?.is_closed;
    const canReply = !isClosed || canManageMessages;
    const replyToMsg = replyingToThread ? threadMessages[threadId]?.find((m) => m.id === replyingToThread) : null;

    if (!canReply) {
      return (
        <div className="border-t border-border bg-background p-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>This topic is closed</span>
          </div>
        </div>
      );
    }

    return (
      <div className="border-t border-border bg-background p-3">
        {replyToMsg && (
          <div className="mb-2 flex items-center gap-2 border border-border bg-muted/20 px-3 py-2 text-sm">
            <CornerUpLeft className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Replying to</span>
            <span className="font-medium text-primary">
              @{getUserFromCache(replyToMsg.user_id)?.username || "unknown"}
            </span>
            <span className="truncate text-muted-foreground opacity-75 max-w-[120px]">
              {(() => {
                const cleaned = replyToMsg.content?.replace(/kloak-attachment:\/\/[^\s]*/g, '').trim() || '';
                if (!cleaned) return <span className="italic flex items-center gap-1"><Paperclip className="w-3 h-3" />attachment</span>;
                const preview = cleaned.slice(0, 30);
                return preview + (cleaned.length > 30 ? "..." : "");
              })()}
            </span>
            <button
              type="button"
              className="ml-auto p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              onClick={() => setReplyingToThread(null)}
              aria-label="Cancel reply"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div
          className={`border bg-background transition-all ${
            threadComposerFocused ? "border-primary/40" : "border-border"
          }`}
        >
          {replyPendingAttachments.length > 0 && (
            <AttachmentPreviewBar
              attachments={replyPendingAttachments}
              onRemove={(index) =>
                setReplyPendingAttachments((prev) => {
                  const next = [...prev];
                  const [removed] = next.splice(index, 1);
                  if (removed) URL.revokeObjectURL(removed.preview);
                  return next;
                })
              }
              onAddMore={() => {
                openAttachmentPicker("reply");
              }}
              disabled={isSendingReply}
            />
          )}

          <div className="flex items-end gap-2 p-2 sm:p-3">
            <textarea
              ref={replyTextareaRef}
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              onFocus={() => setThreadComposerFocused(true)}
              onBlur={() => setThreadComposerFocused(false)}
              placeholder={replyingToThread ? "Write a reply..." : "Reply to thread..."}
              className="flex-1 bg-transparent resize-none outline-none py-2 px-1 min-h-[40px] max-h-[160px] text-[15px]"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleReplyToThread(threadId);
                }
              }}
            />

            <div className="flex items-center gap-1 mb-0.5 relative">
                <button
                  type="button"
                  onClick={() => {
                    openAttachmentPicker("reply");
                  }}
                className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"
                aria-label="Attach image"
                title="Attach image"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <EmojiGifPicker
                onEmojiSelect={(emoji) => insertIntoReplyComposer(emoji)}
                onGifSelect={() => {}}
                open={threadComposerEmojiOpen}
                onOpenChange={setThreadComposerEmojiOpen}
                disableGif
                serverId={currentServer?.id}
                serverName={currentServer?.name}
              >
                <button
                  type="button"
                  className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"
                  aria-label="Add emoji"
                  title="Add emoji"
                  disabled={!currentServer?.id}
                >
                  <Smile className="w-5 h-5" />
                </button>
              </EmojiGifPicker>

              <button
                type="button"
                onClick={() => void handleReplyToThread(threadId)}
                disabled={(!replyContent.trim() && replyPendingAttachments.length === 0) || isSendingReply}
                className={`p-2 rounded-xl transition-all ${
                  (replyContent.trim() || replyPendingAttachments.length > 0) && !isSendingReply
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
                    : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
                }`}
                aria-label="Send"
                title="Send"
              >
                {isSendingReply ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div ref={swipeRef} className="h-full min-w-0 bg-background">
      {showHeader && <ChannelHeader channel={currentChannel} />}

      <div className={cn("relative flex overflow-hidden", showHeader ? "h-[calc(100%-57px)]" : "h-full")}>
        {/* Threads List */}
        <div
          className={`${selectedThreadId ? "w-full md:w-[42%] border-r border-border" : "w-full"} ${selectedThreadId && isMobile ? "hidden" : ""} overflow-y-auto transition-all`}
        >
          <div className="min-h-full bg-background">
          {/* Create Topic Editor */}
          {isCreateTopicFocused ? (
            <div className="border-b border-border p-3 md:p-4">
              {/* Title Input with Avatar */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={user?.avatar_url} />
                  <AvatarFallback>{user?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                <Input
                  ref={createTopicTitleRef}
                  value={newThreadTitle}
                  onChange={(e) => setNewThreadTitle(e.target.value)}
                  placeholder="Type your title"
                  className="flex-1 bg-transparent border-0 border-b border-border/50 rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                  onFocus={() => setIsCreateTopicFocused(true)}
                />
              </div>

              {/* Formatting Toolbar */}
              <div className="mb-3 format-toolbar" onMouseDown={(e) => e.preventDefault()}>
                <FormatToolbar
                  onFormat={handleFormat}
                  onImageClick={() => {
                    openAttachmentPicker("create");
                  }}
                  onClose={() => {
                    setShowFormatToolbar(false);
                    createTopicTextareaRef.current?.focus();
                  }}
                />
              </div>

              {/* Main Content Textarea */}
              <Textarea
                ref={createTopicTextareaRef}
                value={newThreadContent}
                onChange={(e) => setNewThreadContent(e.target.value)}
                onFocus={() => {
                  setIsCreateTopicFocused(true);
                  setShowFormatToolbar(true);
                }}
                onBlur={(e) => {
                  // Use setTimeout to check if focus moved to format toolbar or buttons
                  setTimeout(() => {
                    const activeElement = document.activeElement;
                    if (
                      !activeElement ||
                      (!activeElement.closest(".format-toolbar") && !activeElement.closest(".create-topic-actions"))
                    ) {
                      // Only blur if clicking outside
                      if (!newThreadTitle.trim() && !newThreadContent.trim()) {
                        setIsCreateTopicFocused(false);
                        setShowFormatToolbar(false);
                      }
                    }
                  }, 200);
                }}
                placeholder="What do you want to post?"
                className="min-h-[160px] resize-none border border-border bg-background px-3 py-2 focus-visible:ring-0"
              />

              {createPendingAttachments.length > 0 && (
                <AttachmentPreviewBar
                  attachments={createPendingAttachments}
                  onRemove={(index) =>
                    setCreatePendingAttachments((prev) => {
                      const next = [...prev];
                      const [removed] = next.splice(index, 1);
                      if (removed) URL.revokeObjectURL(removed.preview);
                      return next;
                    })
                  }
                  onAddMore={() => {
                    openAttachmentPicker("create");
                  }}
                  disabled={isCreatingThread}
                />
              )}

              {/* Action Buttons */}
              <div className="flex justify-between items-center gap-2 mt-4 create-topic-actions">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    openAttachmentPicker("create");
                  }}
                  aria-label="Attach image"
                  title="Attach image"
                >
                  <Paperclip className="w-4 h-4 mr-2" />
                  Attach
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleCancelCreate} disabled={isCreatingThread}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateThread}
                    disabled={(!newThreadTitle.trim() && !newThreadContent.trim()) || isCreatingThread}
                  >
                    {isCreatingThread ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 md:p-4">
              <div
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3.5 transition-colors hover:bg-muted/50"
                onClick={() => {
                  setIsCreateTopicFocused(true);
                  setTimeout(() => {
                    createTopicTitleRef.current?.focus();
                  }, 100);
                }}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Plus className="h-4.5 w-4.5" />
                </div>
                <span className="text-sm font-medium text-foreground flex-1">Create a Post</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <ForumThreadsSkeleton />
          ) : threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl scale-150" />
                <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 flex items-center justify-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground" />
                </div>
              </div>
              <h2 className="text-2xl font-medium text-foreground mb-3">Forum Threads</h2>
              <p className="text-muted-foreground max-w-sm leading-relaxed">
                Start discussions with your community. Topics stay organized and easy to follow.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3 md:p-4">
              {threads.map((thread) => {
                const isSelected = selectedThreadId === thread.id;
                // Extract title from message content: first line before double newline, or first line if no double newline
                const messageContent = thread.message?.content || "";
                // Split by double newline first (title\n\ncontent format)
                const parts = messageContent.split("\n\n");
                const threadTitle =
                  parts.length > 1 ? parts[0].trim() : messageContent.split("\n")[0].trim() || "No content";
                const rawPreview =
                  parts.length > 1
                    ? parts.slice(1).join("\n\n").trim()
                    : messageContent.split("\n").slice(1).join("\n").trim();
                // Strip kloak-attachment:// URLs from preview
                const threadPreview = rawPreview.replace(/kloak-attachment:\/\/[^\s]*/g, '').trim();
                // Extract first attachment image URL for thumbnail
                const attachmentMatch = messageContent.match(/kloak-attachment:\/\/([^\s]+)/);
                const firstAttachmentPath = attachmentMatch ? attachmentMatch[1] : null;
                const replyCount = Math.max(0, Number(thread.message_count ?? 0));
                const opUser = thread.message?.user;
                const lastAuthor = thread.last_message_author || opUser;
                const opUsernameColor = getUsernameColor(opUser?.id || thread.message?.user_id);
                const lastAuthorUsernameColor = getUsernameColor(lastAuthor?.id);

                return (
                  <div
                    key={thread.id}
                    onClick={() => handleThreadClick(thread.id, thread.message_id)}
                    className={`group/thread relative w-full cursor-pointer text-left transition-colors rounded-lg border ${
                      isSelected
                        ? "bg-muted/35 border-border"
                        : thread.is_pinned
                          ? "bg-amber-500/10 hover:bg-amber-500/14 border-amber-500/20"
                          : "bg-muted/15 hover:bg-muted/30 border-border/60"
                    }`}
                  >
                    {(isSelected || thread.is_pinned) && (
                      <div
                        className={cn(
                          "absolute inset-y-0 left-0 w-0.5",
                          isSelected ? "bg-foreground/70" : "bg-amber-500/65",
                        )}
                      />
                    )}

                    <div className="p-4 md:py-5 md:px-5">
                      {/* Desktop layout */}
                      <div className="hidden md:flex md:gap-4">
                        {firstAttachmentPath && (
                          <ForumThreadThumbnail attachmentPath={firstAttachmentPath} />
                        )}
                        <div className="min-w-0 flex-1 flex flex-col gap-2">
                          {/* Title */}
                          <span className="block truncate text-base font-medium text-foreground">{threadTitle}</span>

                          {/* Created by + Posted at */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className={forumMetaChipClass}>
                              <Avatar className="h-4 w-4">
                                <AvatarImage src={opUser?.avatar_url} />
                                <AvatarFallback className="text-[8px]">
                                  {opUser?.username?.[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span>Created by</span>
                              <span className={opUsernameColor.className} style={opUsernameColor.style}>
                                {getDisplayName(opUser?.id || thread.message?.user_id, opUser)}
                              </span>
                            </div>
                            <div className={forumMetaChipClass}>
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>

                          {/* Content preview */}
                          {threadPreview && (
                            <p className="line-clamp-2 text-[0.9375rem] text-foreground">
                              {threadPreview}
                            </p>
                          )}

                          {/* Replies + Pinned/Closed + Latest reply by */}
                          {(replyCount > 0 || thread.is_pinned || thread.is_closed) && (
                            <div className="flex flex-wrap items-center gap-3">
                              {replyCount > 0 && (
                                <div className={forumMetaChipClass}>
                                  <MessageSquare className="h-3.5 w-3.5 text-primary" />
                                  <span>+{replyCount}</span>
                                </div>
                              )}
                              {thread.is_pinned && (
                                <div className={forumMetaChipClass}>
                                  <Pin className="h-3.5 w-3.5" />
                                  <span>Pinned</span>
                                </div>
                              )}
                              {thread.is_closed && (
                                <div className={forumMetaChipClass}>
                                  <Lock className="h-3.5 w-3.5" />
                                  <span>Closed</span>
                                </div>
                              )}
                              {lastAuthor && replyCount > 0 && (
                                <div className={forumMetaChipClass}>
                                  <Avatar className="h-4 w-4">
                                    <AvatarImage src={lastAuthor.avatar_url} />
                                    <AvatarFallback className="text-[8px]">
                                      {lastAuthor.username?.[0]?.toUpperCase() || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>Latest reply by</span>
                                  <span className={lastAuthorUsernameColor.className} style={lastAuthorUsernameColor.style}>
                                    {getDisplayName(lastAuthor.id, lastAuthor)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Mobile layout */}
                      <div className="flex gap-3 md:hidden">
                        {firstAttachmentPath && (
                          <ForumThreadThumbnail attachmentPath={firstAttachmentPath} />
                        )}
                        <div className="min-w-0 flex-1 flex flex-col gap-2">
                          {/* Title */}
                          <div className="text-sm font-medium text-foreground">{threadTitle}</div>

                          {/* Created by + Posted at */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className={forumMetaChipClass}>
                              <Avatar className="w-4 h-4">
                                <AvatarImage src={opUser?.avatar_url} />
                                <AvatarFallback className="text-[8px]">
                                  {opUser?.username?.[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <span>Created by</span>
                              <span className={opUsernameColor.className} style={opUsernameColor.style}>
                                {getDisplayName(opUser?.id || thread.message?.user_id, opUser)}
                              </span>
                            </div>
                            <div className={forumMetaChipClass}>
                              <Clock className="w-3.5 h-3.5" />
                              <span>
                                {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>

                          {/* Content preview */}
                          {threadPreview && (
                            <p className="line-clamp-2 text-sm text-foreground">
                              {threadPreview}
                            </p>
                          )}

                          {/* Replies + Pinned/Closed + Latest reply by */}
                          {(replyCount > 0 || thread.is_pinned || thread.is_closed) && (
                            <div className="flex flex-wrap items-center gap-3">
                              {replyCount > 0 && (
                                <div className={forumMetaChipClass}>
                                  <MessageSquare className="w-3.5 h-3.5 text-primary" />
                                  <span>+{replyCount}</span>
                                </div>
                              )}
                              {thread.is_pinned && (
                                <div className={forumMetaChipClass}>
                                  <Pin className="w-3.5 h-3.5" />
                                  <span>Pinned</span>
                                </div>
                              )}
                              {thread.is_closed && (
                                <div className={forumMetaChipClass}>
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Closed</span>
                                </div>
                              )}
                              {lastAuthor && replyCount > 0 && (
                                <div className={forumMetaChipClass}>
                                  <Avatar className="w-4 h-4">
                                    <AvatarImage src={lastAuthor.avatar_url} />
                                    <AvatarFallback className="text-[8px]">
                                      {lastAuthor.username?.[0]?.toUpperCase() || "?"}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>Latest reply by</span>
                                  <span className={lastAuthorUsernameColor.className} style={lastAuthorUsernameColor.style}>
                                    {getDisplayName(lastAuthor.id, lastAuthor)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Delete thread button removed from list - only available when thread is opened */}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* Thread View - Drawer overlay */}
        {(() => {
          const selectedThread = selectedThreadId ? threads.find((t) => t.id === selectedThreadId) : null;
          const messageContent = selectedThread?.message?.content || "";
          const parsedThread = parseThreadMessageContent(messageContent);
          const threadTitle = parsedThread.title || "No content";
          const threadDescription = parsedThread.description;
          const opUser = selectedThread?.message?.user;
          const opUsernameColor = getUsernameColor(selectedThread?.created_by || opUser?.id);
          const canEditThreadPost = !!selectedThread?.message?.id && user?.id === selectedThread?.created_by;

          return (
            <Drawer
              direction="right"
              open={!!selectedThreadId}
              onOpenChange={(open) => {
                if (!open) {
                  setSelectedThreadId(null);
                  setReplyContent("");
                  setReplyingToThread(null);
                }
              }}
            >
              <DrawerContent className="w-[90vw] max-w-2xl">
                {selectedThread && (
                  <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
                    {/* Header */}
                    <div className="z-30 flex items-center justify-between border-b border-border bg-background px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Open thread
                        </p>
                        <h3 className="truncate text-lg font-medium">{threadTitle}</h3>
                      </div>
                      <div className="flex items-center gap-1">
                        {canManageMessages && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void handleUpdateThreadModeration(selectedThread.id, { is_pinned: !selectedThread.is_pinned })
                              }
                              className={cn(
                                "h-8 w-8 p-0 text-muted-foreground",
                                selectedThread.is_pinned && "text-amber-600 hover:text-amber-600",
                              )}
                              title={selectedThread.is_pinned ? "Unpin topic" : "Pin topic"}
                            >
                              <Pin className="w-4 h-4 translate-y-px" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void handleUpdateThreadModeration(selectedThread.id, { is_closed: !selectedThread.is_closed })
                              }
                              className={cn(
                                "h-8 w-8 p-0 text-muted-foreground",
                                selectedThread.is_closed && "text-amber-600 hover:text-amber-600",
                              )}
                              title={selectedThread.is_closed ? "Reopen topic" : "Close topic"}
                            >
                              {selectedThread.is_closed ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </Button>
                          </>
                        )}
                        {canEditThreadPost && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setThreadPostEditTitle(threadTitle);
                              setThreadPostEditBody(threadDescription);
                              setIsEditingThreadPost(true);
                              setTimeout(() => threadPostTitleInputRef.current?.focus(), 0);
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="Edit topic"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {(user?.id === selectedThread?.created_by || canManageMessages) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (selectedThread) {
                                setThreadToDelete(selectedThread);
                                setShowDeleteThreadModal(true);
                              }
                            }}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Delete thread"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedThreadId(null);
                            setReplyContent("");
                            setReplyingToThread(null);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto p-4">
                      {/* Thread Description */}
                      {threadDescription && (
                        <div key={selectedThreadId} className="mb-4 border-b border-border pb-4">
                          <div className="flex gap-3">
                            <Avatar
                              className="w-8 h-8 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={(event) =>
                                openUserProfileModal(
                                  openModal,
                                  selectedThread?.created_by,
                                  event.currentTarget,
                                  SIDE_ALIGNED_USER_PROFILE_POPOVER,
                                )
                              }
                            >
                              <AvatarImage src={opUser?.avatar_url} />
                              <AvatarFallback>{opUser?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <button
                                  type="button"
                                  className={cn(
                                    "font-medium text-sm cursor-pointer text-left",
                                    opUsernameColor.isGradient ? "transition-none" : "hover:opacity-80 transition-opacity",
                                  )}
                                  onClick={(event) =>
                                    openUserProfileModal(
                                      openModal,
                                      selectedThread?.created_by,
                                      event.currentTarget,
                                      SIDE_ALIGNED_USER_PROFILE_POPOVER,
                                    )
                                  }
                                >
                                  <span className={opUsernameColor.className} style={opUsernameColor.style}>
                                    {getDisplayName(selectedThread?.created_by || opUser?.id, opUser)}
                                  </span>
                                </button>
                                <span className="text-xs text-muted-foreground">
                                  {selectedThread?.created_at &&
                                    formatDistanceToNow(new Date(selectedThread.created_at), { addSuffix: true })}
                                </span>
                                {selectedThread?.message?.edited_at && (
                                  <span className="text-[10px] text-muted-foreground">(edited)</span>
                                )}
                                {selectedThread?.is_pinned && (
                                  <span className={forumMetaChipClass}>
                                    <Pin className="h-3 w-3" />
                                    <span>Pinned</span>
                                  </span>
                                )}
                                {selectedThread?.is_closed && (
                                  <span className={forumMetaChipClass}>
                                    <Lock className="h-3 w-3" />
                                    <span>Closed</span>
                                  </span>
                                )}
                              </div>
                              {isEditingThreadPost ? (
                                <div className="space-y-2">
                                  <Input
                                    ref={threadPostTitleInputRef}
                                    value={threadPostEditTitle}
                                    onChange={(e) => setThreadPostEditTitle(e.target.value)}
                                    placeholder="Topic title"
                                    maxLength={200}
                                  />
                                  <Textarea
                                    value={threadPostEditBody}
                                    onChange={(e) => setThreadPostEditBody(e.target.value)}
                                    className="min-h-[100px] resize-y"
                                    placeholder="Topic content"
                                    onKeyDown={(e) => {
                                      if (e.key === "Escape") {
                                        setIsEditingThreadPost(false);
                                        setThreadPostEditTitle(threadTitle);
                                        setThreadPostEditBody(threadDescription);
                                      } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && selectedThread?.id) {
                                        void handleSaveThreadPostEdit(selectedThread.id);
                                      }
                                    }}
                                  />
                                  <div className="flex gap-2 text-xs">
                                    <button
                                      className="text-primary hover:underline disabled:opacity-50"
                                      disabled={isSavingThreadPostEdit}
                                      onClick={() => {
                                        if (selectedThread?.id) {
                                          void handleSaveThreadPostEdit(selectedThread.id);
                                        }
                                      }}
                                    >
                                      {isSavingThreadPostEdit ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                      className="text-muted-foreground hover:underline"
                                      onClick={() => {
                                        setIsEditingThreadPost(false);
                                        setThreadPostEditTitle(threadTitle);
                                        setThreadPostEditBody(threadDescription);
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-foreground">
                                  <MessageContent
                                    content={threadDescription.replace(/kloak-attachment:\/\/[^\s]*/g, '').trim()}
                                    currentUserId={user?.id}
                                    messageId={selectedThread?.message?.id}
                                    messageUser={
                                      opUser
                                        ? {
                                            id: opUser.id,
                                            username: opUser.username,
                                            display_name: opUser.display_name,
                                          }
                                        : null
                                    }
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Attachment gallery */}
                          <div className="mt-3">
                            <ThreadAttachmentGallery content={messageContent} />
                          </div>
                        </div>
                      )}

                      {/* Thread Replies */}
                      <div className="mb-4">
                        <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                          Replies ({threadMessages[selectedThreadId!]?.length || 0})
                        </h4>
                      </div>

                      {threadMessages[selectedThreadId!] ? (
                        <div className="space-y-3">
                          {threadMessages[selectedThreadId!].map((msg) => {
                            const isOwnMessage = user?.id === msg.user_id;
                            const isHovered = hoveredMessageId === msg.id;
                            const isEditing = editingMessageId === msg.id;
                            const canDeleteMessage = isOwnMessage || canManageMessages;
                            const msgUsernameColor = getUsernameColor(msg.user_id);
                            const msgCachedUser = getUserFromCache(msg.user_id);

                            return (
                              <div
                                key={msg.id}
                                className="group relative flex gap-3 border-b border-border pb-3"
                                onMouseEnter={() => setHoveredMessageId(msg.id)}
                                onMouseLeave={() => setHoveredMessageId(null)}
                                onTouchStart={() => setHoveredMessageId(msg.id)}
                                onTouchEnd={() => setTimeout(() => setHoveredMessageId(null), 2000)}
                              >
                                <Avatar className="w-8 h-8 flex-shrink-0">
                                  <AvatarImage src={msgCachedUser?.avatar_url || msg.user?.avatar_url} />
                                  <AvatarFallback>
                                    {msgCachedUser?.username?.[0]?.toUpperCase() || msg.user?.username?.[0]?.toUpperCase() || "?"}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span
                                      className={cn(
                                        "font-medium text-sm cursor-pointer",
                                        msgUsernameColor.isGradient ? "transition-none" : "hover:opacity-80 transition-opacity",
                                        msgUsernameColor.className,
                                      )}
                                      style={msgUsernameColor.style}
                                      onClick={(event) =>
                                        openUserProfileModal(
                                          openModal,
                                          msg.user_id,
                                          event.currentTarget,
                                          SIDE_ALIGNED_USER_PROFILE_POPOVER,
                                        )
                                      }
                                    >
                                      {getDisplayName(msg.user_id || msg.user?.id, msg.user)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatMessageTimestamp(msg.created_at)}
                                    </span>
                                    {msg.edited_at && <span className="text-[10px] text-muted-foreground">(edited)</span>}
                                  </div>

                                  {/* Reply reference */}
                                  {msg.reply_to && (
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                                      <CornerUpLeft className="w-3 h-3 flex-shrink-0" />
                                      <span>Replying to</span>
                                      <span className="font-medium text-primary">
                                        @{getUserFromCache(msg.reply_to.user_id)?.username || msg.reply_to.user?.username || "unknown"}
                                      </span>
                                      {isPollMessageContent(msg.reply_to.content) ? (
                                        <span className="italic">poll</span>
                                      ) : isImageOnlyMessage(msg.reply_to.content) ? (
                                        <img
                                          src={msg.reply_to.content.trim()}
                                          alt="Image"
                                          className="w-6 h-6 rounded object-cover flex-shrink-0"
                                        />
                                      ) : (
                                        <span className="truncate max-w-[200px]">
                                          <ReplyPreview content={msg.reply_to.content} maxLength={50} />
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {isEditing ? (
                                    <div className="space-y-2">
                                      <Textarea
                                        ref={editTextareaRef}
                                        value={editContent}
                                        onChange={(e) => setEditContent(e.target.value)}
                                        className="min-h-[60px] resize-none text-sm"
                                        onKeyDown={(e) => {
                                          if (e.key === "Escape") {
                                            setEditingMessageId(null);
                                            setEditContent("");
                                          } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                            handleEditMessage(msg.id);
                                          }
                                        }}
                                      />
                                      <div className="flex gap-2 text-xs">
                                        <button
                                          className="text-primary hover:underline"
                                          onClick={() => handleEditMessage(msg.id)}
                                        >
                                          Save
                                        </button>
                                        <button
                                          className="text-muted-foreground hover:underline"
                                          onClick={() => {
                                            setEditingMessageId(null);
                                            setEditContent("");
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="text-sm">
                                        <MessageContent
                                          content={msg.content}
                                          currentUserId={user?.id}
                                          messageId={msg.id}
                                          messageUser={
                                            msgCachedUser
                                              ? {
                                                  id: msgCachedUser.id,
                                                  username: msgCachedUser.username,
                                                  display_name: msgCachedUser.display_name,
                                                }
                                              : msg.user
                                                ? {
                                                    id: msg.user.id,
                                                    username: msg.user.username,
                                                    display_name: msg.user.display_name,
                                                  }
                                                : null
                                          }
                                        />
                                      </div>

                                      {/* Reactions */}
                                      {msg.reactions && msg.reactions.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                          {msg.reactions.map((reaction) => {
                                            const reactionUserNames = reaction.users
                                              .slice(0, 5)
                                              .map((reactorId) => getReactionDisplayName(reactorId));
                                            const remainingCount = Math.max(0, reaction.users.length - 5);

                                            return (
                                              <HoverCard key={reaction.emoji} openDelay={200}>
                                                <HoverCardTrigger asChild>
                                                  <button
                                                    onClick={() => handleAddReaction(msg.id, reaction.emoji)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1 text-sm rounded-md border transition-colors duration-200 ${
                                                      reaction.hasReacted
                                                        ? "bg-primary/20 border-primary text-primary"
                                                        : "bg-secondary border-transparent hover:border-border"
                                                    }`}
                                                  >
                                                    {reactionEmojiNode(reaction.emoji)}
                                                    <span className="text-xs">{reaction.count}</span>
                                                  </button>
                                                </HoverCardTrigger>
                                                <HoverCardContent className="w-auto p-2" align="start" side="top">
                                                  <div className="flex items-center gap-2">
                                                    <div className="shrink-0 text-2xl">
                                                      {reactionEmojiNode(reaction.emoji)}
                                                    </div>
                                                    <div className="min-w-0 text-sm">
                                                      <span className="text-muted-foreground">reacted by </span>
                                                      {reactionUserNames.map((name, idx) => (
                                                        <span key={`${reaction.emoji}-${idx}`}>
                                                          <span className="font-medium">{name}</span>
                                                          {idx < reactionUserNames.length - 1 ? ", " : ""}
                                                        </span>
                                                      ))}
                                                      {remainingCount > 0 && (
                                                        <span className="text-muted-foreground">
                                                          {" "}
                                                          and {remainingCount} others
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                </HoverCardContent>
                                              </HoverCard>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Hover actions menu */}
                                {(isHovered || showEmojiPicker === msg.id) && !isEditing && (
                                  <div
                                    className="hover-actions-menu absolute right-2 -top-4 z-50 flex items-center gap-1 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-xl p-1 transition-opacity duration-200"
                                    onMouseEnter={() => setHoveredMessageId(msg.id)}
                                    onMouseLeave={(e) => {
                                      const relatedTarget = e.relatedTarget as HTMLElement;
                                      if (!relatedTarget || !relatedTarget.closest('[role="dialog"]')) {
                                        setHoveredMessageId(null);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {/* Add Reaction */}
                                    <EmojiGifPicker
                                      open={showEmojiPicker === msg.id}
                                      onOpenChange={(open) => {
                                        setShowEmojiPicker(open ? msg.id : null);
                                        if (open) {
                                          setHoveredMessageId(msg.id);
                                        }
                                      }}
                                      onEmojiSelect={(emoji) => {
                                        handleAddReaction(msg.id, emoji);
                                      }}
                                      disableGif
                                      serverId={currentServer?.id}
                                      serverName={currentServer?.name}
                                    >
                                      <button
                                        type="button"
                                        className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                        aria-label="Add reaction"
                                        title="Add reaction"
                                        onMouseDown={(e) => e.preventDefault()}
                                      >
                                        <Smile className="w-4 h-4" />
                                      </button>
                                    </EmojiGifPicker>

                                    {/* Reply */}
                                    {canReplyToSelectedThread && (
                                      <button
                                        type="button"
                                        className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setReplyingToThread(msg.id);
                                        }}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        aria-label="Reply"
                                        title="Reply"
                                      >
                                        <Reply className="w-4 h-4" />
                                      </button>
                                    )}

                                    {/* Edit (own messages) */}
                                    {isOwnMessage && (
                                      <button
                                        type="button"
                                        className="p-2 rounded-lg bg-transparent hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setEditingMessageId(msg.id);
                                          setEditContent(msg.content);
                                          setTimeout(() => editTextareaRef.current?.focus(), 0);
                                        }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        aria-label="Edit"
                                        title="Edit"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                    )}

                                    <div className="w-px h-5 bg-border mx-0.5" />

                                    {/* Delete (own messages or admins) */}
                                    {canDeleteMessage && (
                                      <button
                                        type="button"
                                        className="p-2 rounded-lg bg-transparent hover:bg-destructive/10 transition-colors text-destructive"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setMessageToDelete(msg);
                                          setShowDeleteModal(true);
                                        }}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        aria-label="Delete"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-8">Loading messages...</div>
                      )}
                    </div>

                    {/* Reply Input */}
                    {selectedThreadId && renderThreadReplyComposer(selectedThreadId)}
                  </div>
                )}
              </DrawerContent>
            </Drawer>
          );
        })()}
      </div>

      <input
        ref={forumAttachmentInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        hidden
        onChange={handleAttachmentInputChange}
      />

      {/* Delete Message Modal */}
      {messageToDelete && (
        <DeleteMessageModal
          open={showDeleteModal}
          onOpenChange={setShowDeleteModal}
          onConfirm={() => handleDeleteMessage(messageToDelete.id)}
          messageContent={messageToDelete.content}
        />
      )}

      {/* Delete Thread Confirmation Modal */}
      <AlertDialog open={showDeleteThreadModal} onOpenChange={setShowDeleteThreadModal}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Thread</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this thread? This will remove the thread and all its replies. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {threadToDelete?.message?.content && (
            <div className="my-2 p-3 bg-secondary rounded-lg border border-border">
              <p className="text-sm text-muted-foreground line-clamp-3">
                {threadToDelete.message.content.split("\n\n")[0] || "No content"}
              </p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setThreadToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => threadToDelete && handleDeleteThread(threadToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
