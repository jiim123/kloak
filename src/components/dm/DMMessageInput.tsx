import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Paperclip, Smile, Send, X, Loader2, MoreHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/authStore";
import { useDMStore } from "@/stores/dmStore";
import { saveDraft, getDraft, clearDraft } from "@/lib/storage";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { SelectionFormatToolbar, FORMAT_SYNTAX, getCodeBlockSyntax } from "@/components/chat/FormatToolbar";
import { AttachmentPreviewBar, PendingAttachment } from "@/components/chat/AttachmentPreviewBar";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload } from "@/lib/storageUpload";
import { showSuccess } from "@/lib/errorHandler";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DMMessageInputProps {
  conversationId: string;
  otherUsername: string;
  replyingTo?: { id: string; sender?: { username?: string; display_name?: string | null }; content: string } | null;
  onCancelReply?: () => void;
}

const MAX_LENGTH = 2000;
const MIN_TEXTAREA_HEIGHT = 40;
const MAX_TEXTAREA_HEIGHT = 160;
const DRAFT_SAVE_DELAY = 500;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const MAX_IMAGE_FILE_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_ATTACHMENTS = 10;

// Memoized action buttons
const ActionButtons = memo(
  ({
    showEmojiPicker,
    setShowEmojiPicker,
    content,
    isSending,
    hasAttachments,
    onSubmit,
    onEmojiSelect,
    showAttachButton,
    onAttachClick,
  }: {
    showEmojiPicker: boolean;
    setShowEmojiPicker: (show: boolean) => void;
    content: string;
    isSending: boolean;
    hasAttachments: boolean;
    onSubmit: () => void;
    onEmojiSelect: (emoji: string) => void;
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
                  <DropdownMenuItem onClick={onAttachClick}>
                    <Paperclip className="w-4 h-4 mr-2" />
                    Upload image
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <EmojiPicker open={showEmojiPicker} onOpenChange={setShowEmojiPicker} onEmojiSelect={onEmojiSelect}>
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
          <EmojiPicker open={showEmojiPicker} onOpenChange={setShowEmojiPicker} onEmojiSelect={onEmojiSelect}>
            <button
              type="button"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150"
              onMouseDown={(e) => e.preventDefault()}
            >
              <Smile className="w-5 h-5" />
            </button>
          </EmojiPicker>
        )}

        <button
          onClick={onSubmit}
          disabled={!canSend}
          className={cn(
            "p-2 rounded-xl transition-all duration-150",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95"
              : "bg-muted/50 text-muted-foreground/50 cursor-not-allowed",
          )}
        >
          {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    );
  },
);
ActionButtons.displayName = "ActionButtons";

