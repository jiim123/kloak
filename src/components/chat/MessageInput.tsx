import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMessageUser } from "@/stores/userCacheStore";
import {
  Paperclip,
  Smile,
  Send,
  X,
  Loader2,
  WifiOff,
  Lock,
  SquareChartGantt,
  ImagePlay,
  Info,
  Check,
  Pencil,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useDMStore } from "@/stores/dmStore";
import { useEditStore } from "@/stores/editStore";
import { useServerStore } from "@/stores/serverStore";
import { useChannelSettingsStore } from "@/stores/channelSettingsStore";
import { useOfflineQueueStore } from "@/stores/offlineQueueStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { saveDraft, getDraft, clearDraft } from "@/lib/storage";
import { isImageOnlyMessage } from "@/lib/message";
import { ReplyPreview } from "./MessageContent";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { ChannelAutocomplete } from "./ChannelAutocomplete";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { GifPicker } from "@/components/chat/GifPicker";
import { CreatePollModal } from "@/components/modals/CreatePollModal";
import { SelectionFormatToolbar, FORMAT_SYNTAX, getCodeBlockSyntax } from "./FormatToolbar";
import { AttachmentPreviewBar, PendingAttachment } from "./AttachmentPreviewBar";
import { secureUpload } from "@/lib/storageUpload";
import { compressAttachmentImage } from "@/lib/imageCompression";
import { supabase } from "@/integrations/supabase/client";
import { showWarning, handleError } from "@/lib/errorHandler";
import { messageRateLimiter, validateMessageContent } from "@/lib/security";
import { canRevealGhostIdentityForUser } from "@/lib/ghostIdentity";
import { encodeCustomEmojisForTransport } from "@/lib/globalEmojiResolver";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { useServerEmojis } from "@/hooks/useServerEmojis";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { MessageAttachment } from "@/types";

export interface DMInputConfig {
  conversationId: string;
  otherUsername: string;
  replyingTo?: { id: string; sender?: { username?: string; display_name?: string | null }; content: string } | null;
  onCancelReply?: () => void;
}

export interface ForumThreadInputConfig {
  threadId: string;
  onSend: (content: string, replyToId: string | null) => Promise<void>;
  replyingTo?: { id: string; user_id: string; content: string } | null;
  onCancelReply?: () => void;
  isClosed?: boolean;
  placeholder?: string;
}

interface MessageInputProps {
  channelId?: string;
  channelName?: string;
  onTyping?: () => void;
  onStopTyping?: () => void;
  onSlowmodeStatusChange?: (status: {
    enabled: boolean;
    blocked: boolean;
    immune: boolean;
    remainingSeconds: number;
  }) => void;
  dmConfig?: DMInputConfig;
  forumConfig?: ForumThreadInputConfig;
}

interface MentionMapping {
  label: string;
  mentionId: string;
  mentionType: "user" | "role";
}

interface ChannelMapping {
  channelName: string;
  channelId: string;
}

interface PreparedAttachment {
  pending: PendingAttachment;
  storagePath: string | null;
  contentUrl: string;
  optimisticAttachment: MessageAttachment;
}

const MAX_LENGTH = 2000;
const MIN_TEXTAREA_HEIGHT = 40;
const MAX_TEXTAREA_HEIGHT = 160;
const ALLOWED_FILE_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
  "audio/flac",
  "application/pdf",
  "text/plain",
  "application/zip",
  "application/x-rar-compressed",
  "application/gzip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/json",
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_ATTACHMENTS = 10;
const ALLOWED_FILE_EXTENSIONS =
  ".jpg,.jpeg,.png,.gif,.webp,.avif,.svg,.mp4,.webm,.mov,.mp3,.ogg,.wav,.flac,.m4a,.pdf,.txt,.zip,.rar,.gz,.doc,.docx,.xls,.xlsx,.json";
const DRAFT_SAVE_DELAY = 500;
const TYPING_STOP_DELAY = 2000;
const KLOAK_ATTACHMENT_PREFIX = "kloak-attachment://";

