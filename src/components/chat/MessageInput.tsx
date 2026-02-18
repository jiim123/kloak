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
const DRAFT_SAVE_DELAY = 500;
const TYPING_STOP_DELAY = 2000;

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
            className={`text-[13px] font-sans mr-1 ${content.length > MAX_LENGTH - 50 ? "text-destructive" : "text-muted-foreground"}`}
          >
            {MAX_LENGTH - content.length}
          </span>
        )}
        {shouldCollapse ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50">
                <MoreHorizontal className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {showAttachButton && (
                <DropdownMenuItem onClick={onAttachClick}>
                  <Paperclip className="w-4 h-4 mr-2" /> Upload
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setShowCreatePoll(true)}>
                <SquareChartGantt className="w-4 h-4 mr-2" /> Poll
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowCreatePoll(true)}
              disabled={!canSendMessage}
              className="p-2 text-muted-foreground hover:bg-muted/50"
            >
              <SquareChartGantt className="w-5 h-5" />
            </button>
            <EmojiPicker
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
              onEmojiSelect={onEmojiSelect}
              serverId={currentServer?.id}
            >
              <button type="button" className="p-2 text-muted-foreground hover:bg-muted/50">
                <Smile className="w-5 h-5" />
              </button>
            </EmojiPicker>
          </>
        )}
        <button
          onClick={onSubmit}
          disabled={!canSend}
          className={`p-2 rounded-xl ${canSend ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground/50"}`}
        >
          {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    );
  },
);

export const MessageInput = ({ channelId, channelName, onTyping, onStopTyping }: MessageInputProps) => {
  const { user } = useAuthStore();
  const { replyingTo, setReplyingTo, sendMessage } = useMessageStore();
  const { members, currentServer, currentChannel, fetchRolePermissions, fetchChannelPermissions } = useServerStore();
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionMappingsRef = useRef<MentionMapping[]>([]);
  const channelMappingsRef = useRef<ChannelMapping[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Permissions & Logic
  const currentMember = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user?.id]);
  const isMuted = currentMember?.is_muted || false;
  const { hasPermission } = useMemberPermissions(channelId);
  const canSendMessage = !isMuted && hasPermission("send_messages");

  const resizeTextarea = useCallback(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

  const escapeRegex = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const convertMentionsForSend = useCallback((text: string): string => {
    let result = text;
    mentionMappingsRef.current.forEach((m) => {
      const regex = new RegExp(`@${escapeRegex(m.username)}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<@${m.userId}>`);
    });
    return result;
  }, []);

  const uploadAttachments = useCallback(async (): Promise<string[]> => {
    if (!user || pendingAttachments.length === 0) return [];
    const urls: string[] = [];
    for (const att of pendingAttachments) {
      const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${att.file.name.split(".").pop()}`;
      const result = await secureUpload("attachments", fileName, att.file, { contentType: att.file.type });
      urls.push(result.publicUrl);
    }
    return urls;
  }, [user, pendingAttachments]);

  const handleSubmit = useCallback(async () => {
    if (!content.trim() && pendingAttachments.length === 0) return;
    if (isSending || !canSendMessage) return;

    setIsSending(true);
    const contentToSend = convertMentionsForSend(content.trim());

    try {
      let finalContent = contentToSend;
      if (pendingAttachments.length > 0) {
        const urls = await uploadAttachments();
        finalContent = finalContent ? `${finalContent}\n${urls.join("\n")}` : urls.join("\n");
      }

      // 🚀 The magic: One call. The DB trigger handles the pings.
      await sendMessage(channelId, user!.id, finalContent, replyingTo?.id);

      setContent("");
      setPendingAttachments([]);
      setReplyingTo(null);
      clearDraft(channelId);
      if (textareaRef.current) textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    } catch (error) {
      handleError(error, "Failed to send");
    } finally {
      setIsSending(false);
    }
  }, [
    content,
    pendingAttachments,
    channelId,
    replyingTo,
    sendMessage,
    user,
    canSendMessage,
    convertMentionsForSend,
    uploadAttachments,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !useIsMobile()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative flex flex-col w-full px-4 pb-4 bg-background">
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-2 mb-2 bg-muted/30 rounded-xl border border-border/50">
          <div className="flex flex-col truncate">
            <span className="text-xs font-semibold text-primary">Replying to {replyingTo.user?.display_name}</span>
            <span className="text-xs text-muted-foreground truncate">{replyingTo.content}</span>
          </div>
          <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-muted rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col w-full bg-muted/20 rounded-2xl border border-border/50 focus-within:border-primary/30 transition-all duration-200">
        <AttachmentPreviewBar
          attachments={pendingAttachments}
          onRemove={(i) => setPendingAttachments((p) => p.filter((_, idx) => idx !== i))}
        />

        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              resizeTextarea();
              onTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 max-h-[160px] text-[15px] placeholder:text-muted-foreground/60"
            rows={1}
          />
          <ActionButtons
            content={content}
            isSending={isSending}
            canSendMessage={canSendMessage}
            onSubmit={handleSubmit}
            onEmojiSelect={(emoji) => setContent((prev) => prev + emoji)}
            currentServer={currentServer}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            showCreatePoll={showCreatePoll}
            setShowCreatePoll={setShowCreatePoll}
            hasAttachments={pendingAttachments.length > 0}
          />
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        hidden
        onChange={(e) => {
          if (e.target.files)
            setPendingAttachments((prev) => [
              ...prev,
              { file: e.target.files![0], preview: URL.createObjectURL(e.target.files![0]) },
            ]);
        }}
      />
    </div>
  );
};
