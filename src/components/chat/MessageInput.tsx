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
import { CreatePollModal } from "@/components/modals/CreatePollModal";
import { SelectionFormatToolbar, FORMAT_SYNTAX, getCodeBlockSyntax } from "./FormatToolbar";
import { AttachmentPreviewBar, PendingAttachment } from "./AttachmentPreviewBar";
import { supabase } from "@/integrations/supabase/client";
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

        {/* Send button */}
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
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const canUseExternalEmojis = hasPermission("use_external_emojis");

  const channelIdToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach((channel) => map.set(channel.id, channel.name));
    return map;
  }, [channels]);

  const userIdToNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      if (member.user) {
        map.set(member.user_id, member.nickname || member.user.display_name || member.user.username);
      }
    });
    return map;
  }, [members]);

  const convertToReadableFormat = useCallback(
    (text: string): string => {
      let result = text;
      result = result.replace(/<#([a-f0-9-]+)>/gi, (match, cId) => {
        const name = channelIdToNameMap.get(cId);
        return name ? `#${name}` : match;
      });
      result = result.replace(/<@([a-f0-9-]+)>/gi, (match, uId) => {
        const name = userIdToNameMap.get(uId);
        return name ? `@${name}` : match;
      });
      return result;
    },
    [channelIdToNameMap, userIdToNameMap],
  );

  const URL_REGEX = /https?:\/\/[^\s<]+/gi;

  const containsBlockedLinks = useCallback(
    (text: string): boolean => {
      if (!blockLinks || isAdmin) return false;
      const urls = text.match(URL_REGEX);
      if (!urls || urls.length === 0) return false;
      for (const url of urls) {
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace(/^www\./, "");
          const isWhitelisted = allowedLinkDomains.some((allowed) => {
            const normalizedAllowed = allowed.replace(/^www\./, "");
            return domain === normalizedAllowed || domain.endsWith("." + normalizedAllowed);
          });
          if (!isWhitelisted) return true;
        } catch {
          return true;
        }
      }
      return false;
    },
    [blockLinks, isAdmin, allowedLinkDomains],
  );

  const queuedMessages = useMemo(() => getQueuedForChannel(channelId), [getQueuedForChannel, channelId]);

  // Load draft on channel change
  useEffect(() => {
    const draft = getDraft(channelId);
    setContent(draft);
    mentionMappingsRef.current = [];
    channelMappingsRef.current = [];
    // Clear pending attachments when switching channels
    setPendingAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }
  }, [channelId]);

  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  const saveDraftDebounced = useCallback((channelId: string, content: string) => {
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => {
      saveDraft(channelId, content);
    }, DRAFT_SAVE_DELAY);
  }, []);

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, []);

  const detectMention = useCallback((value: string, cursorPosition: number) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    if (atIndex === -1) { setShowMentions(false); return; }
    const textAfterAt = textBeforeCursor.slice(atIndex + 1);
    if (textAfterAt.includes(" ") || textAfterAt.includes("\n")) { setShowMentions(false); return; }
    setMentionQuery(textAfterAt);
    setMentionStartIndex(atIndex);
    setShowMentions(true);
    setMentionPosition({ top: 40, left: 0 });
  }, []);

  const detectChannelTag = useCallback((value: string, cursorPosition: number) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const hashIndex = textBeforeCursor.lastIndexOf("#");
    if (hashIndex === -1) { setShowChannels(false); return; }
    const textAfterHash = textBeforeCursor.slice(hashIndex + 1);
    if (textAfterHash.includes(" ") || textAfterHash.includes("\n")) { setShowChannels(false); return; }
    setChannelQuery(textAfterHash);
    setChannelStartIndex(hashIndex);
    setShowChannels(true);
    setChannelPosition({ top: 40, left: 0 });
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length > MAX_LENGTH) return;
      setContent(value);
      saveDraftDebounced(channelId, value);
      resizeTextarea();
      onTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(onStopTyping, TYPING_STOP_DELAY);
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
        const existing = mentionMappingsRef.current.find((m) => m.username === option.label && m.userId === option.id);
        if (!existing) mentionMappingsRef.current.push({ username: option.label, userId: option.id });
      } else {
        mentionText = `@${option.type} `;
      }
      setContent(beforeMention + mentionText + afterMention);
      setShowMentions(false);
      setMentionStartIndex(-1);
      setTimeout(() => { textareaRef.current?.focus(); resizeTextarea(); }, 50);
    },
    [content, mentionStartIndex, mentionQuery, resizeTextarea],
  );

  const handleChannelSelect = useCallback(
    (option: { id: string; name: string; type: string }) => {
      if (channelStartIndex === -1) return;
      const beforeChannel = content.slice(0, channelStartIndex);
      const afterChannel = content.slice(channelStartIndex + channelQuery.length + 1);
      const channelText = `#${option.name} `;
      const existing = channelMappingsRef.current.find((m) => m.channelName === option.name && m.channelId === option.id);
      if (!existing) channelMappingsRef.current.push({ channelName: option.name, channelId: option.id });
      setContent(beforeChannel + channelText + afterChannel);
      setShowChannels(false);
      setChannelStartIndex(-1);
      setTimeout(() => { textareaRef.current?.focus(); resizeTextarea(); }, 50);
    },
    [content, channelStartIndex, channelQuery, resizeTextarea],
  );

  const escapeRegex = (string: string): string => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const convertMentionsForSend = useCallback((text: string): string => {
    let result = text;
    for (const mapping of mentionMappingsRef.current) {
      const regex = new RegExp(`@${escapeRegex(mapping.username)}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<@${mapping.userId}>`);
    }
    for (const mapping of channelMappingsRef.current) {
      const regex = new RegExp(`#${escapeRegex(mapping.channelName)}(?=\\s|$|[.,!?;:])`, "g");
      result = result.replace(regex, `<#${mapping.channelId}>`);
    }
    result = result.replace(/@everyone(?=\s|$)/g, "@everyone");
    result = result.replace(/@here(?=\s|$)/g, "@here");
    return result;
  }, []);

  // ---- Attachment queue helpers ----
  const addFilesToQueue = useCallback((files: File[]) => {
    setPendingAttachments((prev) => {
      const remaining = MAX_ATTACHMENTS - prev.length;
      if (remaining <= 0) {
        toast.warning("You can attach up to 10 files per message");
        return prev;
      }
      const toAdd = files.slice(0, remaining);
      if (files.length > remaining) {
        toast.warning(`Only ${remaining} more file(s) can be added (max ${MAX_ATTACHMENTS})`);
      }
      const valid: PendingAttachment[] = [];
      for (const file of toAdd) {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          toast.warning("Only JPEG, PNG, GIF, and WebP images are allowed");
          continue;
        }
        if (file.size > MAX_IMAGE_FILE_SIZE) {
          toast.warning("File size must be less than 1MB");
          continue;
        }
        valid.push({ file, preview: URL.createObjectURL(file) });
      }
      return [...prev, ...valid];
    });
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  }, []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(Array.from(e.target.files));
    }
    e.target.value = "";
  }, [addFilesToQueue]);

  // Upload all pending attachments and return their URLs
  const uploadAttachments = useCallback(async (): Promise<string[]> => {
    if (!user || pendingAttachments.length === 0) return [];

    // Mark all as uploading
    setPendingAttachments((prev) => prev.map((a) => ({ ...a, uploading: true })));

    const urls: string[] = [];
    for (const att of pendingAttachments) {
      const timestamp = Date.now();
      const fileExt = att.file.name.split(".").pop() || "png";
      const fileName = `${user.id}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

      const { data, error } = await supabase.storage.from("attachments").upload(fileName, att.file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(data.path);
      urls.push(urlData.publicUrl);
    }
    return urls;
  }, [user, pendingAttachments]);

  const clearAttachments = useCallback(() => {
    setPendingAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    const hasText = content.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;
    if ((!hasText && !hasAttachments) || !user || isMuted || isSending || !canSendMessage) return;

    const messageContent = content.trim();

    if (hasText) {
      const validation = validateMessageContent(messageContent);
      if (!validation.valid) {
        showWarning("Invalid message", validation.error || "Please check your message");
        return;
      }
      if (containsBlockedLinks(messageContent)) {
        const whitelistMsg = allowedLinkDomains.length > 0 ? ` Allowed domains: ${allowedLinkDomains.join(", ")}` : "";
        showWarning("Links not allowed", `This channel doesn't allow posting links.${whitelistMsg}`);
        return;
      }
    }

    if (!messageRateLimiter.isAllowed(user.id)) {
      const remaining = messageRateLimiter.getRemainingTime(user.id);
      showWarning("Slow down cowboy!", `Try again in ${remaining} seconds`);
      return;
    }

    const contentToSend = hasText ? convertMentionsForSend(messageContent) : "";

    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }

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

    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }

    try {
      let finalContent = contentToSend;

      // Upload attachments if any
      if (hasAttachments) {
        const urls = await uploadAttachments();
        const urlBlock = urls.join("\n");
        finalContent = finalContent ? `${finalContent}\n${urlBlock}` : urlBlock;
        clearAttachments();
      }

      const message = await sendMessage(channelId, user.id, finalContent, currentReplyTo?.id);

      if (message) {
        const auth = useAuthStore.getState();
        if (auth.manualStatus !== "offline") auth.updateLastSeen();
        if (auth.manualStatus !== "offline" && auth.manualStatus !== "dnd") {
          auth.updateStatus("online", { source: "auto" });
        }

        if (currentServer) {
          const mentions = extractMentions(finalContent);
          Promise.resolve()
            .then(async () => {
              const mentionBatch: { user_id: string; mention_type: string }[] = [];
              for (const mention of mentions) {
                if (mention.type === "user" && mention.id && mention.id !== user.id) {
                  mentionBatch.push({ user_id: mention.id, mention_type: "user" });
                } else if (mention.type === "everyone" || mention.type === "here") {
                  const targetMembers =
                    mention.type === "here"
                      ? members.filter((m) => m.user?.status === "online" && m.user_id !== user.id)
                      : members.filter((m) => m.user_id !== user.id);
                  for (const member of targetMembers.slice(0, 50)) {
                    mentionBatch.push({ user_id: member.user_id, mention_type: mention.type });
                  }
                }
              }
              if (mentionBatch.length > 0) {
                await supabase.rpc('insert_mentions' as any, {
                  _message_id: message.id,
                  _mentions: mentionBatch,
                });
              }
            })
            .catch((err) => console.error("Failed to process mentions:", err));
        }
      }
    } catch (error) {
      handleError(error, "Failed to send message");
      // Keep attachments on failure so user can retry
    } finally {
      setIsSending(false);
    }
  }, [
    content,
    pendingAttachments,
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
    uploadAttachments,
    clearAttachments,
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
      if ((showMentions || showChannels) && ["ArrowDown", "ArrowUp", "Enter", "Tab", "Escape"].includes(e.key)) return;

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "b": e.preventDefault(); applyFormatShortcut("bold"); return;
          case "i": e.preventDefault(); applyFormatShortcut("italic"); return;
          case "e": e.preventDefault(); applyFormatShortcut("code"); return;
          case "p": e.preventDefault(); applyFormatShortcut("spoiler"); return;
        }
      }

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }

      if (e.key === "ArrowUp" && !content.trim() && pendingAttachments.length === 0) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("editLastMessage", { detail: { userId: user?.id, channelId } }));
      }
    },
    [showMentions, showChannels, applyFormatShortcut, handleSubmit, content, user?.id, channelId, pendingAttachments.length],
  );

  // Paste handler: queue images instead of sending immediately
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!user || isMuted || isSending || !canSendMessage) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      const imageItem = Array.from(items).find((it) => it.type.startsWith("image/"));
      if (!imageItem) {
        requestAnimationFrame(() => resizeTextarea());
        return;
      }

      const file = imageItem.getAsFile();
      if (!file) return;

      e.preventDefault();
      e.stopPropagation();

      addFilesToQueue([file]);
    },
    [user, isMuted, isSending, canSendMessage, addFilesToQueue, resizeTextarea],
  );

  const cancelReply = useCallback(() => setReplyingTo(null), [setReplyingTo]);

  const handleEmojiSelect = useCallback(
    (emoji: string) => {
      const customMatch = emoji.match(/^:([a-z0-9_]{2,32}):$/i);
      if (customMatch && !canUseExternalEmojis) {
        const serverEmojis = useServerStore.getState().currentServer?.id;
        if (serverEmojis) {
          import("@/lib/serverEmojis").then(({ fetchServerEmojis }) => {
            fetchServerEmojis(serverEmojis).then((emojis) => {
              const isLocal = emojis.some((e) => e.name === customMatch[1]);
              if (!isLocal) { toast.error("You don't have permission to use external emojis"); return; }
              insertEmoji(emoji);
            });
          });
          setShowEmojiPicker(false);
          return;
        }
      }
      insertEmoji(emoji);
      setShowEmojiPicker(false);
    },
    [content, resizeTextarea, canUseExternalEmojis],
  );

  const insertEmoji = useCallback(
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
        if (newContent.length <= MAX_LENGTH) setContent(newContent);
      }
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

  // Cleanup
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    };
  }, []);

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

  const readableReplyContent = replyingTo?.content ? convertToReadableFormat(replyingTo.content) : "";

  return (
    <div className="px-4 pb-4 sm:pb-6 relative">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
      />

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
      <SelectionFormatToolbar textareaRef={textareaRef} onFormat={handleFormat} />

      {/* Reply preview */}
      {replyingTo &&
        (() => {
          const isGhostMode = currentChannel?.ghost_mode || false;
          const replyAuthorMember = replyingTo.user?.id ? members.find((m) => m.user_id === replyingTo.user?.id) : null;
          const replyAuthorIsAdmin = replyAuthorMember
            ? (currentServer && replyAuthorMember.user_id === currentServer.owner_id) || (replyAuthorMember.roles || []).some((r: any) => r.name === "Admin" || r.name === "Moderator")
            : false;
          const showReplyAuthorIdentity = !isGhostMode || replyAuthorIsAdmin;

          return (
            <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted/40 border-b border-border/50 font-[Inter,system-ui,sans-serif] rounded-t-2xl">
              <span className="text-[12px] sm:text-[13px] leading-[1.5] text-muted-foreground">
                Replying to{" "}
                {showReplyAuthorIdentity ? (
                  <span className="font-medium text-primary">@{replyingTo.user?.username}</span>
                ) : (
                  <span className="font-medium text-primary italic">Anonymous</span>
                )}
              </span>
              {isImageOnlyMessage(replyingTo.content) ? (
                <img src={replyingTo.content.trim()} alt="Image attachment" className="w-8 h-8 rounded object-cover flex-shrink-0" />
              ) : (
                <span className="text-[12px] sm:text-[13px] leading-[1.5] text-muted-foreground truncate flex-1 hidden sm:inline">
                  <ReplyPreview content={readableReplyContent} maxLength={50} />
                </span>
              )}
              <button onClick={cancelReply} className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150 ml-auto">
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
        onAttachClick={openFilePicker}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={removeAttachment}
        onAddMore={openFilePicker}
      />

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
    onAttachClick,
    pendingAttachments,
    onRemoveAttachment,
    onAddMore,
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
    onAttachClick: () => void;
    pendingAttachments: PendingAttachment[];
    onRemoveAttachment: (index: number) => void;
    onAddMore: () => void;
  }) => {
    const isMobile = useIsMobile();
    const shouldCollapse = isMobile && content.length > 10;
    const hasAttachments = pendingAttachments.length > 0;

    return (
      <div
        className={`
          rounded-2xl bg-card/80 border transition-all duration-200 ease-out
          ${isFocused ? "border-primary/30 shadow-lg shadow-primary/5 bg-card" : "border-border/50 hover:border-border"}
          ${replyingTo ? "rounded-t-none" : ""}
        `}
      >
        {/* Attachment preview bar */}
        {hasAttachments && (
          <AttachmentPreviewBar
            attachments={pendingAttachments}
            onRemove={onRemoveAttachment}
            onAddMore={onAddMore}
            disabled={isSending}
          />
        )}

        <div className="flex items-end gap-1 sm:gap-2 p-2 sm:p-3">
          {/* Attachment button */}
          {!shouldCollapse && (
            <button
              onClick={onAttachClick}
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

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={
              hasAttachments
                ? "Add a comment..."
                : canSendMessage
                  ? channelName.length > (isMobile ? 12 : 17)
                    ? `Message #${channelName.slice(0, isMobile ? 12 : 17)}…`
                    : `Message #${channelName}`
                  : "You cannot send messages here"
            }
            disabled={!canSendMessage}
            rows={1}
            className={`message-input-textarea flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground/60 py-2 px-1 min-w-0 min-h-[40px] overflow-y-auto font-[Inter,system-ui,sans-serif] ${
              !canSendMessage ? "cursor-not-allowed opacity-50" : ""
            }`}
            style={{
              fontSize: isMobile ? "16px" : "15px",
              lineHeight: "1.5",
              fontWeight: 400,
              maxHeight: "160px",
            }}
          />

          {/* Action buttons */}
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
