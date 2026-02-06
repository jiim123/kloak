import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  Paperclip,
  Smile,
  Send,
  X,
  Loader2,
  WifiOff,
  Lock,
  SquareChartGantt,
  MoreHorizontal,
} from "lucide-react";
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
import { extractMentions, isImageOnlyMessage } from "@/lib/message";
import { ReplyPreview } from "./MessageContent";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { ChannelAutocomplete } from "./ChannelAutocomplete";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { ImageUploadDialog } from "@/components/modals/ImageUploadDialog";
import { CreatePollModal } from "@/components/modals/CreatePollModal";
import { SelectionFormatToolbar, FORMAT_SYNTAX, getCodeBlockSyntax } from "./FormatToolbar";
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

interface ChannelMapping {
  channelName: string;
  channelId: string;
}

const MAX_LENGTH = 2000;
const MIN_TEXTAREA_HEIGHT = 40;
const MAX_TEXTAREA_HEIGHT = 160;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const DRAFT_SAVE_DELAY = 500; // ms
const TYPING_STOP_DELAY = 2000; // ms

// Memoized action buttons to prevent re-renders
const ActionButtons = memo(
  ({
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
    onSubmit: () => void;
    onEmojiSelect: (emoji: string) => void;
    currentServer: any;
    showAttachButton?: boolean;
    onAttachClick?: () => void;
  }) => {
    const showCharacterWarning = content.length > MAX_LENGTH - 200;
    const isMobile = useIsMobile();
    const shouldCollapse = isMobile && content.length > 10;

    return (
      <div className="flex items-center gap-1 mb-0.5 relative">
        {/* Character count warning */}
        {showCharacterWarning && (
          <span
            className={`text-[13px] font-[Inter,system-ui,sans-serif] mr-1 ${content.length > MAX_LENGTH - 50 ? "text-destructive" : "text-muted-foreground"}`}
          >
            {MAX_LENGTH - content.length}
          </span>
        )}

        {/* Collapsed mobile menu when typing */}
        {shouldCollapse ? (
          <>
            {/* Collapsed actions dropdown */}
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

            {/* Emoji button - always visible */}
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
            {/* Poll button */}
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

            {/* Emoji button */}
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

        {/* Send button */}
        <button
          onClick={onSubmit}
          disabled={!content.trim() || isSending}
          className={`p-2 rounded-xl transition-all duration-150 ${
            content.trim() && !isSending
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
  const { getQueuedForChannel } = useOfflineQueueStore();

  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [showChannels, setShowChannels] = useState(false);
  const [channelQuery, setChannelQuery] = useState("");
  const [channelPosition, setChannelPosition] = useState({ top: 0, left: 0 });
  const [channelStartIndex, setChannelStartIndex] = useState(-1);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showCreatePoll, setShowCreatePoll] = useState(false);

  // Refs for non-reactive values
  const mentionMappingsRef = useRef<MentionMapping[]>([]);
  const channelMappingsRef = useRef<ChannelMapping[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
  const blockLinks = currentChannel?.block_links || false;
  const allowedLinkDomains = currentChannel?.allowed_link_domains || [];
  const { hasPermission } = useMemberPermissions(channelId);
  const canSendMessagesPermission = hasPermission("send_messages");
  const canSendInReadOnly = isReadOnlyChannel ? hasPermission("manage_messages") : true;
  const canSendMessage = !isMuted && canSendMessagesPermission && canSendInReadOnly;
  const isAdmin = hasPermission("manage_messages");

  // Create a map of channel IDs to channel names for quick lookup
  const channelIdToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach((channel) => {
      map.set(channel.id, channel.name);
    });
    return map;
  }, [channels]);

  // Create a map of user IDs to usernames for quick lookup
  const userIdToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      if (member.user) {
        map.set(member.user_id, member.nickname || member.user.display_name || member.user.username);
      }
    });
    return map;
  }, [members]);

  // Convert raw mentions/channels to readable format for display
  const convertToReadableFormat = useCallback(
    (text: string): string => {
      let result = text;

      // Convert channel mentions: <#channel-id> -> #channel-name
      result = result.replace(/<#([a-f0-9-]+)>/gi, (match, channelId) => {
        const channelName = channelIdToNameMap.get(channelId);
        return channelName ? `#${channelName}` : match;
      });

      // Convert user mentions: <@user-id> -> @username
      result = result.replace(/<@([a-f0-9-]+)>/gi, (match, userId) => {
        const userName = userIdToNameMap.get(userId);
        return userName ? `@${userName}` : match;
      });

      return result;
    },
    [channelIdToNameMap, userIdToNameMap],
  );

  // URL detection regex for link blocking
  const URL_REGEX = /https?:\/\/[^\s<]+/gi;

  // Check if message contains blocked links
  const containsBlockedLinks = useCallback(
    (text: string): boolean => {
      if (!blockLinks || isAdmin) return false;

      const urls = text.match(URL_REGEX);
      if (!urls || urls.length === 0) return false;

      // Check each URL against whitelist
      for (const url of urls) {
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace(/^www\./, "");

          // Check if domain is in whitelist
          const isWhitelisted = allowedLinkDomains.some((allowed) => {
            const normalizedAllowed = allowed.replace(/^www\./, "");
            return domain === normalizedAllowed || domain.endsWith("." + normalizedAllowed);
          });

          if (!isWhitelisted) {
            return true; // Found a blocked link
          }
        } catch {
          // Invalid URL, consider it blocked
          return true;
        }
      }

      return false;
    },
    [blockLinks, isAdmin, allowedLinkDomains],
  );

  // Memoized queued messages
  const queuedMessages = useMemo(() => getQueuedForChannel(channelId), [getQueuedForChannel, channelId]);

  // Load draft on channel change only
  useEffect(() => {
    const draft = getDraft(channelId);
    setContent(draft);
    mentionMappingsRef.current = [];
    channelMappingsRef.current = [];
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
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

  // Fixed auto-resize - always recalculate properly
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset to 0 to get accurate scrollHeight measurement
    textarea.style.height = "0px";

    // Calculate new height with min/max constraints
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);

    // Always apply the height
    textarea.style.height = `${newHeight}px`;
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

  // Detect channel tags efficiently
  const detectChannelTag = useCallback((value: string, cursorPosition: number) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const hashIndex = textBeforeCursor.lastIndexOf("#");

    if (hashIndex === -1) {
      setShowChannels(false);
      return;
    }

    const textAfterHash = textBeforeCursor.slice(hashIndex + 1);
    if (textAfterHash.includes(" ") || textAfterHash.includes("\n")) {
      setShowChannels(false);
      return;
    }

    setChannelQuery(textAfterHash);
    setChannelStartIndex(hashIndex);
    setShowChannels(true);
    setChannelPosition({ top: 40, left: 0 });
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

      // Detect mentions and channel tags
      detectMention(value, e.target.selectionStart);
      detectChannelTag(value, e.target.selectionStart);
    },
    [channelId, saveDraftDebounced, resizeTextarea, onTyping, onStopTyping, detectMention, detectChannelTag],
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

      setTimeout(() => {
        textareaRef.current?.focus();
        resizeTextarea();
      }, 50);
    },
    [content, mentionStartIndex, mentionQuery, resizeTextarea],
  );

  const handleChannelSelect = useCallback(
    (option: { id: string; name: string; type: string }) => {
      if (channelStartIndex === -1) return;

      const beforeChannel = content.slice(0, channelStartIndex);
      const afterChannel = content.slice(channelStartIndex + channelQuery.length + 1);

      const channelText = `#${option.name} `;

      const existingMapping = channelMappingsRef.current.find(
        (m) => m.channelName === option.name && m.channelId === option.id,
      );
      if (!existingMapping) {
        channelMappingsRef.current.push({
          channelName: option.name,
          channelId: option.id,
        });
      }

      setContent(beforeChannel + channelText + afterChannel);
      setShowChannels(false);
      setChannelStartIndex(-1);

      setTimeout(() => {
        textareaRef.current?.focus();
        resizeTextarea();
      }, 50);
    },
    [content, channelStartIndex, channelQuery, resizeTextarea],
  );

  // Helper functions
  const escapeRegex = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const convertMentionsForSend = useCallback((text: string): string => {
    let result = text;

    // Convert user mentions
    for (const mapping of mentionMappingsRef.current) {
      const regex = new RegExp(`@${escapeRegex(mapping.username)}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<@${mapping.userId}>`);
    }

    // Convert channel tags
    for (const mapping of channelMappingsRef.current) {
      const regex = new RegExp(`#${escapeRegex(mapping.channelName)}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<#${mapping.channelId}>`);
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

    // Check for blocked links
    if (containsBlockedLinks(messageContent)) {
      const whitelistMsg = allowedLinkDomains.length > 0 ? ` Allowed domains: ${allowedLinkDomains.join(", ")}` : "";
      showWarning("Links not allowed", `This channel doesn't allow posting links.${whitelistMsg}`);
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
    channelMappingsRef.current = [];
    onStopTyping();
    setShowMentions(false);
    setShowChannels(false);

    const currentReplyTo = replyingTo;
    setReplyingTo(null);
    setIsSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
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
    containsBlockedLinks,
    allowedLinkDomains,
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
            resizeTextarea();
          });
        }
      } else {
        const newContent = content.slice(0, start) + prefix + suffix + content.slice(end);
        if (newContent.length <= MAX_LENGTH) {
          setContent(newContent);
          requestAnimationFrame(() => {
            const cursorPos = start + prefix.length;
            textarea.setSelectionRange(cursorPos, cursorPos);
            resizeTextarea();
          });
        }
      }
    },
    [content, resizeTextarea],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((showMentions || showChannels) && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) {
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
    [showMentions, showChannels, applyFormatShortcut, handleSubmit, content, user?.id, channelId],
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!user || isMuted || isSending || !canSendMessage) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find((it) => it.type.startsWith("image/"));
      if (!imageItem) {
        // Text paste - trigger resize after paste completes
        requestAnimationFrame(() => {
          resizeTextarea();
        });
        return;
      }

      const file = imageItem.getAsFile();
      if (!file) return;

      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        showWarning("Invalid image", "Only JPEG, PNG, GIF, and WebP images are allowed");
        return;
      }

      if (file.size > MAX_IMAGE_FILE_SIZE) {
        showWarning("Image too large", "File size must be less than 1MB");
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

        // Reset textarea height
        if (textareaRef.current) {
          textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
        }

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
      resizeTextarea,
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
            resizeTextarea();
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
    [content, resizeTextarea],
  );

  const handleFormat = useCallback(
    (formatType: string, value?: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = content.slice(start, end);

      let syntax: { prefix: string; suffix: string };

      if (formatType === "codeblock") {
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
          resizeTextarea();
        });
      }
    },
    [content, resizeTextarea],
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
        <div className="flex items-center justify-center py-4 px-4 bg-muted/30 rounded-2xl border border-border/50">
          <span className="text-[14px] sm:text-[15px] leading-[1.5] font-[Inter,system-ui,sans-serif] text-muted-foreground">
            You are muted in this server
          </span>
        </div>
      </div>
    );
  }

  // Read-only state render
  if (isReadOnlyChannel && !hasPermission("manage_messages")) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center gap-2 py-4 px-4 bg-muted/30 rounded-2xl border border-border/50">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-[14px] sm:text-[15px] leading-[1.5] font-[Inter,system-ui,sans-serif] text-muted-foreground">
            Read-only channel
          </span>
        </div>
      </div>
    );
  }

  // No permission to send messages
  if (!canSendMessagesPermission) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center gap-2 py-4 px-4 bg-muted/30 rounded-2xl border border-border/50">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-[14px] sm:text-[15px] leading-[1.5] font-[Inter,system-ui,sans-serif] text-muted-foreground">
            You do not have permission to send messages in this channel
          </span>
        </div>
      </div>
    );
  }

  // Convert reply content to readable format
  const readableReplyContent = replyingTo?.content ? convertToReadableFormat(replyingTo.content) : "";

  return (
    <div className="px-4 pb-4 sm:pb-6 relative">
      {/* Queued messages indicator */}
      {queuedMessages.length > 0 && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 mb-2 bg-[hsl(var(--kloak-warning))]/10 border border-[hsl(var(--kloak-warning))]/20 rounded-xl text-[12px] sm:text-[13px] leading-[1.5] font-[Inter,system-ui,sans-serif] text-[hsl(var(--kloak-warning))]">
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

      {/* Channel Autocomplete */}
      {showChannels && (
        <ChannelAutocomplete
          query={channelQuery}
          position={channelPosition}
          onSelect={handleChannelSelect}
          onClose={() => setShowChannels(false)}
        />
      )}

      {/* Selection-based format toolbar */}
      <SelectionFormatToolbar
        textareaRef={textareaRef}
        onFormat={handleFormat}
      />

      {/* Reply preview */}
      {replyingTo &&
        (() => {
          // Check if ghost mode is enabled and reply author is not admin
          const isGhostMode = currentChannel?.ghost_mode || false;
          const replyAuthorMember = replyingTo.user?.id ? members.find((m) => m.user_id === replyingTo.user?.id) : null;
          const replyAuthorIsAdmin = replyAuthorMember
            ? replyAuthorMember.role === "owner" || replyAuthorMember.role === "admin"
            : false;
          const showReplyAuthorIdentity = !isGhostMode || replyAuthorIsAdmin;

          return (
            <div
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted/40 border-b border-border/50 font-[Inter,system-ui,sans-serif] rounded-t-2xl"
            >
              <span className="text-[12px] sm:text-[13px] leading-[1.5] text-muted-foreground">
                Replying to{" "}
                {showReplyAuthorIdentity ? (
                  <span className="font-medium text-primary">@{replyingTo.user?.username}</span>
                ) : (
                  <span className="font-medium text-primary italic">Anonymous</span>
                )}
              </span>
              {isImageOnlyMessage(replyingTo.content) ? (
                <img
                  src={replyingTo.content.trim()}
                  alt="Image attachment"
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              ) : (
                <span className="text-[12px] sm:text-[13px] leading-[1.5] text-muted-foreground truncate flex-1 hidden sm:inline">
                  <ReplyPreview content={readableReplyContent} maxLength={50} />
                </span>
              )}
              <button
                onClick={cancelReply}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150 ml-auto"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })()}

      {/* Floating input container */}
      <MobileOptimizedInput
        content={content}
        isFocused={isFocused}
        replyingTo={replyingTo}
        canSendMessage={canSendMessage}
        channelName={channelName}
        textareaRef={textareaRef}
        handleChange={handleChange}
        setIsFocused={setIsFocused}
        handleKeyDown={handleKeyDown}
        handlePaste={handlePaste}
        showCreatePoll={showCreatePoll}
        setShowCreatePoll={setShowCreatePoll}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        isSending={isSending}
        handleSubmit={handleSubmit}
        handleEmojiSelect={handleEmojiSelect}
        currentServer={currentServer}
        setShowImageUpload={setShowImageUpload}
      />

      {/* Image upload dialog */}
      <ImageUploadDialog open={showImageUpload} onOpenChange={setShowImageUpload} onUpload={handleImageUpload} />

      {/* Create poll modal */}
      <CreatePollModal open={showCreatePoll} onOpenChange={setShowCreatePoll} channelId={channelId} />
    </div>
  );
};

// Mobile-optimized input component
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
    setShowImageUpload,
  }: {
    content: string;
    isFocused: boolean;
    replyingTo: any;
    canSendMessage: boolean;
    channelName: string;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    handleChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    setIsFocused: (focused: boolean) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    showCreatePoll: boolean;
    setShowCreatePoll: (show: boolean) => void;
    showEmojiPicker: boolean;
    setShowEmojiPicker: (show: boolean) => void;
    isSending: boolean;
    handleSubmit: () => void;
    handleEmojiSelect: (emoji: string) => void;
    currentServer: any;
    setShowImageUpload: (show: boolean) => void;
  }) => {
    const isMobile = useIsMobile();
    const shouldCollapse = isMobile && content.length > 10;

    return (
      <div
        className={`
          rounded-2xl bg-card/80 border transition-all duration-200 ease-out
          ${isFocused ? "border-primary/30 shadow-lg shadow-primary/5 bg-card" : "border-border/50 hover:border-border"}
          ${replyingTo ? "rounded-t-none" : ""}
        `}
      >
        <div className="flex items-end gap-1 sm:gap-2 p-2 sm:p-3">
          {/* Attachment button - hidden when collapsed on mobile */}
          {!shouldCollapse && (
            <button
              onClick={() => setShowImageUpload(true)}
              disabled={!canSendMessage}
              className={`p-2 rounded-xl transition-colors duration-150 mb-0.5 flex-shrink-0 ${
                canSendMessage
                  ? "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  : "text-muted-foreground/50 cursor-not-allowed"
              }`}
              title="Upload image"
            >
              <Paperclip className="w-5 h-5" />
            </button>
          )}

          {/* Textarea - with improved mobile styles and fixed min-height */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={canSendMessage ? (channelName.length > (isMobile ? 12 : 17) ? `Message #${channelName.slice(0, isMobile ? 12 : 17)}…` : `Message #${channelName}`) : "You cannot send messages here"}
            disabled={!canSendMessage}
            rows={1}
            className={`message-input-textarea flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground/60 py-2 px-1 min-w-0 min-h-[40px] overflow-y-auto font-[Inter,system-ui,sans-serif] ${
              !canSendMessage ? "cursor-not-allowed opacity-50" : ""
            }`}
            style={{
              // Prevent iOS zoom on focus by using 16px minimum
              fontSize: isMobile ? "16px" : "15px",
              lineHeight: "1.5",
              fontWeight: 400,
              maxHeight: "160px",
            }}
          />

          {/* Action buttons - memoized */}
          <ActionButtons
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
            showAttachButton={shouldCollapse}
            onAttachClick={() => setShowImageUpload(true)}
          />
        </div>
      </div>
    );
  },
);
MobileOptimizedInput.displayName = "MobileOptimizedInput";
