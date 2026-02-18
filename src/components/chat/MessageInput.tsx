import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Paperclip, Smile, Send, X, Loader2, WifiOff, Lock, SquareChartGantt, MoreHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useServerStore } from "@/stores/serverStore";
import { useOfflineQueueStore } from "@/stores/offlineQueueStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { saveDraft, getDraft, clearDraft } from "@/lib/storage";
import { isImageOnlyMessage } from "@/lib/message";
import { ReplyPreview } from "./MessageContent";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { ChannelAutocomplete } from "./ChannelAutocomplete";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { CreatePollModal } from "@/components/modals/CreatePollModal";
import { SelectionFormatToolbar, FORMAT_SYNTAX, getCodeBlockSyntax } from "./FormatToolbar";
import { AttachmentPreviewBar, PendingAttachment } from "./AttachmentPreviewBar";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload } from "@/lib/storageUpload";
import { showSuccess, showWarning, handleError } from "@/lib/errorHandler";
import { messageRateLimiter, validateMessageContent } from "@/lib/security";
import { toast } from "sonner";

interface MessageInputProps {
  channelId: string;
  channelName: string;
  onTyping: () => void;
  onStopTyping: () => void;
}

interface MentionMapping {
  username: string;
  userId: string;
}

interface ChannelMapping {
  channelName: string;
  channelId: string;
}

const MAX_LENGTH = 2000;
const MIN_TEXTAREA_HEIGHT = 40;
const MAX_TEXTAREA_HEIGHT = 160;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_ATTACHMENTS = 10;
const DRAFT_SAVE_DELAY = 500; // ms
const TYPING_STOP_DELAY = 2000; // ms

