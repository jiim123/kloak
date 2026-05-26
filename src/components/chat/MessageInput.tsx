import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo, memo } from "react";
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
  Info,
  Check,
  Pencil,
  Plus,
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
import { getSignedAttachmentUrl } from "@/lib/signedUrl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MessageAttachment } from "@/types";

export interface DMInputConfig {
  conversationId: string;
  otherUsername: string;
  replyingTo?: { id: string; sender?: { username?: string; display_name?: string | null }; content: string } | null;
  onCancelReply?: () => void;
  /** Conversation participants (excluding self) used for @mention autocomplete. */
  participants?: import("@/types").User[];
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
const ATTACHMENT_READY_RETRY_DELAYS_MS = [800, 1500, 2500, 4000, 6000];
const ATTACHMENT_INSERT_RETRY_DELAYS_MS = [1200, 2500, 5000];

const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const GifPickerIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.75 3.50054C20.5449 3.50054 22 4.95562 22 6.75054V17.2531C22 19.048 20.5449 20.5031 18.75 20.5031H5.25C3.45507 20.5031 2 19.048 2 17.2531V6.75054C2 4.95562 3.45507 3.50054 5.25 3.50054H18.75ZM18.75 5.00054H5.25C4.2835 5.00054 3.5 5.78404 3.5 6.75054V17.2531C3.5 18.2196 4.2835 19.0031 5.25 19.0031H18.75C19.7165 19.0031 20.5 18.2196 20.5 17.2531V6.75054C20.5 5.78404 19.7165 5.00054 18.75 5.00054ZM8.0146 8.87194C8.6115 8.87194 9.03353 8.95326 9.51677 9.18533C9.82793 9.33475 9.95904 9.70813 9.80962 10.0193C9.66019 10.3304 9.28682 10.4616 8.97566 10.3121C8.67583 10.1681 8.43601 10.1219 8.0146 10.1219C7.14789 10.1219 6.51104 10.9183 6.51104 11.9943C6.51104 13.0713 7.14873 13.8703 8.0146 13.8703C8.44322 13.8703 8.80607 13.6904 8.99484 13.3695L9.001 13.3545V12.6205L8.62522 12.6212C8.31142 12.6212 8.05164 12.3899 8.00699 12.0886L8.00022 11.9962C8.00022 11.6824 8.23148 11.4226 8.53286 11.378L8.62522 11.3712H9.62682C9.94062 11.3712 10.2004 11.6025 10.245 11.9038L10.2518 11.9962L10.2505 13.5439L10.2441 13.5992L10.223 13.6891L10.2025 13.7442C9.82607 14.6343 8.96156 15.1203 8.0146 15.1203C6.38858 15.1203 5.26104 13.7076 5.26104 11.9943C5.26104 10.2817 6.38839 8.87194 8.0146 8.87194ZM12.6289 8.99393C12.9427 8.99393 13.2025 9.22519 13.2472 9.52658L13.2539 9.61893V14.3811C13.2539 14.7262 12.9741 15.0061 12.6289 15.0061C12.3151 15.0061 12.0554 14.7748 12.0107 14.4734L12.0039 14.3811V9.61893C12.0039 9.27376 12.2838 8.99393 12.6289 8.99393ZM15.6248 8.99393L17.6222 9.00083C17.9673 9.00203 18.2462 9.28281 18.245 9.62799C18.2439 9.94179 18.0118 10.2008 17.7102 10.2444L17.6178 10.2508L16.247 10.2455V11.9995L17.37 12.0004C17.6838 12.0004 17.9436 12.2317 17.9882 12.533L17.995 12.6254C17.995 12.9392 17.7637 13.199 17.4624 13.2436L17.37 13.2504L16.247 13.2495L16.2476 14.365C16.2476 14.6788 16.0163 14.9386 15.715 14.9832L15.6226 14.99C15.3088 14.99 15.049 14.7587 15.0044 14.4573L14.9976 14.365V9.61678C14.9987 9.30298 15.2308 9.044 15.5324 9.00039L15.6248 8.99393Z" />
  </svg>
);