export const DMMessageInput = ({ conversationId, otherUsername, replyingTo, onCancelReply }: DMMessageInputProps) => {
  const { user } = useAuthStore();
  const { sendMessage } = useDMStore();
  const isMobile = useIsMobile();

  const [content, setContent] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const draft = getDraft(`dm-${conversationId}`);
    setContent(draft);
    setPendingAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }
  }, [conversationId]);

  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  const saveDraftDebounced = useCallback((conversationId: string, content: string) => {
    if (draftSaveTimeoutRef.current) clearTimeout(draftSaveTimeoutRef.current);
    draftSaveTimeoutRef.current = setTimeout(() => {
      saveDraft(`dm-${conversationId}`, content);
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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      if (value.length > MAX_LENGTH) return;
      setContent(value);
      saveDraftDebounced(conversationId, value);
      resizeTextarea();
    },
    [conversationId, saveDraftDebounced, resizeTextarea],
  );

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

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFilesToQueue(Array.from(e.target.files));
      }
      e.target.value = "";
    },
    [addFilesToQueue],
  );

  const uploadAttachments = useCallback(async (): Promise<string[]> => {
    if (!user || pendingAttachments.length === 0) return [];
    setPendingAttachments((prev) => prev.map((a) => ({ ...a, uploading: true })));
    const urls: string[] = [];
    for (const att of pendingAttachments) {
      const timestamp = Date.now();
      const fileExt = att.file.name.split(".").pop() || "png";
      const fileName = `${user.id}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

      const result = await secureUpload("attachments", fileName, att.file, {
        contentType: att.file.type || "application/octet-stream",
        upsert: false,
      });

      urls.push(result.publicUrl);
    }
    return urls;
  }, [user, pendingAttachments]);

  const clearAttachments = useCallback(() => {
    setPendingAttachments((prev) => {
      prev.forEach((a) => URL.revokeObjectURL(a.preview));
      return [];
    });
  }, []);

  const handleSubmit = async () => {
    const hasText = content.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;
    if ((!hasText && !hasAttachments) || !user || isSending) return;

    const messageContent = content.trim();

    setContent("");
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
      draftSaveTimeoutRef.current = null;
    }
    clearDraft(`dm-${conversationId}`);
    const currentReplyTo = replyingTo;
    onCancelReply?.();

    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }

    setIsSending(true);
    try {
      let finalContent = messageContent;
      let uploadedUrls: string[] = [];

      if (hasAttachments) {
        uploadedUrls = await uploadAttachments();
        // Only use URLs as content if there's no text; otherwise attachments are stored separately
        if (!finalContent) {
          finalContent = uploadedUrls.join("\n");
        }
        clearAttachments();
      }

      const sent = await sendMessage(conversationId, user.id, finalContent, currentReplyTo?.id);

      // Insert attachment records into dm_attachments table
      if (sent && uploadedUrls.length > 0) {
        const attachmentRows = uploadedUrls.map((url, i) => ({
          message_id: sent.id,
          file_url: url,
          file_name: pendingAttachments[i]?.file.name || "attachment",
          file_type: pendingAttachments[i]?.file.type || null,
          file_size: pendingAttachments[i]?.file.size || null,
        }));
        const { data: insertedAttachments } = await supabase.from("dm_attachments").insert(attachmentRows).select();
        if (insertedAttachments && insertedAttachments.length > 0) {
          const { updateMessage } = useDMStore.getState();
          updateMessage(conversationId, sent.id, {
            attachments: insertedAttachments.map((a: any) => ({
              id: a.id,
              message_id: a.message_id,
              file_url: a.file_url,
              file_name: a.file_name,
              file_type: a.file_type,
              file_size: a.file_size,
              width: a.width,
              height: a.height,
            })),
          });
        }
      }

      if (sent) {
        const auth = useAuthStore.getState();
        if (auth.manualStatus !== "offline") auth.updateLastSeen();
        if (auth.manualStatus !== "offline" && auth.manualStatus !== "dnd") {
          auth.updateStatus("online", { source: "auto" });
        }
      }
    } catch (error) {
      // Keep attachments on failure
    } finally {
      setIsSending(false);
    }
  };

  // Paste handler: queue images
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!user || isSending) return;
      // Prefer clipboardData.files to avoid duplicate items across browsers
      const files = e.clipboardData?.files;
      if (!files || files.length === 0) {
        requestAnimationFrame(() => resizeTextarea());
        return;
      }
      const imageFile = Array.from(files).find((f) => f.type.startsWith("image/"));
      if (!imageFile) {
        requestAnimationFrame(() => resizeTextarea());
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      addFilesToQueue([imageFile]);
    },
    [user, isSending, addFilesToQueue, resizeTextarea],
  );

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
      // On mobile, Enter creates new line (use send button to submit)
      // On desktop, Enter sends (Shift+Enter for new line)
      if (e.key === "Enter" && !e.shiftKey && !isMobile) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [applyFormatShortcut, handleSubmit, isMobile],
  );

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
        if (newContent.length <= MAX_LENGTH) setContent(newContent);
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
        });
      }
    },
    [content],
  );

  const shouldCollapse = isMobile && content.length > 10;
  const hasAttachments = pendingAttachments.length > 0;

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

      <SelectionFormatToolbar textareaRef={textareaRef} onFormat={handleFormat} />

      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted/40 border-b border-border/50 font-[Inter,system-ui,sans-serif] rounded-t-2xl">
          <span className="text-[12px] sm:text-[13px] leading-[1.5] text-muted-foreground">
            Replying to{" "}
            <span className="font-medium text-primary">
              @{replyingTo.sender?.display_name || replyingTo.sender?.username}
            </span>
          </span>
          <span className="text-[12px] sm:text-[13px] leading-[1.5] text-muted-foreground truncate flex-1 hidden sm:inline">
            {replyingTo.content.slice(0, 50)}
            {replyingTo.content.length > 50 ? "..." : ""}
          </span>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150 ml-auto"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating input container */}
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
            onRemove={removeAttachment}
            onAddMore={openFilePicker}
            disabled={isSending}
          />
        )}

        <div className="flex items-end gap-1 sm:gap-2 p-2 sm:p-3">
          {/* Attachment button */}
          {!shouldCollapse && (
            <button
              onClick={openFilePicker}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors duration-150 mb-0.5 flex-shrink-0"
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
                : otherUsername.length > (isMobile ? 12 : 17)
                  ? `Message @${otherUsername.slice(0, isMobile ? 12 : 17)}…`
                  : `Message @${otherUsername}`
            }
            rows={1}
            className="message-input-textarea flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground/60 py-2 px-1 min-w-0 min-h-[40px] overflow-y-auto font-[Inter,system-ui,sans-serif]"
            style={{
              fontSize: isMobile ? "16px" : "15px",
              lineHeight: "1.5",
              fontWeight: 400,
              maxHeight: "160px",
            }}
          />

          {/* Action buttons */}
          <ActionButtons
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            content={content}
            isSending={isSending}
            hasAttachments={hasAttachments}
            onSubmit={handleSubmit}
            onEmojiSelect={handleEmojiSelect}
            showAttachButton={shouldCollapse}
            onAttachClick={openFilePicker}
          />
        </div>
      </div>
    </div>
  );
};