const ActionButtons = memo(
  ({
    showCreatePoll,
    setShowCreatePoll,
    showEmojiPicker,
    setShowEmojiPicker,
    canSendMessage,
    content,
    isSending,
    hasAttachments,
    onSubmit,
    onEmojiSelect,
    currentServer,
    showAttachButton,
    onAttachClick,
  }: {
    showCreatePoll: boolean;
    setShowCreatePoll: (show: boolean) => void;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (show: boolean) => void;
    canSendMessage: boolean;
    content: string;
    isSending: boolean;
    hasAttachments: boolean;
    onSubmit: () => void;
    onEmojiSelect: (emoji: string) => void;
    currentServer: any;
    showAttachButton?: boolean;
    onAttachClick?: () => void;
  }) => {
    const showCharacterWarning = content.length > MAX_LENGTH - 200;
    const isMobile = useIsMobile();
    const shouldCollapse = isMobile && content.length > 10;
    const canSend = (content.trim() || hasAttachments) && !isSending;
    return (
      <div className="flex items-center gap-1 mb-0.5 relative">
        {showCharacterWarning && (
          <span
            className={`text-[13px] font-[Inter,system-ui,sans-serif] mr-1 ${content.length > MAX_LENGTH - 50 ? "text-destructive" : "text-muted-foreground"}`}
          >
            {MAX_LENGTH - content.length}
          </span>
        )}
        {shouldCollapse ? (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
                  onMouseDown={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {showAttachButton && (
                  <DropdownMenuItem onClick={onAttachClick} disabled={!canSendMessage}>
                    <Paperclip className="w-4 h-4 mr-2" />
                    Upload image
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowCreatePoll(true)} disabled={!canSendMessage}>
                  <SquareChartGantt className="w-4 h-4 mr-2" />
                  Create poll
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <EmojiPicker
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
              onEmojiSelect={onEmojiSelect}
              serverId={currentServer?.id}
            >
              <button
                type="button"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Smile className="w-5 h-5" />
              </button>
            </EmojiPicker>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowCreatePoll(true)}
              disabled={!canSendMessage}
              className={`p-2 rounded-xl transition-colors duration-150 ${
                canSendMessage
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  : "text-muted-foreground/50 cursor-not-allowed"
              }`}
              onMouseDown={(e) => e.preventDefault()}
              title="Create poll"
            >
              <SquareChartGantt className="w-5 h-5" />
            </button>
            <EmojiPicker
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
              onEmojiSelect={onEmojiSelect}
              serverId={currentServer?.id}
            >
              <button
                type="button"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
                onMouseDown={(e) => e.preventDefault()}
              >
                <Smile className="w-5 h-5" />
              </button>
            </EmojiPicker>
          </>
        )}
        <button
          onClick={onSubmit}
          disabled={!canSend}
          className={`p-2 rounded-xl transition-all duration-150 ${
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
              : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
          }`}
        >
          {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    );
  },
);
ActionButtons.displayName = "ActionButtons";

export const MessageInput = ({ channelId, channelName, onTyping, onStopTyping }: MessageInputProps) => {
  const { user } = useAuthStore();
  const { replyingTo, setReplyingTo, sendMessage } = useMessageStore();
  const { members, currentServer, currentChannel, channels, fetchRolePermissions, fetchChannelPermissions } =
    useServerStore();
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [showChannels, setShowChannels] = useState(false);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelStartIndex, setChannelStartIndex] = useState(-1);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionMappingsRef = useRef<MentionMapping[]>([]);
  const channelMappingsRef = useRef<ChannelMapping[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentServer?.id) fetchRolePermissions(currentServer.id);
  }, [currentServer?.id, fetchRolePermissions]);

  useEffect(() => {
    if (channelId) fetchChannelPermissions(channelId);
  }, [channelId, fetchChannelPermissions]);

  const currentMember = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user?.id]);
  const isMuted = currentMember?.is_muted || false;
  const isReadOnlyChannel = currentChannel?.is_read_only || false;
  const blockLinks = currentChannel?.block_links || false;
  const allowedLinkDomains = currentChannel?.allowed_link_domains || [];
  const { hasPermission } = useMemberPermissions(channelId);
  const canSendMessagesPermission = hasPermission("send_messages");
  const canSendInReadOnly = isReadOnlyChannel ? hasPermission("manage_messages") : true;
  const canSendMessage = !isMuted && canSendMessagesPermission && canSendInReadOnly;
  const isAdmin = hasPermission("manage_messages");
  const canUseExternalEmojis = hasPermission("use_external_emojis");

  const saveDraftDebounced = useCallback((channelId: string, content: string) => {
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => saveDraft(channelId, content), DRAFT_SAVE_DELAY);
  }, []);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, []);

  const handleSubmit = useCallback(async () => {
    const hasText = content.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;
    if ((!hasText && !hasAttachments) || !user || isMuted || isSending || !canSendMessage) return;

    const messageContent = content.trim();
    if (hasText) {
      const validation = validateMessageContent(messageContent);
      if (!validation.valid) {
        showWarning("Invalid message", validation.error || "Check your message");
        return;
      }
    }

    if (!messageRateLimiter.isAllowed(user.id)) {
      showWarning("Slow down!", `Try again in ${messageRateLimiter.getRemainingTime(user.id)}s`);
      return;
    }

    const contentToSend = hasText ? convertMentionsForSend(messageContent) : "";
    
    // Clear state early for UX snappiness
    setContent("");
    clearDraft(channelId);
    setReplyingTo(null);
    setIsSending(true);
    onStopTyping();

    if (textareaRef.current) textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;

    try {
      let finalContent = contentToSend;
      if (hasAttachments) {
        const urls = await uploadAttachments();
        finalContent = finalContent ? `${finalContent}\n${urls.join("\n")}` : urls.join("\n");
        clearAttachments();
      }

      // 🚀 DB Trigger now handles pings automatically upon message insertion
      await sendMessage(channelId, user.id, finalContent, replyingTo?.id);
      
      const auth = useAuthStore.getState();
      if (auth.manualStatus !== "offline") auth.updateLastSeen();
      
    } catch (error) {
      handleError(error, "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [content, pendingAttachments, user, isMuted, isSending, canSendMessage, channelId, replyingTo, sendMessage, onStopTyping]);

  return (
    // ... UI JSX remains same, ensure textareaRef is attached ...
  );
};