async function waitForAttachmentReady(storagePath: string): Promise<boolean> {
  for (let attempt = 0; attempt <= ATTACHMENT_READY_RETRY_DELAYS_MS.length; attempt += 1) {
    const signedUrl = await getSignedAttachmentUrl(storagePath);
    if (signedUrl) return true;
    if (attempt < ATTACHMENT_READY_RETRY_DELAYS_MS.length) {
      await sleep(ATTACHMENT_READY_RETRY_DELAYS_MS[attempt]);
    }
  }
  return false;
}

function isRetryableAttachmentInsertError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message =
    typeof error === "object" && error && "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  return code === "57014" || /timeout|timed out|still processing/i.test(message);
}

async function insertAttachmentsWithRetry(
  table: "message_attachments" | "dm_attachments",
  attachments: Array<{
    message_id: string;
    file_url: string;
    file_name: string;
    file_type: string | null;
    file_size: number | null;
  }>,
): Promise<void> {
  for (let attempt = 0; attempt <= ATTACHMENT_INSERT_RETRY_DELAYS_MS.length; attempt += 1) {
    const { error } = await supabase.from(table).insert(attachments);
    if (!error) return;
    if (!isRetryableAttachmentInsertError(error) || attempt >= ATTACHMENT_INSERT_RETRY_DELAYS_MS.length) {
      throw error;
    }
    await sleep(ATTACHMENT_INSERT_RETRY_DELAYS_MS[attempt]);
  }
}

