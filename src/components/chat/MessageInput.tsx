import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { Paperclip, Smile, Send, X, Loader2, WifiOff, Type, Lock, SquareChartGantt } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useServerStore } from "@/stores/serverStore";
import { useOfflineQueueStore } from "@/stores/offlineQueueStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { saveDraft, getDraft, clearDraft } from "@/lib/storage";
import { extractMentions, isImageOnlyMessage } from "@/lib/message";
import { ReplyPreview } from "./MessageContent";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { EmojiGifPicker } from "@/components/modals/EmojiGifPicker";
import { ImageUploadDialog } from "@/components/modals/ImageUploadDialog";
import { CreatePollModal } from "@/components/modals/CreatePollModal";
import { FormatToolbar, FORMAT_SYNTAX, getColorSyntax, getCodeBlockSyntax } from "./FormatToolbar";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showWarning, handleError } from "@/lib/errorHandler";
import { messageRateLimiter, validateMessageContent } from "@/lib/security";

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

const MAX_LENGTH = 2000;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const DRAFT_SAVE_DELAY = 500; // ms
const TYPING_STOP_DELAY = 2000; // ms

// Memoized action buttons to prevent re-renders
const ActionButtons = memo(
  ({
    showFormatToolbar,
    setShowFormatToolbar,
    showCreatePoll,
    setShowCreatePoll,
    showEmojiPicker,
    setShowEmojiPicker,
    canSendMessage,
    content,
    isSending,
    onSubmit,
    onEmojiSelect,
    currentServer,
  }: {
    showFormatToolbar: boolean;
    setShowFormatToolbar: (show: boolean) => void;
    showCreatePoll: boolean;
    setShowCreatePoll: (show: boolean) => void;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (show: boolean) => void;
    canSendMessage: boolean;
    content: string;
    isSending: boolean;
    onSubmit: () => void;
    onEmojiSelect: (emoji: string) => void;
    currentServer: any;
  }) => {
    const showCharacterWarning = content.length > MAX_LENGTH - 200;

    return (
      <div className="flex items-center gap-1 mb-0.5 relative">
        {/* Format toolbar */}
        {showFormatToolbar && (
          <div className="absolute bottom-full right-0 mb-2 z-50">
            <FormatToolbar onFormat={() => {}} onClose={() => setShowFormatToolbar(false)} />
          </div>
        )}

        {/* Character count warning */}
        {showCharacterWarning && (
          <span
            className={`text-xs mr-1 ${content.length > MAX_LENGTH - 50 ? "text-destructive" : "text-muted-foreground"}`}
          >
            {MAX_LENGTH - content.length}
          </span>
        )}

        {/* Format button */}
        <button
          type="button"
          onClick={() => setShowFormatToolbar(!showFormatToolbar)}
          className={`p-2 rounded-xl transition-colors duration-150 ${
            showFormatToolbar
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          onMouseDown={(e) => e.preventDefault()}
          title="Format text"
        >
          <Type className="w-5 h-5" />
        </button>

        {/* Poll button */}
        <button
          type="button"
          onClick={() => setShowCreatePoll(true)}
          disabled={!canSendMessage}
          className={`p-2 rounded-xl transition-colors duration-150 ${
            canSendMessage
              ? "text-muted-foreground hover:text-foreground hover:bg-muted"
              : "text-muted-foreground/50 cursor-not-allowed"
          }`}
          onMouseDown={(e) => e.preventDefault()}
          title="Create poll"
        >
          <SquareChartGantt className="w-5 h-5" />
        </button>

        {/* Emoji button */}
        <EmojiGifPicker
          open={showEmojiPicker}
          onOpenChange={setShowEmojiPicker}
          onEmojiSelect={onEmojiSelect}
          disableGif
          serverId={currentServer?.id}
          serverName={currentServer?.name}
        >
          <button
            type="button"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Smile className="w-5 h-5" />
          </button>
        </EmojiGifPicker>

        {/* Send button */}
        <button
          onClick={onSubmit}
          disabled={!content.trim() || isSending}
          className={`p-2 rounded-xl transition-all duration-150 ${
            content.trim() && !isSending
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
              : "bg-muted text-muted-foreground cursor-not-allowed"
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
  const { members, currentServer, currentChannel, fetchRolePermissions, fetchChannelPermissions } = useServerStore();
  const { getQueuedForChannel } = useOfflineQueueStore();

  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  // Refs for non-reactive values
  const mentionMappingsRef = useRef<MentionMapping[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastHeightRef = useRef<number>(0);

  // Load permissions when server/channel changes
  useEffect(() => {
    if (currentServer?.id) {
      fetchRolePermissions(currentServer.id);
    }
    if (channelId) {
      fetchChannelPermissions(channelId);
    }
  }, [currentServer?.id, channelId, fetchRolePermissions, fetchChannelPermissions]);

  // Memoized permission checks
  const currentMember = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user?.id]);
  const isMuted = currentMember?.is_muted || false;
  const isReadOnlyChannel = currentChannel?.is_read_only || false;

  const { hasPermission } = useMemberPermissions(channelId);
  const canSendMessagesPermission = hasPermission("send_messages");
  const canSendInReadOnly = isReadOnlyChannel ? hasPermission("manage_messages") : true;
  const canSendMessage = !isMuted && canSendMessagesPermission && canSendInReadOnly;

  // Memoized queued messages
  const queuedMessages = useMemo(() => getQueuedForChannel(channelId), [getQueuedForChannel, channelId]);

  // Load draft on channel change only
  useEffect(() => {
    const draft = getDraft(channelId);
    setContent(draft);
    mentionMappingsRef.current = [];

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [channelId]);

  // Focus textarea when replying
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  // Debounced draft save
  const saveDraftDebounced = useCallback((channelId: string, content: string) => {
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }
    draftSaveTimeoutRef.current = setTimeout(() => {
      saveDraft(channelId, content);
    }, DRAFT_SAVE_DELAY);
  }, []);

  // Optimized auto-resize - only resize when needed
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to measure actual content
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, 160);

    // Only update if height changed
    if (newHeight !== lastHeightRef.current) {
      textarea.style.height = newHeight + "px";
      lastHeightRef.current = newHeight;
    }
  }, []);

  // Detect mentions efficiently
  const detectMention = useCallback((value: string, cursorPosition: number) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex === -1) {
      setShowMentions(false);
      return;
    }

    const textAfterAt = textBeforeCursor.slice(atIndex + 1);

    if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) {
      setShowMentions(false);
      return;
    }

    setMentionQuery(textAfterAt);
    setMentionStartIndex(atIndex);
    setShowMentions(true);
    setMentionPosition({ top: 40, left: 0 });
  }, []);

  // Optimized change handler
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length > MAX_LENGTH) return;

      setContent(value);

      // Debounced draft save
      saveDraftDebounced(channelId, value);

      // Resize textarea
      resizeTextarea();

      // Typing indicator with debounce
      onTyping();
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(onStopTyping, TYPING_STOP_DELAY);

      // Detect mentions
      detectMention(value, e.target.selectionStart);
    },
    [channelId, saveDraftDebounced, resizeTextarea, onTyping, onStopTyping, detectMention],
  );

  const handleMentionSelect = useCallback(
    (option: { type: string; id?: string; label: string }) => {
      if (mentionStartIndex === -1) return;

      const beforeMention = content.slice(0, mentionStartIndex);
      const afterMention = content.slice(mentionStartIndex + mentionQuery.length + 1);

      let mentionText: string;
      if (option.type === "user" && option.id) {
        mentionText = `@${option.label} `;
        const existingMapping = mentionMappingsRef.current.find(
          (m) => m.username === option.label && m.userId === option.id,
        );
        if (!existingMapping) {
          mentionMappingsRef.current.push({
            username: option.label,
            userId: option.id,
          });
        }
      } else {
        mentionText = `@${option.type} `;
      }

      setContent(beforeMention + mentionText + afterMention);
      setShowMentions(false);
      setMentionStartIndex(-1);

      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    [content, mentionStartIndex, mentionQuery],
  );

  // Helper functions
  const escapeRegex = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const convertMentionsForSend = useCallback((text: string): string => {
    let result = text;
    for (const mapping of mentionMappingsRef.current) {
      const regex = new RegExp(`@${escapeRegex(mapping.username)}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<@${mapping.userId}>`);
    }
    result = result.replace(/@everyone(?=\s|$)/g, "@everyone");
    result = result.replace(/@here(?=\s|$)/g, "@here");
    return result;
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!content.trim() || !user || isMuted || isSending || !canSendMessage) return;

    const messageContent = content.trim();

    const validation = validateMessageContent(messageContent);
    if (!validation.valid) {
      showWarning("Invalid message", validation.error || "Please check your message");
      return;
    }

    if (!messageRateLimiter.isAllowed(user.id)) {
      const remaining = messageRateLimiter.getRemainingTime(user.id);
      showWarning("Slow down cowboy!", `Try again in ${remaining} seconds`);
      return;
    }

    const contentToSend = convertMentionsForSend(messageContent);

    // Cancel any pending draft save to prevent it from overwriting the cleared draft
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }

    // Clear input immediately
    setContent("");
    clearDraft(channelId);
    mentionMappingsRef.current = [];
    onStopTyping();
    setShowMentions(false);

    const currentReplyTo = replyingTo;
    setReplyingTo(null);
    setIsSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      lastHeightRef.current = 0;
    }

    try {
      const message = await sendMessage(channelId, user.id, contentToSend, currentReplyTo?.id);

      if (message) {
        const auth = useAuthStore.getState();
        if (auth.manualStatus !== "offline") {
          auth.updateLastSeen();
        }
        if (auth.manualStatus !== "offline" && auth.manualStatus !== "dnd") {
          auth.updateStatus("online", { source: "auto" });
        }

        // Process mentions in background
        if (currentServer) {
          const mentions = extractMentions(contentToSend);
          Promise.resolve()
            .then(async () => {
              for (const mention of mentions) {
                if (mention.type === "user" && mention.id && mention.id !== user.id) {
                  await supabase.from("mentions").insert({
                    message_id: message.id,
                    user_id: mention.id,
                    mention_type: "user",
                  });
                } else if (mention.type === "everyone" || mention.type === "here") {
                  const targetMembers =
                    mention.type === "here"
                      ? members.filter((m) => m.user?.status === "online" && m.user_id !== user.id)
                      : members.filter((m) => m.user_id !== user.id);
                  for (const member of targetMembers.slice(0, 50)) {
                    await supabase.from("mentions").insert({
                      message_id: message.id,
                      user_id: member.user_id,
                      mention_type: mention.type,
                    });
                  }
                }
              }
            })
            .catch((err) => console.error("Failed to process mentions:", err));
        }
      }
    } catch (error) {
      handleError(error, "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [
    content,
    user,
    isMuted,
    isSending,
    canSendMessage,
    channelId,
    replyingTo,
    setReplyingTo,
    sendMessage,
    convertMentionsForSend,
    onStopTyping,
    currentServer,
    members,
  ]);

  const applyFormatShortcut = useCallback(
    (formatType: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.slice(start, end);
      const syntax = FORMAT_SYNTAX[formatType];
      if (!syntax) return;

      const { prefix, suffix } = syntax;
      if (selectedText) {
        const newContent = content.slice(0, start) + prefix + selectedText + suffix + content.slice(end);
        if (newContent.length <= MAX_LENGTH) {
          setContent(newContent);
          requestAnimationFrame(() => {
            const newPos = start + prefix.length + selectedText.length + suffix.length;
            textarea.setSelectionRange(newPos, newPos);
          });
        }
      } else {
        const newContent = content.slice(0, start) + prefix + suffix + content.slice(end);
        if (newContent.length <= MAX_LENGTH) {
          setContent(newContent);
          requestAnimationFrame(() => {
            const cursorPos = start + prefix.length;
            textarea.setSelectionRange(cursorPos, cursorPos);
          });
        }
      }
    },
    [content],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (showMentions && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b":
            e.preventDefault();
            applyFormatShortcut("bold");
            return;
          case "i":
            e.preventDefault();
            applyFormatShortcut("italic");
            return;
          case "u":
            e.preventDefault();
            applyFormatShortcut("underline");
            return;
          case "e":
            e.preventDefault();
            applyFormatShortcut("code");
            return;
          case "p":
            e.preventDefault();
            applyFormatShortcut("spoiler");
            return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }

      if (e.key === "ArrowUp" && !content.trim()) {
        e.preventDefault();
        window.dispatchEvent(
          new CustomEvent("editLastMessage", {
            detail: { userId: user?.id, channelId },
          }),
        );
      }
    },
    [showMentions, applyFormatShortcut, handleSubmit, content, user?.id, channelId],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!user || isMuted || isSending || !canSendMessage) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find((it) => it.type.startsWith("image/"));
      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showWarning("Invalid image", "Only JPEG, PNG, GIF, and WebP images are allowed");
        return;
      }

      if (file.size > MAX_IMAGE_FILE_SIZE) {
        showWarning("Image too large", "File size must be less than 10MB");
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      setIsSending(true);
      const currentReplyTo = replyingTo;

      try {
        const timestamp = Date.now();
        const fileExt = file.name.split(".").pop() || "png";
        const fileName = `${user.id}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

        const { data, error } = await supabase.storage.from("attachments").upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

        if (error) throw error;

        const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(data.path);

        const caption = content.trim();
        const captionToSend = caption ? convertMentionsForSend(caption) : "";
        const combined = captionToSend ? `${captionToSend}\n${urlData.publicUrl}` : urlData.publicUrl;

        // Cancel any pending draft save to prevent it from overwriting the cleared draft
        if (draftSaveTimeoutRef.current) {
          clearTimeout(draftSaveTimeoutRef.current);
          draftSaveTimeoutRef.current = null;
        }

        setContent("");
        clearDraft(channelId);
        mentionMappingsRef.current = [];
        onStopTyping();
        setShowMentions(false);
        setReplyingTo(null);

        const message = await sendMessage(channelId, user.id, combined, currentReplyTo?.id);

        if (message) {
          const auth = useAuthStore.getState();
          if (auth.manualStatus !== "offline") {
            auth.updateLastSeen();
          }
          if (auth.manualStatus !== "offline" && auth.manualStatus !== "dnd") {
            auth.updateStatus("online", { source: "auto" });
          }
        }

        showSuccess("Image uploaded successfully");
      } catch (error) {
        setReplyingTo(currentReplyTo ?? null);
        handleError(error, "Failed to upload image");
      } finally {
        setIsSending(false);
      }
    },
    [
      user,
      isMuted,
      isSending,
      canSendMessage,
      content,
      channelId,
      replyingTo,
      setReplyingTo,
      sendMessage,
      convertMentionsForSend,
      onStopTyping,
    ],
  );

  const cancelReply = useCallback(() => {
    setReplyingTo(null);
  }, [setReplyingTo]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent = content.slice(0, start) + emoji + content.slice(end);
        if (newContent.length <= MAX_LENGTH) {
          setContent(newContent);
          requestAnimationFrame(() => {
            const newCursorPos = start + emoji.length;
            textarea.setSelectionRange(newCursorPos, newCursorPos);
          });
        }
      } else {
        const newContent = content + emoji;
        if (newContent.length <= MAX_LENGTH) {
          setContent(newContent);
        }
      }
      setShowEmojiPicker(false);
    },
    [content],
  );

  const handleFormat = useCallback(
    (formatType: string, value?: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.slice(start, end);

      let syntax: { prefix: string; suffix: string };
      if (formatType === "color" && value) {
        syntax = getColorSyntax(value);
      } else if (formatType === "codeblock") {
        syntax = getCodeBlockSyntax(value || "");
      } else {
        syntax = FORMAT_SYNTAX[formatType];
      }

      if (!syntax) return;

      const { prefix, suffix } = syntax;
      const textToWrap = selectedText || "text";
      const newContent = content.slice(0, start) + prefix + textToWrap + suffix + content.slice(end);

      if (newContent.length <= MAX_LENGTH) {
        setContent(newContent);
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
      }
    },
    [content],
  );

  const handleImageUpload = useCallback(
    async (file: File) => {
      if (!user) throw new Error("Not authenticated");

      const timestamp = Date.now();
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

      const { data, error } = await supabase.storage.from("attachments").upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(data.path);

      await sendMessage(channelId, user.id, urlData.publicUrl, replyingTo?.id);

      const auth = useAuthStore.getState();
      if (auth.manualStatus !== "offline") {
        auth.updateLastSeen();
      }
      if (auth.manualStatus !== "offline" && auth.manualStatus !== "dnd") {
        auth.updateStatus("online", { source: "auto" });
      }

      if (replyingTo) {
        setReplyingTo(null);
      }

      showSuccess("Image uploaded successfully");
    },
    [user, channelId, replyingTo, setReplyingTo, sendMessage],
  );

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    };
  }, []);

  // Muted state render
  if (isMuted) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center py-4 px-4 bg-secondary rounded-2xl">
          <span className="text-muted-foreground">You are muted in this server</span>
        </div>
      </div>
    );
  }

  // Read-only state render
  if (isReadOnlyChannel && !hasPermission("manage_messages")) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center gap-2 py-4 px-4 bg-secondary rounded-2xl border border-border">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">Read-only channel</span>
        </div>
      </div>
    );
  }

  // No permission to send messages
  if (!canSendMessagesPermission) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center gap-2 py-4 px-4 bg-secondary rounded-2xl border border-border">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-muted-foreground">You do not have permission to send messages in this channel</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 sm:pb-6 relative">
      {/* Queued messages indicator */}
      {queuedMessages.length > 0 && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 mb-2 bg-[hsl(var(--kloak-warning))]/10 border border-[hsl(var(--kloak-warning))]/20 rounded-xl text-xs sm:text-sm text-[hsl(var(--kloak-warning))]">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>
            {queuedMessages.length} message{queuedMessages.length > 1 ? "s" : ""} waiting to send
          </span>
        </div>
      )}

      {/* Mention Autocomplete */}
      {showMentions && (
        <MentionAutocomplete
          query={mentionQuery}
          position={mentionPosition}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentions(false)}
          isAdmin={hasPermission("manage_messages")}
        />
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-secondary rounded-t-2xl border-b border-border">
          <span className="text-xs sm:text-sm text-muted-foreground">
            Replying to <span className="font-medium text-primary">@{replyingTo.user?.username}</span>
          </span>
          {isImageOnlyMessage(replyingTo.content) ? (
            <img 
              src={replyingTo.content.trim()} 
              alt="Image attachment" 
              className="w-8 h-8 rounded object-cover flex-shrink-0"
            />
          ) : (
            <span className="text-xs sm:text-sm text-muted-foreground truncate flex-1 hidden sm:inline">
              <ReplyPreview content={replyingTo.content} maxLength={50} />
            </span>
          )}
          <button
            onClick={cancelReply}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating input container */}
      <div
        className={`
          rounded-2xl bg-secondary border transition-all duration-200 ease-out
          ${isFocused ? "border-border shadow-lg" : "border-transparent"}
          ${replyingTo ? "rounded-t-none" : ""}
        `}
      >
        <div className="flex items-end gap-1 sm:gap-2 p-2 sm:p-3">
          {/* Attachment button */}
          <button
            onClick={() => setShowImageUpload(true)}
            disabled={!canSendMessage}
            className={`p-2 rounded-xl transition-colors duration-150 mb-0.5 flex-shrink-0 ${
              canSendMessage
                ? "text-muted-foreground hover:text-foreground hover:bg-muted"
                : "text-muted-foreground/50 cursor-not-allowed"
            }`}
            title="Upload image"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={canSendMessage ? `Message #${channelName}` : "You do not have permission to send messages in this channel"}
            disabled={!canSendMessage}
            rows={1}
            className={`flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground text-sm sm:text-[15px] leading-relaxed py-2 px-1 font-light min-w-0 ${
              !canSendMessage ? "cursor-not-allowed opacity-50" : ""
            }`}
            style={{ fontFamily: "system-ui, -apple-system, sans-serif, 'Noto Color Emoji'" }}
          />

          {/* Action buttons - memoized */}
          <ActionButtons
            showFormatToolbar={showFormatToolbar}
            setShowFormatToolbar={setShowFormatToolbar}
            showCreatePoll={showCreatePoll}
            setShowCreatePoll={setShowCreatePoll}
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            canSendMessage={canSendMessage}
            content={content}
            isSending={isSending}
            onSubmit={handleSubmit}
            onEmojiSelect={handleEmojiSelect}
            currentServer={currentServer}
          />
        </div>
      </div>

      {/* Image upload dialog */}
      <ImageUploadDialog open={showImageUpload} onOpenChange={setShowImageUpload} onUpload={handleImageUpload} />

      {/* Create poll modal */}
      <CreatePollModal open={showCreatePoll} onOpenChange={setShowCreatePoll} channelId={channelId} />
    </div>
  );
};
