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
import { isImageOnlyMessage } from "@/lib/message";
import { ReplyPreview } from "./MessageContent";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { ChannelAutocomplete } from "./ChannelAutocomplete";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { CreatePollModal } from "@/components/modals/CreatePollModal";
import { SelectionFormatToolbar, FORMAT_SYNTAX, getCodeBlockSyntax } from "./FormatToolbar";
import { AttachmentPreviewBar, PendingAttachment } from "./AttachmentPreviewBar";
import { secureUpload } from "@/lib/storageUpload";
import { showWarning, handleError } from "@/lib/errorHandler";
import { messageRateLimiter, validateMessageContent } from "@/lib/security";
import { canRevealGhostIdentityForUser } from "@/lib/ghostIdentity";
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

// Memoized action buttons
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
  }: any) => {
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
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  <MoreHorizontal className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {showAttachButton && (
                  <DropdownMenuItem onClick={onAttachClick} disabled={!canSendMessage}>
                    <Paperclip className="w-4 h-4 mr-2" /> Upload image
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setShowCreatePoll(true)} disabled={!canSendMessage}>
                  <SquareChartGantt className="w-4 h-4 mr-2" /> Create poll
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowCreatePoll(true)}
              disabled={!canSendMessage}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50"
            >
              <SquareChartGantt className="w-5 h-5" />
            </button>
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
          </>
        )}
        <button
          onClick={onSubmit}
          disabled={!canSend}
          className={`p-2 rounded-xl transition-all ${canSend ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95" : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed"}`}
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
  const { members, currentServer, currentChannel, channels, fetchRolePermissions } = useServerStore();
  const { getQueuedForChannel } = useOfflineQueueStore();
  const isMobile = useIsMobile();

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
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionMappingsRef = useRef<MentionMapping[]>([]);
  const channelMappingsRef = useRef<ChannelMapping[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (currentServer?.id) fetchRolePermissions(currentServer.id);
  }, [currentServer?.id, fetchRolePermissions]);

  useEffect(() => {
    if (channelId) {
      setContent(getDraft(channelId));
    }
    return () => {
      setPendingAttachments((prev) => {
        prev.forEach((a) => URL.revokeObjectURL(a.preview));
        return [];
      });
    };
  }, [channelId]);

  // Auto-focus text input when switching channels so user can type immediately
  useEffect(() => {
    if (channelId) {
      const t = textareaRef.current;
      if (t) {
        // Small delay so the channel content has rendered
        const id = requestAnimationFrame(() => {
          t.focus();
        });
        return () => cancelAnimationFrame(id);
      }
    }
  }, [channelId]);

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

  const { hasPermission } = useMemberPermissions(channelId);
  const currentMember = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user?.id]);
  const isMuted = currentMember?.is_muted || false;
  const isReadOnlyChannel = currentChannel?.is_read_only || false;
  const isGhostMode = currentChannel?.ghost_mode || false;
  const canSendMessagesPermission = hasPermission("send_messages");
  const canSendInReadOnly = isReadOnlyChannel ? hasPermission("manage_messages") : true;
  const canSendMessage = !isMuted && canSendMessagesPermission && canSendInReadOnly;
  const showReplyAuthorIdentity = useMemo(
    () =>
      canRevealGhostIdentityForUser({
        isGhostMode,
        authorUserId: replyingTo?.user?.id,
        members,
        ownerId: currentServer?.owner_id,
      }),
    [isGhostMode, replyingTo?.user?.id, members, currentServer?.owner_id],
  );

  const resizeTextarea = useCallback(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT)}px`;
  }, []);

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
    channelMappingsRef.current.forEach((c) => {
      const regex = new RegExp(`#${c.channelName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<#${c.channelId}>`);
    });
    return result;
  }, []);

  const handleSubmit = useCallback(async () => {
    if ((!content.trim() && pendingAttachments.length === 0) || !user || isSending || !canSendMessage) return;

    if (!messageRateLimiter.isAllowed(user.id)) {
      showWarning("Slow down!", `Try again in ${messageRateLimiter.getRemainingTime(user.id)}s`);
      return;
    }

    setIsSending(true);
    const contentToSend = convertMentionsForSend(content.trim());

    try {
      let finalContent = contentToSend;
      if (pendingAttachments.length > 0) {
        const urls = [];
        for (const att of pendingAttachments) {
          const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${att.file.name.split(".").pop()}`;
          const res = await secureUpload("attachments", fileName, att.file, { contentType: att.file.type });
          urls.push(res.publicUrl);
        }
        finalContent = finalContent ? `${finalContent}\n${urls.join("\n")}` : urls.join("\n");
      }

      // 🚀 Optimization: The DB Trigger now handles all mention processing automatically.
      await sendMessage(channelId, user.id, finalContent, replyingTo?.id);

      setContent("");
      setPendingAttachments([]);
      setReplyingTo(null);
      clearDraft(channelId);
      mentionMappingsRef.current = [];
      channelMappingsRef.current = [];
      if (textareaRef.current) textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    } catch (error) {
      handleError(error, "Failed to send");
    } finally {
      setIsSending(false);
    }
  }, [
    content,
    pendingAttachments,
    user,
    channelId,
    replyingTo,
    canSendMessage,
    isSending,
    convertMentionsForSend,
    sendMessage,
  ]);

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!user || isSending) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((it) => it.type.startsWith("image/"));
      if (!imageItem) return;
      const file = imageItem.getAsFile();
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      const attachment = { file, preview: URL.createObjectURL(file) };
      setPendingAttachments((prev) => [...prev, attachment].slice(0, MAX_ATTACHMENTS));
    },
    [user, isSending],
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
      const isAutocompleteOpen = (showMentions && hasMentionOptions) || (showChannels && hasChannelOptions);
      const autocompleteKeys = ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"];

      // Let autocomplete handle navigation/selection without submitting.
      if (isAutocompleteOpen && autocompleteKeys.includes(e.key)) {
        e.preventDefault();
        return;
      }

      // Restore Discord-like "edit your last message" shortcut.
      if (e.key === "ArrowUp" && !isMobile && !content.trim() && pendingAttachments.length === 0 && user?.id) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("editLastMessage", {
            detail: { userId: user.id, channelId },
          }),
        );
        return;
      }

      if (e.key === "Enter" && !e.shiftKey && !isMobile) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [
      showMentions,
      hasMentionOptions,
      showChannels,
      hasChannelOptions,
      isMobile,
      content,
      pendingAttachments.length,
      user?.id,
      channelId,
      handleSubmit,
    ],
  );

  if (isMuted || (!canSendInReadOnly && isReadOnlyChannel)) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center py-4 bg-muted/30 rounded-2xl border border-border/50">
          <span className="text-muted-foreground">{isMuted ? "You are muted" : "Read-only channel"}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 sm:pb-6 relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) {
            const files = Array.from(e.target.files).map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
            setPendingAttachments((prev) => [...prev, ...files].slice(0, MAX_ATTACHMENTS));
          }
          e.target.value = "";
        }}
      />

      {showMentions && (
        <MentionAutocomplete
          query={mentionQuery}
          position={{ top: 40, left: 0 }}
          onSelect={(opt) => {
            const before = content.slice(0, mentionStartIndex);
            const after = content.slice(mentionStartIndex + mentionQuery.length + 1);
            if (opt.id) mentionMappingsRef.current.push({ username: opt.label, userId: opt.id });
            setContent(`${before}@${opt.label} ${after}`);
            setShowMentions(false);
            setHasMentionOptions(false);
          }}
          onClose={() => setShowMentions(false)}
          onOptionsChange={setHasMentionOptions}
        />
      )}

      {showChannels && (
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
      )}

      <SelectionFormatToolbar textareaRef={textareaRef} onFormat={handleFormat} />

      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b border-border/50 rounded-t-2xl">
          <span className="text-xs text-muted-foreground">
            Replying to{" "}
            {showReplyAuthorIdentity ? (
              <span className="text-primary">
                @{replyingTo.user?.display_name || replyingTo.user?.username || "unknown"}
              </span>
            ) : (
              <span className="text-primary italic">Anonymous</span>
            )}
          </span>
          <button onClick={() => setReplyingTo(null)} className="ml-auto p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <MobileOptimizedInput
        content={content}
        isFocused={isFocused}
        replyingTo={replyingTo}
        canSendMessage={canSendMessage}
        channelName={channelName}
        textareaRef={textareaRef}
        handleChange={handleChange}
        setIsFocused={setIsFocused}
        handleKeyDown={handleComposerKeyDown}
        handlePaste={handlePaste}
        showCreatePoll={showCreatePoll}
        setShowCreatePoll={setShowCreatePoll}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        isSending={isSending}
        handleSubmit={handleSubmit}
        handleEmojiSelect={(emoji: string) => setContent((prev) => prev + emoji)}
        currentServer={currentServer}
        onAttachClick={() => fileInputRef.current?.click()}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={(i: number) => setPendingAttachments((p) => p.filter((_, idx) => idx !== i))}
        onAddMore={() => fileInputRef.current?.click()}
      />
      <CreatePollModal open={showCreatePoll} onOpenChange={setShowCreatePoll} channelId={channelId} />
    </div>
  );
};

const MobileOptimizedInput = memo(
  ({
    content,
    isFocused,
    replyingTo,
    canSendMessage,
    channelName,
    textareaRef,
    handleChange,
    setIsFocused,
    handleKeyDown,
    handlePaste,
    showCreatePoll,
    setShowCreatePoll,
    showEmojiPicker,
    setShowEmojiPicker,
    isSending,
    handleSubmit,
    handleEmojiSelect,
    currentServer,
    onAttachClick,
    pendingAttachments,
    onRemoveAttachment,
    onAddMore,
  }: any) => {
    const isMobile = useIsMobile();
    const shouldCollapse = isMobile && content.length > 10;
    const hasAttachments = pendingAttachments.length > 0;

    return (
      <div
        className={`rounded-2xl bg-card/80 border transition-all ${isFocused ? "border-primary/30 shadow-lg" : "border-border/50"} ${replyingTo ? "rounded-t-none" : ""}`}
      >
        {hasAttachments && (
          <AttachmentPreviewBar
            attachments={pendingAttachments}
            onRemove={onRemoveAttachment}
            onAddMore={onAddMore}
            disabled={isSending}
          />
        )}
        <div className="flex items-end gap-2 p-2 sm:p-3">
          {!shouldCollapse && (
            <button
              onClick={onAttachClick}
              disabled={!canSendMessage}
              className="p-2 text-muted-foreground hover:bg-muted/50 transition-colors mb-0.5"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={canSendMessage ? `Message #${channelName}` : "Locked"}
            disabled={!canSendMessage}
            className="flex-1 bg-transparent resize-none outline-none py-2 px-1 min-h-[40px] max-h-[160px] text-[15px]"
            rows={1}
          />
          <ActionButtons
            showCreatePoll={showCreatePoll}
            setShowCreatePoll={setShowCreatePoll}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            canSendMessage={canSendMessage}
            content={content}
            isSending={isSending}
            hasAttachments={hasAttachments}
            onSubmit={handleSubmit}
            onEmojiSelect={handleEmojiSelect}
            currentServer={currentServer}
            showAttachButton={shouldCollapse}
            onAttachClick={onAttachClick}
          />
        </div>
      </div>
    );
  },
);
MobileOptimizedInput.displayName = "MobileOptimizedInput";