// Memoized action bar (two-row layout: textarea on top, actions on bottom)
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
    textareaNode,
  }: any) => {
    const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
    const isMobile = useIsMobile();
    const showCharacterWarning = content.length > MAX_LENGTH - 200;
    const canSend = (content.trim() || hasAttachments) && !isSending && canSubmitMessage;

    // Larger touch targets on mobile (≥44px), more compact on desktop.
    const iconBtnClass = isMobile
      ? "flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40"
      : "flex h-10 w-10 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-40";
    const menuItemClass =
      "min-h-[36px] cursor-pointer gap-2.5 px-3 py-2 text-[13px] font-semibold text-popover-foreground focus:bg-secondary/70 hover:bg-secondary/70";

    const plusBtnSize = isMobile ? "h-11 w-11" : "h-10 w-10";
    const sendBtnSize = isMobile ? "h-10 w-10" : "h-9 w-9";

    return (
      <div className="flex flex-col">
        {/* Row 1: textarea grows freely without affecting the action row */}
        <div className="flex min-w-0 items-start px-3 pt-1 sm:px-3.5">
          {textareaNode}
        </div>

        {/* Row 2: fixed-height action row */}
        <div className="flex items-center gap-1 px-1.5 pb-1 sm:pb-1.5">
          <div className="flex items-center">
            <DropdownMenu open={isActionsMenuOpen} onOpenChange={setIsActionsMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  disabled={!canSendMessage}
                  className={`flex ${plusBtnSize} items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40`}
                  aria-label="Open message actions"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                side="top"
                sideOffset={8}
                className="w-[292px] rounded-md border border-border/80 bg-popover p-0 shadow-[0_10px_28px_rgba(0,0,0,0.5)]"
              >
                {onAttachClick && (
                  <DropdownMenuItem
                    disabled={!canSendMessage}
                    onSelect={onAttachClick}
                    className={menuItemClass}
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <span>Media or file</span>
                  </DropdownMenuItem>
                )}

                {setShowCreatePoll && (
                  <DropdownMenuItem
                    disabled={!canSendMessage}
                    onSelect={() => setShowCreatePoll(true)}
                    className={`${menuItemClass} items-start`}
                  >
                    <SquareChartGantt className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <span className="flex flex-col leading-tight">
                      <span>Poll</span>
                      <span className="mt-0.5 text-[13px] font-medium text-muted-foreground">
                        A single or multiple-choice question.
                      </span>
                    </span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="ml-auto flex shrink-0 items-center">
            {setShowGifPicker && (
              <GifPicker
                open={showGifPicker}
                onOpenChange={setShowGifPicker}
                onSelect={onGifSelect}
              >
                <button
                  type="button"
                  className={iconBtnClass}
                  onMouseDown={(e) => e.preventDefault()}
                  aria-label="Open GIF picker"
                >
                  <GifPickerIcon className="w-[22px] h-[22px]" />
                </button>
              </GifPicker>
            )}

            <EmojiPicker
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
              onEmojiSelect={onEmojiSelect}
              serverId={currentServer?.id}
              allowExternalEmojis={allowExternalEmojis}
            >
              <button
                type="button"
                className={iconBtnClass}
                onMouseDown={(e) => e.preventDefault()}
                aria-label="Open emoji picker"
              >
                <Smile className="w-5 h-5" />
              </button>
            </EmojiPicker>

            <AnimatePresence>
              {showCharacterWarning && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={`mx-1 text-[13px] font-sans ${content.length > MAX_LENGTH - 50 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {MAX_LENGTH - content.length}
                </motion.span>
              )}
            </AnimatePresence>
            <button
              onClick={onSubmit}
              disabled={!canSend}
              aria-label="Send message"
              className={`ml-1 flex ${sendBtnSize} items-center justify-center rounded-full transition-all duration-200 ${
                canSend
                  ? "bg-foreground/10 text-foreground hover:bg-foreground/16 active:scale-95"
                  : "bg-foreground/5 text-muted-foreground/50 cursor-not-allowed"
              }`}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
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

  useLayoutEffect(() => {
    resizeTextarea();
  }, [content, resizeTextarea]);

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

    // #channel autocomplete is server-only; skip in DMs.
    if (isDM) {
      setShowChannels(false);
      setHasChannelOptions(false);
      return;
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
  }, [isDM]);

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
    detectAutocomplete(val, e.target.selectionStart);
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
          await dmEditMessage(editingMessage.id, user.id, convertMentionsForSend(trimmed));
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
    const contentToSend = convertMentionsForSend(content.trim());

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

            const attachmentReadiness = await Promise.all(
              preparedAttachments.map(async (attachment) => {
                if (!attachment.storagePath) return true;
                return waitForAttachmentReady(attachment.storagePath);
              }),
            );

            const persistedAttachments = preparedAttachments
              .filter((_, i) => attachmentReadiness[i])
              .map((attachment, i) => ({
                message_id: sentMessage.id,
                file_url: attachment.contentUrl,
                file_name: attachment.optimisticAttachment.file_name || `attachment-${i + 1}`,
                file_type: attachment.optimisticAttachment.file_type || null,
                file_size: attachment.optimisticAttachment.file_size || null,
              }))
              .filter((attachment) => !!attachment.file_url);

            if (persistedAttachments.length === 0) return;

            await insertAttachmentsWithRetry(isDM ? "dm_attachments" : "message_attachments", persistedAttachments);
          } catch (attachmentError) {
            console.error("[MessageInput] Attachment finalize error:", attachmentError);
            toast.error("Attachment processing is delayed", {
              description: "Your message was sent. The attachment will appear once storage finishes syncing.",
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

      {
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
        const formatMap: Record<string, string> = { b: "bold", i: "italic", u: "underline", k: "code", s: "spoiler" };
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
    <div className="px-3 pb-3 pt-2 sm:px-5 sm:pb-5 relative bg-transparent">
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
              participants={isDM ? dmConfig?.participants : undefined}
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
        showGifPicker={isForum ? undefined : showGifPicker}
        setShowGifPicker={isForum ? undefined : setShowGifPicker}
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
        handleGifSelect={(url: string) => {
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
          className={`rounded-lg bg-muted/35 border transition-all duration-200 shadow-none ${
            isFocused
            ? "border-border bg-muted/35"
            : "border-border/60 hover:border-border"
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
          textareaNode={
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
              placeholder={forumPlaceholder || (dmPlaceholder ? (hasAttachments ? "Add a comment..." : `Message @${dmPlaceholder.length > (isMobile ? 12 : 17) ? dmPlaceholder.slice(0, isMobile ? 12 : 17) + "..." : dmPlaceholder}`) : (isLockedByNotice ? "Write a message..." : canSendMessage ? `Message ${channelName || "channel"}` : "Locked"))}
              disabled={!canSendMessage}
              rows={1}
              className="message-input-textarea w-full resize-none bg-transparent py-2.5 sm:py-2 text-foreground outline-none min-h-[40px] max-h-[140px] sm:max-h-[160px] overflow-y-auto placeholder:text-muted-foreground/60 font-[Inter,system-ui,sans-serif]"
              style={{
                fontSize: isMobile ? "16px" : "15px",
                lineHeight: "1.45",
                fontWeight: 400,
              }}
            />

          }
        />
      </div>
    );
  },
);
MobileOptimizedInput.displayName = "MobileOptimizedInput";