// Memoized action bar (full-width bottom bar)
const ActionBar = memo(
  ({
    showCreatePoll,
    setShowCreatePoll,
    showEmojiPicker,
    setShowEmojiPicker,
    showGifPicker,
    setShowGifPicker,
    canSendMessage,
    content,
    isSending,
    hasAttachments,
    canSubmitMessage,
    onSubmit,
    onEmojiSelect,
    onGifSelect,
    currentServer,
    onAttachClick,
    allowExternalEmojis,
  }: any) => {
    const showCharacterWarning = content.length > MAX_LENGTH - 200;
    const isMobile = useIsMobile();
    const canSend = (content.trim() || hasAttachments) && !isSending && canSubmitMessage;

    const iconBtnClass =
      "flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/6 hover:text-foreground transition-colors";

    return (
      <div className="flex items-center justify-between px-2 sm:px-3 pb-2 pt-0.5">
        {/* Left actions */}
        <div className="flex items-center gap-0.5">
          {onAttachClick && (
            <button onClick={onAttachClick} disabled={!canSendMessage} className={iconBtnClass}>
              <Paperclip className="w-5 h-5" />
            </button>
          )}
          {setShowCreatePoll && (
            <>
              <div className="w-px h-5 bg-foreground/8 mx-0.5" />
              <button
                type="button"
                onClick={() => setShowCreatePoll(true)}
                disabled={!canSendMessage}
                className={iconBtnClass}
              >
                <SquareChartGantt className="w-5 h-5" />
              </button>
            </>
          )}

          <div className="w-px h-5 bg-foreground/8 mx-0.5" />

          <EmojiPicker
            open={showEmojiPicker}
            onOpenChange={setShowEmojiPicker}
            onEmojiSelect={onEmojiSelect}
            serverId={currentServer?.id}
            allowExternalEmojis={allowExternalEmojis}
          >
            <button type="button" className={iconBtnClass} onMouseDown={(e) => e.preventDefault()}>
              <Smile className="w-5 h-5" />
            </button>
          </EmojiPicker>

          {setShowGifPicker && (
            <GifPicker open={showGifPicker} onOpenChange={setShowGifPicker} onSelect={onGifSelect}>
              <button type="button" className={iconBtnClass} onMouseDown={(e) => e.preventDefault()}>
                <ImagePlay className="w-5 h-5" />
              </button>
            </GifPicker>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          <AnimatePresence>
            {showCharacterWarning && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={`text-[13px] font-sans ${content.length > MAX_LENGTH - 50 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {MAX_LENGTH - content.length}
              </motion.span>
            )}
          </AnimatePresence>
          <button
            onClick={onSubmit}
            disabled={!canSend}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
              canSend
                ? "bg-foreground/10 text-foreground hover:bg-foreground/16 active:scale-95"
                : "bg-foreground/5 text-muted-foreground/50 cursor-not-allowed"
            }`}
          >
            <AnimatePresence mode="wait">
              {isSending ? (
                <motion.span
                  key="loader"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                </motion.span>
              ) : (
                <motion.span
                  key="send"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="flex items-center justify-center"
                >
                  <Send className="w-4 h-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </div>
    );
  },
);
ActionBar.displayName = "ActionBar";

export const MessageInput = ({
  channelId,
  channelName,
  onTyping,
  onStopTyping,
  onSlowmodeStatusChange,
  dmConfig,
  forumConfig,
}: MessageInputProps) => {
  const isForum = !!forumConfig;
  const isDM = !isForum && !!dmConfig;
  const targetId = isForum ? forumConfig!.threadId : isDM ? dmConfig!.conversationId : channelId!;
  const { user } = useAuthStore();
  const { replyingTo: channelReplyingTo, setReplyingTo: channelSetReplyingTo, sendMessage: channelSendMessage, editMessage: channelEditMessage } = useMessageStore();
  const { sendMessage: dmSendMessage, editMessage: dmEditMessage } = useDMStore();
  const { editingMessage, cancelEditing } = useEditStore();
  const { members, currentServer, currentChannel, channels, fetchRolePermissions } = useServerStore();
  const { getQueuedForChannel } = useOfflineQueueStore();
  const isMobile = useIsMobile();

  // Is this input currently in edit mode?
  const isEditMode = !!editingMessage && editingMessage.channelId === targetId;

  // Unified reply state
  const replyingTo = isForum ? forumConfig?.replyingTo : isDM ? dmConfig?.replyingTo : channelReplyingTo;
  const setReplyingTo = isForum ? ((_: any) => {}) : isDM ? ((_: any) => {}) : channelSetReplyingTo;
  const sendMessage = isDM ? dmSendMessage : channelSendMessage;
  const forumConfigRef = useRef(forumConfig);
  forumConfigRef.current = forumConfig;

  // Draft preservation for edit mode
  const savedDraftRef = useRef<string | null>(null);

  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [hasMentionOptions, setHasMentionOptions] = useState(false);
  const [showChannels, setShowChannels] = useState(false);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelStartIndex, setChannelStartIndex] = useState(-1);
  const [hasChannelOptions, setHasChannelOptions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [slowmodeCooldownByChannel, setSlowmodeCooldownByChannel] = useState<Record<string, number>>({});
  const [slowmodeNowMs, setSlowmodeNowMs] = useState(() => Date.now());
  const [showChatNoticePopup, setShowChatNoticePopup] = useState(false);
  const [isAcknowledgingChatNotice, setIsAcknowledgingChatNotice] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionMappingsRef = useRef<MentionMapping[]>([]);
  const channelMappingsRef = useRef<ChannelMapping[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const draftKey = isForum ? `forum-${targetId}` : isDM ? `dm-${targetId}` : targetId;
    if (draftKey) {
      setContent(getDraft(draftKey));
    }
    return () => {
      setPendingAttachments((prev) => {
        prev.forEach((a) => {
          if (!a.gifUrl) URL.revokeObjectURL(a.preview);
        });
        return [];
      });
    };
  }, [targetId, isDM]);

  // Enter/exit edit mode — save/restore draft and populate edit content
  const prevEditingIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentEditId = isEditMode ? editingMessage!.id : null;
    if (currentEditId === prevEditingIdRef.current) return;

    if (currentEditId && !prevEditingIdRef.current) {
      // Entering edit mode — save current draft, load edit content
      savedDraftRef.current = content;
      setContent(editingMessage!.content);
      setPendingAttachments([]);
      requestAnimationFrame(() => {
        const t = textareaRef.current;
        if (t) {
          t.focus();
          const len = t.value.length;
          t.setSelectionRange(len, len);
          // Resize to fit edit content
          t.style.height = "0px";
          t.style.height = `${Math.min(Math.max(t.scrollHeight, 40), 160)}px`;
        }
      });
    } else if (!currentEditId && prevEditingIdRef.current) {
      // Exiting edit mode — restore draft
      setContent(savedDraftRef.current || "");
      savedDraftRef.current = null;
      requestAnimationFrame(() => {
        const t = textareaRef.current;
        if (t) {
          t.style.height = "0px";
          t.style.height = `${Math.min(Math.max(t.scrollHeight, 40), 160)}px`;
        }
      });
    }

    prevEditingIdRef.current = currentEditId;
  }, [isEditMode, editingMessage?.id, editingMessage?.content]);

  // Auto-focus text input when switching channels/conversations
  useEffect(() => {
    if (targetId) {
      const t = textareaRef.current;
      if (t) {
        const id = requestAnimationFrame(() => {
          t.focus();
        });
        return () => cancelAnimationFrame(id);
      }
    }
  }, [targetId]);

  // Focus composer when user starts replying from a message action.
  useEffect(() => {
    if (!replyingTo) return;
    const t = textareaRef.current;
    if (!t) return;
    const id = requestAnimationFrame(() => {
      t.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [replyingTo]);

  // DM-specific: focus when reply changes via dmConfig
  useEffect(() => {
    if (isDM && dmConfig?.replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isDM, dmConfig?.replyingTo]);

  const { hasPermission } = useMemberPermissions(isDM ? undefined : channelId);
  const markChatNoticeSeen = useChannelSettingsStore((state) => state.markChatNoticeSeen);
  const chatNoticeSeenAt = useChannelSettingsStore((state) => (channelId ? state.settings[channelId]?.chat_notice_seen_at ?? null : null));
  const currentMember = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user?.id]);
  const isMuted = isDM ? false : (currentMember?.is_muted || false);
  const activeChannel = useMemo(
    () => isDM ? null : (channels.find((c) => c.id === channelId) || currentChannel || null),
    [channels, channelId, currentChannel, isDM],
  );
  const isReadOnlyChannel = isDM ? false : (activeChannel?.is_read_only || false);
  const isGhostMode = isDM ? false : (activeChannel?.ghost_mode || false);
  const slowmodeSeconds = isDM || isForum ? 0 : Math.max(0, Number(activeChannel?.slowmode_seconds) || 0);
  const canSendMessagesPermission = isDM ? true : hasPermission("send_messages");
  const canSendInReadOnly = isDM ? true : (isReadOnlyChannel ? hasPermission("manage_messages") : true);
  const canSendMessage = isDM ? true : (!isMuted && canSendMessagesPermission && canSendInReadOnly);
  const canManageMessages = isDM ? false : hasPermission("manage_messages");
  const canAttachFiles = isDM ? true : hasPermission("attach_files");
  const blockAttachments = isDM ? false : (activeChannel?.block_attachments || false);
  const effectiveCanAttach = canAttachFiles && !(blockAttachments && !canManageMessages);
  const disablePolls = isDM ? false : (activeChannel?.disable_polls || false);
  const effectiveCanCreatePoll = !(disablePolls && !canManageMessages);
  const canMentionEveryone = isDM ? true : hasPermission("mention_everyone");
  const canMentionRoles = isDM ? true : hasPermission("mention_roles");
  const canUseExternalEmojis = isDM ? true : hasPermission("use_external_emojis");
  const { emojis: serverEmojisForCheck } = useServerEmojis(isDM ? null : currentServer?.id);
  const isSlowmodeEnabled = slowmodeSeconds > 0;
  const isSlowmodeExempt = canManageMessages;
  const slowmodeCooldownUntil = isDM ? 0 : (slowmodeCooldownByChannel[targetId] || 0);
  const slowmodeRemainingSeconds = Math.max(0, Math.ceil((slowmodeCooldownUntil - slowmodeNowMs) / 1000));
  const isSlowmodeBlocked = isSlowmodeEnabled && !isSlowmodeExempt && slowmodeRemainingSeconds > 0;
  const canSubmitMessage = canSendMessage && !isSlowmodeBlocked;
  const activeChatNotice = isDM || isForum ? "" : (activeChannel?.chat_notice ?? "").trim();
  const requiresChatNoticeAck = !isDM && !isForum && activeChatNotice.length > 0 && !chatNoticeSeenAt;
  const isComposerLockedByNotice = requiresChatNoticeAck;
  // In DM mode the reply shape has no user_id — extract it safely
  const replyUserId = isDM ? undefined : (replyingTo as any)?.user_id;
  const replyingToUser = useMessageUser(replyUserId);
  const showReplyAuthorIdentity = useMemo(
    () =>
      canRevealGhostIdentityForUser({
        isGhostMode,
        authorUserId: replyUserId,
        members,
        ownerId: currentServer?.owner_id,
      }),
    [isGhostMode, replyUserId, members, currentServer?.owner_id],
  );

  const resizeTextarea = useCallback(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    if (slowmodeCooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setSlowmodeNowMs(now);
      if (now >= slowmodeCooldownUntil) {
        window.clearInterval(timer);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [slowmodeCooldownUntil]);

  useEffect(() => {
    setShowChatNoticePopup(false);
    setIsAcknowledgingChatNotice(false);
  }, [channelId]);

  useEffect(() => {
    if (!requiresChatNoticeAck) {
      setShowChatNoticePopup(false);
    }
  }, [requiresChatNoticeAck]);

  const openChatNoticePopup = useCallback(() => {
    if (!requiresChatNoticeAck) return false;
    setShowChatNoticePopup(true);
    return true;
  }, [requiresChatNoticeAck]);

  const handleAcknowledgeChatNotice = useCallback(async () => {
    if (!requiresChatNoticeAck || isAcknowledgingChatNotice) return;
    setIsAcknowledgingChatNotice(true);
    try {
      await markChatNoticeSeen(channelId);
      setShowChatNoticePopup(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    } finally {
      setIsAcknowledgingChatNotice(false);
    }
  }, [requiresChatNoticeAck, isAcknowledgingChatNotice, markChatNoticeSeen, channelId]);

  useEffect(() => {
    onSlowmodeStatusChange?.({
      enabled: isSlowmodeEnabled,
      blocked: isSlowmodeBlocked,
      immune: isSlowmodeExempt,
      remainingSeconds: slowmodeRemainingSeconds,
    });
  }, [onSlowmodeStatusChange, isSlowmodeEnabled, isSlowmodeBlocked, isSlowmodeExempt, slowmodeRemainingSeconds]);

  const detectAutocomplete = useCallback((value: string, pos: number) => {
    const textBefore = value.slice(0, pos);
    const atIdx = textBefore.lastIndexOf("@");
    if (atIdx !== -1 && !textBefore.slice(atIdx).includes(" ")) {
      setMentionQuery(textBefore.slice(atIdx + 1));
      setMentionStartIndex(atIdx);
      setShowMentions(true);
    } else {
      setShowMentions(false);
      setHasMentionOptions(false);
    }

    const hashIdx = textBefore.lastIndexOf("#");
    if (hashIdx !== -1 && !textBefore.slice(hashIdx).includes(" ")) {
      setChannelQuery(textBefore.slice(hashIdx + 1));
      setChannelStartIndex(hashIdx);
      setShowChannels(true);
    } else {
      setShowChannels(false);
      setHasChannelOptions(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isDM && !isForum && openChatNoticePopup()) return;
    const val = e.target.value;
    if (val.length > MAX_LENGTH) return;
    setContent(val);
    resizeTextarea();
    if (!isDM && !isForum && onTyping) {
      onTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(onStopTyping!, TYPING_STOP_DELAY);
    }
    if (!isDM) {
      detectAutocomplete(val, e.target.selectionStart);
    }
    // Don't save draft while editing — draft is preserved in savedDraftRef
    if (!isEditMode) {
      const draftKey = isForum ? `forum-${targetId}` : isDM ? `dm-${targetId}` : targetId;
      saveDraft(draftKey, val);
    }
  };

  const convertMentionsForSend = useCallback((text: string): string => {
    let result = text;
    mentionMappingsRef.current.forEach((m) => {
      const regex = new RegExp(`@${m.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|[.,!?;:])`, "g");
      const token = m.mentionType === "role" ? `<@&${m.mentionId}>` : `<@${m.mentionId}>`;
      result = result.replace(regex, token);
    });
    channelMappingsRef.current.forEach((c) => {
      const regex = new RegExp(`#${c.channelName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<#${c.channelId}>`);
    });
    return result;
  }, []);

  const handleCancelEdit = useCallback(() => {
    cancelEditing();
  }, [cancelEditing]);

  const prepareAttachmentsForMessage = useCallback(
    (attachments: PendingAttachment[]): PreparedAttachment[] => {
      if (!user?.id) return [];

      return attachments.map((attachment, index) => {
        if (attachment.gifUrl) {
          return {
            pending: attachment,
            storagePath: null,
            contentUrl: attachment.gifUrl,
            optimisticAttachment: {
              id: `temp-att-${Date.now()}-${index}`,
              message_id: "",
              file_url: attachment.gifUrl,
              file_name: attachment.file.name || "gif",
              file_type: "image/gif",
              file_size: null,
              width: null,
              height: null,
            },
          };
        }

        const ext = attachment.file.name.split(".").pop() || "bin";
        const storagePath = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        return {
          pending: attachment,
          storagePath,
          contentUrl: `${KLOAK_ATTACHMENT_PREFIX}${storagePath}`,
          optimisticAttachment: {
            id: `temp-att-${Date.now()}-${index}`,
            message_id: "",
            file_url: attachment.preview || `${KLOAK_ATTACHMENT_PREFIX}${storagePath}`,
            file_name: attachment.file.name,
            file_type: attachment.file.type || null,
            file_size: attachment.file.size || null,
            width: null,
            height: null,
          },
        };
      });
    },
    [user?.id],
  );

  const handleSubmit = useCallback(async () => {
    // --- EDIT MODE ---
    if (isEditMode && editingMessage && user) {
      const trimmed = content.trim();
      if (!trimmed) return;
      setIsSending(true);
      try {
        if (editingMessage.isDM) {
          await dmEditMessage(editingMessage.id, user.id, trimmed);
        } else {
          const finalContent = convertMentionsForSend(trimmed);
          await channelEditMessage(editingMessage.id, finalContent, user.id);
        }
        cancelEditing();
      } catch (error) {
        handleError(error, "Failed to edit message");
      } finally {
        setIsSending(false);
      }
      return;
    }

    // --- NORMAL SEND MODE ---
    // Channel-only checks (skip for forum and DM)
    if (!isDM && !isForum) {
      if (openChatNoticePopup()) return;
      if (!canSendMessage) return;
      if (isSlowmodeBlocked) return;
      if (user && !messageRateLimiter.isAllowed(user.id)) {
        showWarning("Slow down!", `Try again in ${messageRateLimiter.getRemainingTime(user.id)}s`);
        return;
      }
    }
    // Forum: check send permission
    if (isForum && !canSendMessage) return;

    const trimmedContent = content.trim();

    const hasGifOrAttachments = pendingAttachments.length > 0;
    if ((!trimmedContent && !hasGifOrAttachments) || !user || isSending) return;

    setIsSending(true);
    const contentToSend = isDM ? content.trim() : convertMentionsForSend(content.trim());

    // Check mention permissions AFTER conversion (role mentions are now in <@&uuid> format)
    if (!isDM) {
      if (!canMentionEveryone && (contentToSend.includes('@everyone') || contentToSend.includes('@here'))) {
        toast.error("You don't have permission to mention @everyone in this channel");
        setIsSending(false);
        return;
      }
      if (!canMentionRoles && /<@&[0-9a-f-]{36}>/.test(contentToSend)) {
        toast.error("You don't have permission to mention roles in this channel");
        setIsSending(false);
        return;
      }
      // Block external custom emojis before sending
      if (!canUseExternalEmojis) {
        const customEmojiPattern = /:([a-z0-9_]{2,12})(?:~[^:]+)?:/gi;
        const localEmojiNames = new Set<string>();
        try {
          const emojis = await fetchServerEmojis(currentServer?.id ?? '');
          emojis.forEach(e => localEmojiNames.add(e.name));
        } catch { /* ignore */ }

        let match;
        let hasExternal = false;
        while ((match = customEmojiPattern.exec(contentToSend)) !== null) {
          if (!localEmojiNames.has(match[1])) {
            hasExternal = true;
            break;
          }
        }

        if (hasExternal) {
          toast.error("You don't have permission to use external emojis in this channel");
          setIsSending(false);
          return;
        }
      }
    }
    const transportReadyContent = await encodeCustomEmojisForTransport(contentToSend);

    try {
      let finalContent = transportReadyContent;

      if (isForum) {
        const uploadedUrls: string[] = [];
        const gifAttachments = pendingAttachments.filter((a) => a.gifUrl);
        const fileAttachments = pendingAttachments.filter((a) => !a.gifUrl);
        if (fileAttachments.length > 0) {
          setPendingAttachments((prev) => prev.map((a) => (a.gifUrl ? a : { ...a, uploading: true })));
          for (const att of fileAttachments) {
            let fileToUpload = att.file;
            if (fileToUpload.type.startsWith("image/")) {
              fileToUpload = await compressAttachmentImage(fileToUpload);
            }
            const ext = fileToUpload.name.split(".").pop() || "bin";
            const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
            const res = await secureUpload("attachments", fileName, fileToUpload, { contentType: fileToUpload.type });
            uploadedUrls.push(res.publicUrl);
          }
        }
        for (const gif of gifAttachments) {
          uploadedUrls.push(gif.gifUrl!);
        }
        if (uploadedUrls.length > 0) {
          const urlBlock = uploadedUrls.join("\n");
          finalContent = finalContent ? `${finalContent}\n${urlBlock}` : urlBlock;
        }

        // Forum mode: delegate to forumConfig.onSend
        const replyToId = forumConfigRef.current?.replyingTo?.id || null;
        await forumConfigRef.current!.onSend(finalContent, replyToId);
      } else {
        const preparedAttachments = prepareAttachmentsForMessage(pendingAttachments);
        const attachmentUrls = preparedAttachments.map((attachment) => attachment.contentUrl);
        if (attachmentUrls.length > 0) {
          const urlBlock = attachmentUrls.join("\n");
          finalContent = finalContent ? `${finalContent}\n${urlBlock}` : urlBlock;
        }

        // Channel / DM mode
        const replyToId = isDM ? dmConfig?.replyingTo?.id : channelReplyingTo?.id;
        const sentMessage = await sendMessage(targetId, user.id, finalContent, replyToId, {
          optimisticAttachments: preparedAttachments.map((attachment) => attachment.optimisticAttachment),
        });
        if (!sentMessage) return;

        const draftKey = isForum ? `forum-${targetId}` : isDM ? `dm-${targetId}` : targetId;
        setContent("");
        setPendingAttachments([]);
        clearDraft(draftKey);
        if (textareaRef.current) textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;

        void (async () => {
          try {
            if (preparedAttachments.some((attachment) => attachment.storagePath)) {
              for (const attachment of preparedAttachments) {
                if (!attachment.storagePath) continue;
                let fileToUpload = attachment.pending.file;
                if (fileToUpload.type.startsWith("image/")) {
                  fileToUpload = await compressAttachmentImage(fileToUpload);
                }
                await secureUpload("attachments", attachment.storagePath, fileToUpload, {
                  contentType: fileToUpload.type,
                });
              }
            }

            const persistedAttachments = preparedAttachments
              .map((attachment, i) => ({
                message_id: sentMessage.id,
                file_url: attachment.contentUrl,
                file_name: attachment.optimisticAttachment.file_name || `attachment-${i + 1}`,
                file_type: attachment.optimisticAttachment.file_type || null,
                file_size: attachment.optimisticAttachment.file_size || null,
              }))
              .filter((attachment) => !!attachment.file_url);

            if (persistedAttachments.length === 0) return;

            const { data: insertedAttachments, error: attachError } = await supabase
              .from(isDM ? "dm_attachments" : "message_attachments")
              .insert(persistedAttachments)
              .select();

            if (attachError) {
              throw attachError;
            }

            if (insertedAttachments && insertedAttachments.length > 0) {
              const formattedAttachments = insertedAttachments.map((a: any) => ({
                id: a.id,
                message_id: a.message_id,
                file_url: a.file_url,
                file_name: a.file_name,
                file_type: a.file_type,
                file_size: a.file_size,
                width: a.width,
                height: a.height,
              }));

              if (isDM) {
                useDMStore.getState().updateMessage(targetId, sentMessage.id, {
                  attachments: formattedAttachments,
                });
              } else {
                useMessageStore.getState().updateMessage(sentMessage.id, {
                  channel_id: targetId,
                  attachments: formattedAttachments,
                } as any);
              }
            }
          } catch (attachmentError) {
            console.error("[MessageInput] Attachment finalize error:", attachmentError);
            toast.error("Attachment upload is still processing", {
              description: "Your message was sent, but one or more attachments could not be finalized.",
            });
          }
        })();

        // DM: update presence after send
        if (isDM) {
          const auth = useAuthStore.getState();
          if (auth.manualStatus !== "offline") auth.updateLastSeen();
          if (auth.manualStatus !== "offline" && auth.manualStatus !== "dnd") {
            auth.updateStatus("online", { source: "auto" });
          }
        }
      }

      // Common cleanup
      if (isForum) {
        setContent("");
        setPendingAttachments([]);
        const draftKey = `forum-${targetId}`;
        clearDraft(draftKey);
        if (textareaRef.current) textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
      }

      if (isForum) {
        forumConfigRef.current?.onCancelReply?.();
        mentionMappingsRef.current = [];
        channelMappingsRef.current = [];
      } else if (isDM) {
        dmConfig?.onCancelReply?.();
      } else {
        channelSetReplyingTo(null);
        mentionMappingsRef.current = [];
        channelMappingsRef.current = [];
        window.dispatchEvent(
          new CustomEvent("channelMessageSent", {
            detail: { channelId: targetId },
          }),
        );

        if (isSlowmodeEnabled && !isSlowmodeExempt) {
          const cooldownUntil = Date.now() + slowmodeSeconds * 1000;
          setSlowmodeCooldownByChannel((prev) => ({ ...prev, [targetId]: cooldownUntil }));
          setSlowmodeNowMs(Date.now());
        }
      }
    } catch (error) {
      handleError(error, "Failed to send");
    } finally {
      setIsSending(false);
    }
  }, [
    isDM,
    isForum,
    isEditMode,
    editingMessage,
    dmConfig,
    openChatNoticePopup,
    content,
    pendingAttachments,
    user,
    targetId,
    channelReplyingTo,
    canSendMessage,
    isSlowmodeBlocked,
    isSending,
    convertMentionsForSend,
    sendMessage,
    channelSetReplyingTo,
    channelEditMessage,
    dmEditMessage,
    cancelEditing,
    isSlowmodeEnabled,
    isSlowmodeExempt,
    slowmodeSeconds,
    canMentionEveryone,
    canMentionRoles,
  ]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!user || isSending) return;
      // Prefer clipboardData.files — it de-duplicates across browsers
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) return;
      const pasteFile = Array.from(files).find((f) => ALLOWED_FILE_TYPES.includes(f.type));
      if (!pasteFile) return;
      if (!canAttachFiles || (blockAttachments && !canManageMessages)) {
        e.preventDefault();
        toast.error(blockAttachments ? "Attachments are not allowed in this channel" : "You don't have permission to attach files in this channel");
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const attachment = {
        file: pasteFile,
        preview: pasteFile.type.startsWith("image/") ? URL.createObjectURL(pasteFile) : "",
      };
      setPendingAttachments((prev) => [...prev, attachment].slice(0, MAX_ATTACHMENTS));
    },
    [user, isSending, canAttachFiles, blockAttachments, canManageMessages],
  );

  const handleFormat = (type: string, val?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const syntax = type === "codeblock" ? getCodeBlockSyntax(val || "") : FORMAT_SYNTAX[type];
    if (!syntax) return;

    const newContent =
      content.slice(0, start) + syntax.prefix + (selected || "text") + syntax.suffix + content.slice(end);
    setContent(newContent);
    textarea.focus();
  };

  const handleComposerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Escape cancels editing
      if (e.key === "Escape" && isEditMode) {
        e.preventDefault();
        handleCancelEdit();
        return;
      }

      if (!isDM && requiresChatNoticeAck) {
        const isTypingAction = e.key.length === 1 || e.key === "Enter" || e.key === "Backspace" || e.key === "Delete";
        if (isTypingAction && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          openChatNoticePopup();
          return;
        }
      }

      if (!isDM) {
        const isAutocompleteOpen = (showMentions && hasMentionOptions) || (showChannels && hasChannelOptions);
        const autocompleteKeys = ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"];
        if (isAutocompleteOpen && autocompleteKeys.includes(e.key)) {
          e.preventDefault();
          return;
        }
      }

      // Restore Discord-like "edit your last message" shortcut (channel only).
      if (!isDM && !isForum && !isEditMode && e.key === "ArrowUp" && !isMobile && !content.trim() && pendingAttachments.length === 0 && user?.id) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("editLastMessage", {
            detail: { userId: user.id, channelId: targetId },
          }),
        );
        return;
      }

      // Format shortcuts (all modes: channel, DM, forum, reply, edit, etc.)
      if (e.ctrlKey || e.metaKey) {
        const formatMap: Record<string, string> = { b: "bold", i: "italic", u: "underline", c: "code", k: "codeblock", s: "spoiler" };
        const fmt = formatMap[e.key.toLowerCase()];
        if (fmt) {
          e.preventDefault();
          e.stopPropagation();
          handleFormat(fmt);
          return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey && !isMobile) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [
      isDM,
      showMentions,
      requiresChatNoticeAck,
      openChatNoticePopup,
      hasMentionOptions,
      showChannels,
      hasChannelOptions,
      isEditMode,
      handleCancelEdit,
      isMobile,
      content,
      pendingAttachments.length,
      user?.id,
      targetId,
      handleSubmit,
    ],
  );

  if (isForum && forumConfig?.isClosed) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center py-4 bg-muted/30 rounded-2xl border border-border/50">
          <Lock className="w-4 h-4 mr-2 text-muted-foreground" />
          <span className="text-muted-foreground">This topic is closed</span>
        </div>
      </div>
    );
  }

  if (!isDM && !isForum && (isMuted || (!canSendInReadOnly && isReadOnlyChannel))) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center py-4 bg-muted/30 rounded-2xl border border-border/50">
          <span className="text-muted-foreground">{isMuted ? "You are muted" : "Read-only channel"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 sm:pb-5 relative bg-transparent">
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_FILE_EXTENSIONS}
        multiple
        hidden
        onChange={(e) => {
          if (!effectiveCanAttach) {
            toast.error(blockAttachments ? "Attachments are not allowed in this channel" : "You don't have permission to attach files in this channel");
            e.target.value = "";
            return;
          }
          if (e.target.files) {
            const files = Array.from(e.target.files).filter((f) => {
              if (!ALLOWED_FILE_TYPES.includes(f.type)) {
                return false;
              }
              if (f.size > MAX_FILE_SIZE) {
                return false;
              }
              return true;
            });
            const mapped = files.map((f) => ({
              file: f,
              preview: f.type.startsWith("image/") ? URL.createObjectURL(f) : "",
            }));
            setPendingAttachments((prev) => [...prev, ...mapped].slice(0, MAX_ATTACHMENTS));
          }
          e.target.value = "";
        }}
      />



      <SelectionFormatToolbar textareaRef={textareaRef} onFormat={handleFormat} />

      <AnimatePresence>
        {showMentions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <MentionAutocomplete
              query={mentionQuery}
              position={{ top: 40, left: 0 }}
              onSelect={(opt) => {
                const before = content.slice(0, mentionStartIndex);
                const after = content.slice(mentionStartIndex + mentionQuery.length + 1);
                if (opt.id && (opt.type === "user" || opt.type === "role")) {
                  mentionMappingsRef.current.push({
                    label: opt.label,
                    mentionId: opt.id,
                    mentionType: opt.type,
                  });
                }
                setContent(`${before}@${opt.label} ${after}`);
                setShowMentions(false);
                setHasMentionOptions(false);
              }}
              onClose={() => setShowMentions(false)}
              onOptionsChange={setHasMentionOptions}
            />
          </motion.div>
        )}
        {showChannels && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <ChannelAutocomplete
              query={channelQuery}
              position={{ top: 40, left: 0 }}
              onSelect={(opt) => {
                const before = content.slice(0, channelStartIndex);
                const after = content.slice(channelStartIndex + channelQuery.length + 1);
                channelMappingsRef.current.push({ channelName: opt.name, channelId: opt.id });
                setContent(`${before}#${opt.name} ${after}`);
                setShowChannels(false);
                setHasChannelOptions(false);
              }}
              onClose={() => setShowChannels(false)}
              onOptionsChange={setHasChannelOptions}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {replyingTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-foreground/5 border-b border-border/50 rounded-t-[14px]">
              <span className="text-xs text-muted-foreground">
                Replying to{" "}
                {isDM ? (
                  <span className="text-primary">
                    @{dmConfig?.replyingTo?.sender?.display_name || dmConfig?.replyingTo?.sender?.username || "unknown"}
                  </span>
                ) : showReplyAuthorIdentity ? (
                  <span className="text-primary">
                    @{replyingToUser?.display_name || replyingToUser?.username || "unknown"}
                  </span>
                ) : (
                  <span className="text-primary italic">Anonymous</span>
                )}
              </span>
              <button onClick={() => isForum ? forumConfig?.onCancelReply?.() : isDM ? dmConfig?.onCancelReply?.() : channelSetReplyingTo(null)} className="ml-auto p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between px-3.5 py-1.5 bg-primary/10 border-b border-primary/20 rounded-t-[14px]">
              <div className="flex items-center gap-2 text-xs text-primary">
                <Pencil className="w-3.5 h-3.5" />
                <span className="font-medium">Editing message</span>
              </div>
              <button
                onClick={handleCancelEdit}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <MobileOptimizedInput
        content={content}
        isFocused={isFocused}
        replyingTo={replyingTo}
        isEditMode={isEditMode}
        canSendMessage={canSendMessage}
        canSubmitMessage={canSubmitMessage}
        isLockedByNotice={isComposerLockedByNotice}
        channelName={isDM || isForum ? undefined : channelName}
        dmPlaceholder={isDM ? dmConfig?.otherUsername : undefined}
        forumPlaceholder={isForum ? (forumConfig?.placeholder || "Reply to thread...") : undefined}
        textareaRef={textareaRef}
        handleChange={handleChange}
        setIsFocused={setIsFocused}
        handleKeyDown={handleComposerKeyDown}
        handlePaste={handlePaste}
        onInputMouseDown={isDM ? undefined : (e: React.MouseEvent<HTMLTextAreaElement>) => {
          if (openChatNoticePopup()) {
            e.preventDefault();
          }
        }}
        onInputFocus={isDM ? undefined : (e: React.FocusEvent<HTMLTextAreaElement>) => {
          if (openChatNoticePopup()) {
            e.target.blur();
          }
        }}
        showCreatePoll={isDM || isForum || !effectiveCanCreatePoll ? undefined : showCreatePoll}
        setShowCreatePoll={isDM || isForum || !effectiveCanCreatePoll ? undefined : setShowCreatePoll}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        showGifPicker={isDM || isForum ? undefined : showGifPicker}
        setShowGifPicker={isDM || isForum ? undefined : setShowGifPicker}
        isSending={isSending}
        handleSubmit={handleSubmit}
        handleEmojiSelect={(emoji: string) => {
          // Block external custom emojis at insert time
          if (!canUseExternalEmojis) {
            const customMatch = emoji.match(/^:([a-z0-9_]{2,12})(?:~.+)?:$/i);
            if (customMatch) {
              const emojiName = customMatch[1];
              const localEmojis = serverEmojisForCheck;
              if (!localEmojis.some((e: any) => e.name === emojiName)) {
                toast.error("You don't have permission to use external emojis in this channel");
                return;
              }
            }
          }
          const textarea = textareaRef.current;
          if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            setContent((prev) => prev.slice(0, start) + emoji + prev.slice(end));
            requestAnimationFrame(() => {
              const newPos = start + emoji.length;
              textarea.setSelectionRange(newPos, newPos);
              textarea.focus();
            });
          } else {
            setContent((prev) => prev + emoji);
          }
        }}
        handleGifSelect={isDM ? undefined : (url: string) => {
          setPendingAttachments((prev) => [...prev, { file: new File([], "gif"), preview: url, gifUrl: url }]);
        }}
        currentServer={isDM ? undefined : currentServer}
        allowExternalEmojis={canUseExternalEmojis}
        onAttachClick={effectiveCanAttach ? () => fileInputRef.current?.click() : undefined}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={(i: number) => setPendingAttachments((p) => p.filter((_, idx) => idx !== i))}
        onAddMore={effectiveCanAttach ? () => fileInputRef.current?.click() : undefined}
        showMentions={showMentions}
        hasMentionOptions={hasMentionOptions}
        showChannels={showChannels}
        hasChannelOptions={hasChannelOptions}
      />
      <AnimatePresence>
        {showChatNoticePopup && requiresChatNoticeAck && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute inset-x-4 bottom-4 z-30 rounded-2xl border border-border bg-background/95 p-3 shadow-[0_14px_36px_rgba(0,0,0,0.42)] backdrop-blur"
          >
            <div className="flex items-center gap-2 text-primary">
              <Info className="h-4 w-4" />
              <p className="text-lg font-semibold leading-tight">Before you jump in…</p>
            </div>
            <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap break-words">{activeChatNotice}</p>
            <Button
              type="button"
              onClick={handleAcknowledgeChatNotice}
              disabled={isAcknowledgingChatNotice}
              className="mt-3 h-10 w-full rounded-xl"
            >
              {isAcknowledgingChatNotice ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              Understood
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      {!isDM && !isForum && <CreatePollModal open={showCreatePoll} onOpenChange={setShowCreatePoll} channelId={targetId} />}
    </div>
  );
};

const MobileOptimizedInput = memo(
  ({
    content,
    isFocused,
    replyingTo,
    isEditMode,
    canSendMessage,
    canSubmitMessage,
    isLockedByNotice,
    channelName,
    dmPlaceholder,
    forumPlaceholder,
    textareaRef,
    handleChange,
    setIsFocused,
    handleKeyDown,
    handlePaste,
    onInputMouseDown,
    onInputFocus,
    showCreatePoll,
    setShowCreatePoll,
    showEmojiPicker,
    setShowEmojiPicker,
    showGifPicker,
    setShowGifPicker,
    isSending,
    handleSubmit,
    handleEmojiSelect,
    handleGifSelect,
    currentServer,
    allowExternalEmojis,
    onAttachClick,
    pendingAttachments,
    onRemoveAttachment,
    onAddMore,
    showMentions,
    hasMentionOptions,
    showChannels,
    hasChannelOptions,
  }: any) => {
    const isMobile = useIsMobile();
    const hasAttachments = pendingAttachments.length > 0;

    return (
      <div
        className={`rounded-[14px] bg-card/55 border transition-all duration-200 shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${
          isFocused
            ? "border-border shadow-[0_10px_34px_rgba(0,0,0,0.18)] bg-card/55"
            : "border-border/50 hover:border-border/50"
        } ${replyingTo || isEditMode || (showMentions && hasMentionOptions) || (showChannels && hasChannelOptions) ? "!rounded-t-none" : ""}`}
      >
        <AnimatePresence>
          {hasAttachments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <AttachmentPreviewBar
                attachments={pendingAttachments}
                onRemove={onRemoveAttachment}
                onAddMore={onAddMore}
                disabled={isSending}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea area */}
        <div className="px-3.5 sm:px-4 pt-2.5">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onFocus={(e) => {
              setIsFocused(true);
              onInputFocus?.(e);
            }}
            onBlur={() => setIsFocused(false)}
            onMouseDown={onInputMouseDown}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={forumPlaceholder || (dmPlaceholder ? (hasAttachments ? "Add a comment..." : `Message @${dmPlaceholder.length > (isMobile ? 12 : 17) ? dmPlaceholder.slice(0, isMobile ? 12 : 17) + "…" : dmPlaceholder}`) : (isLockedByNotice ? "Write a message..." : canSendMessage ? "Write a message..." : "Locked"))}
            disabled={!canSendMessage}
            rows={1}
            className="message-input-textarea w-full bg-transparent resize-none outline-none py-1 min-h-[36px] max-h-[160px] overflow-y-auto text-foreground placeholder:text-muted-foreground/60 font-[Inter,system-ui,sans-serif]"
            style={{
              fontSize: "15px",
              lineHeight: "1.45",
              fontWeight: 400,
            }}
          />
        </div>

        {/* Action bar */}
        <ActionBar
          showCreatePoll={showCreatePoll}
          setShowCreatePoll={setShowCreatePoll}
          showEmojiPicker={showEmojiPicker}
          setShowEmojiPicker={setShowEmojiPicker}
          showGifPicker={showGifPicker}
          setShowGifPicker={setShowGifPicker}
          canSendMessage={canSendMessage && !isLockedByNotice}
          canSubmitMessage={canSubmitMessage && !isLockedByNotice}
          content={content}
          isSending={isSending}
          hasAttachments={hasAttachments}
          onSubmit={handleSubmit}
          onEmojiSelect={handleEmojiSelect}
          onGifSelect={handleGifSelect}
          currentServer={currentServer}
          allowExternalEmojis={allowExternalEmojis}
          onAttachClick={onAttachClick}
        />
      </div>
    );
  },
);
MobileOptimizedInput.displayName = "MobileOptimizedInput";
