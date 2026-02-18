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
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { saveDraft, getDraft, clearDraft } from "@/lib/storage";
import { validateMessageContent } from "@/lib/security";
import { secureUpload } from "@/lib/storageUpload";
import { handleError, showWarning } from "@/lib/errorHandler";
import { messageRateLimiter } from "@/lib/security";
import { toast } from "sonner";

// Components
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { AttachmentPreviewBar, PendingAttachment } from "./AttachmentPreviewBar";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { ChannelAutocomplete } from "./ChannelAutocomplete";

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
const DRAFT_SAVE_DELAY = 500;
const TYPING_STOP_DELAY = 2000;

const ActionButtons = memo(
  ({
    onSubmit,
    isSending,
    canSendMessage,
    content,
    hasAttachments,
    currentServer,
    showEmojiPicker,
    setShowEmojiPicker,
    onEmojiSelect,
  }: any) => {
    const isMobile = useIsMobile();
    const canSend = (content.trim() || hasAttachments) && !isSending;

    return (
      <div className="flex items-center gap-1 mb-0.5 relative">
        <EmojiPicker
          open={showEmojiPicker}
          onOpenChange={setShowEmojiPicker}
          onEmojiSelect={onEmojiSelect}
          serverId={currentServer?.id}
        >
          <button type="button" className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50">
            <Smile className="w-5 h-5" />
          </button>
        </EmojiPicker>
        <button
          onClick={onSubmit}
          disabled={!canSend || !canSendMessage}
          className={`p-2 rounded-xl transition-all ${
            canSend
              ? "bg-primary text-primary-foreground active:scale-95"
              : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"
          }`}
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  // Autocomplete States
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [showChannels, setShowChannels] = useState(false);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelStartIndex, setChannelStartIndex] = useState(-1);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionMappingsRef = useRef<MentionMapping[]>([]);
  const channelMappingsRef = useRef<ChannelMapping[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load permissions
  useEffect(() => {
    if (currentServer?.id) fetchRolePermissions(currentServer.id);
  }, [currentServer?.id, fetchRolePermissions]);

  useEffect(() => {
    if (channelId) {
      fetchChannelPermissions(channelId);
      setContent(getDraft(channelId));
    }
  }, [channelId, fetchChannelPermissions]);

  const { hasPermission } = useMemberPermissions(channelId);
  const currentMember = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user?.id]);
  const canSendMessage = !currentMember?.is_muted && hasPermission("send_messages");

  const resizeTextarea = useCallback(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    const newHeight = Math.min(Math.max(textareaRef.current.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
    textareaRef.current.style.height = `${newHeight}px`;
  }, []);

  const detectAutocomplete = useCallback((value: string, pos: number) => {
    const textBefore = value.slice(0, pos);

    // Mentions
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex !== -1 && !textBefore.slice(atIndex).includes(" ")) {
      setMentionQuery(textBefore.slice(atIndex + 1));
      setMentionStartIndex(atIndex);
      setShowMentions(true);
      setShowChannels(false);
    } else {
      setShowMentions(false);
    }

    // Channels
    const hashIndex = textBefore.lastIndexOf("#");
    if (hashIndex !== -1 && !textBefore.slice(hashIndex).includes(" ")) {
      setChannelQuery(textBefore.slice(hashIndex + 1));
      setChannelStartIndex(hashIndex);
      setShowChannels(true);
      setShowMentions(false);
    } else {
      setShowChannels(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > MAX_LENGTH) return;
    setContent(val);
    resizeTextarea();
    onTyping();
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(onStopTyping, TYPING_STOP_DELAY);
    detectAutocomplete(val, e.target.selectionStart);
    saveDraft(channelId, val);
  };

  const convertMentionsForSend = useCallback((text: string): string => {
    let result = text;
    mentionMappingsRef.current.forEach((m) => {
      const regex = new RegExp(`@${m.username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<@${m.userId}>`);
    });
    return result;
  }, []);

  const handleSubmit = useCallback(async () => {
    if ((!content.trim() && pendingAttachments.length === 0) || isSending || !canSendMessage) return;

    if (!messageRateLimiter.isAllowed(user!.id)) {
      showWarning("Slow down!", `Try again in ${messageRateLimiter.getRemainingTime(user!.id)}s`);
      return;
    }

    setIsSending(true);
    const contentToSend = convertMentionsForSend(content.trim());

    try {
      let finalContent = contentToSend;
      if (pendingAttachments.length > 0) {
        const urls = [];
        for (const att of pendingAttachments) {
          const fileName = `${user!.id}/${Date.now()}-${crypto.randomUUID()}.${att.file.name.split(".").pop()}`;
          const res = await secureUpload("attachments", fileName, att.file, { contentType: att.file.type });
          urls.push(res.publicUrl);
        }
        finalContent = finalContent ? `${finalContent}\n${urls.join("\n")}` : urls.join("\n");
      }

      // 🚀 DATABASE TRIGGER HANDLES ALL MENTION COUNTS AUTOMATICALLY
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
    user,
    replyingTo,
    canSendMessage,
    isSending,
    convertMentionsForSend,
    sendMessage,
  ]);

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

      {showMentions && (
        <MentionAutocomplete
          query={mentionQuery}
          onSelect={(opt) => {
            const before = content.slice(0, mentionStartIndex);
            const after = content.slice(mentionStartIndex + mentionQuery.length + 1);
            if (opt.id) mentionMappingsRef.current.push({ username: opt.label, userId: opt.id });
            setContent(`${before}@${opt.label} ${after}`);
            setShowMentions(false);
          }}
        />
      )}

      <div className="flex flex-col w-full bg-muted/20 rounded-2xl border border-border/50 focus-within:border-primary/30 transition-all duration-200">
        <AttachmentPreviewBar
          attachments={pendingAttachments}
          onRemove={(i) => setPendingAttachments((prev) => prev.filter((_, idx) => idx !== i))}
          onAddMore={() => fileInputRef.current?.click()}
        />

        <div className="flex items-end gap-2 px-3 py-2">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !useIsMobile()) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={`Message #${channelName}`}
            className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-2 max-h-[160px] text-[15px] placeholder:text-muted-foreground/60"
            rows={1}
          />
          <ActionButtons
            content={content}
            isSending={isSending}
            canSendMessage={canSendMessage}
            onSubmit={handleSubmit}
            onEmojiSelect={(emoji: string) => setContent((prev) => prev + emoji)}
            currentServer={currentServer}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            hasAttachments={pendingAttachments.length > 0}
          />
        </div>
      </div>
      <input
        type="file"
        ref={fileInputRef}
        hidden
        onChange={(e) => {
          if (e.target.files?.[0]) {
            setPendingAttachments((prev) => [
              ...prev,
              { file: e.target.files![0], preview: URL.createObjectURL(e.target.files![0]) },
            ]);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
};
