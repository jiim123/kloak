import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Paperclip, Smile, Send, X, Loader2, MoreHorizontal } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuthStore } from '@/stores/authStore';
import { useDMStore } from '@/stores/dmStore';
import { saveDraft, getDraft, clearDraft } from '@/lib/storage';
import { EmojiPicker } from '@/components/modals/EmojiPicker';
import { ImageUploadDialog } from '@/components/modals/ImageUploadDialog';
import { SelectionFormatToolbar, FORMAT_SYNTAX, getCodeBlockSyntax } from '@/components/chat/FormatToolbar';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess } from '@/lib/errorHandler';
import { cn } from '@/lib/utils';

interface DMMessageInputProps {
  conversationId: string;
  otherUsername: string;
  replyingTo?: { id: string; sender?: { username?: string }; content: string } | null;
  onCancelReply?: () => void;
}

const MAX_LENGTH = 2000;
const MIN_TEXTAREA_HEIGHT = 40;
const MAX_TEXTAREA_HEIGHT = 160;
const DRAFT_SAVE_DELAY = 500;

// Memoized action buttons to prevent re-renders
const ActionButtons = memo(({
  showEmojiPicker,
  setShowEmojiPicker,
  content,
  isSending,
  onSubmit,
  onEmojiSelect,
  showAttachButton,
  onAttachClick,
}: {
  showEmojiPicker: boolean;
  setShowEmojiPicker: (show: boolean) => void;
  content: string;
  isSending: boolean;
  onSubmit: () => void;
  onEmojiSelect: (emoji: string) => void;
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
        <span className={`text-[13px] font-[Inter,system-ui,sans-serif] mr-1 ${content.length > MAX_LENGTH - 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
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
                <DropdownMenuItem onClick={onAttachClick}>
                  <Paperclip className="w-4 h-4 mr-2" />
                  Upload image
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Emoji button - always visible */}
          <EmojiPicker
            open={showEmojiPicker}
            onOpenChange={setShowEmojiPicker}
            onEmojiSelect={onEmojiSelect}
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
        {/* Emoji button */}
        <EmojiPicker
          open={showEmojiPicker}
          onOpenChange={setShowEmojiPicker}
          onEmojiSelect={onEmojiSelect}
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
        className={cn(
          'p-2 rounded-xl transition-all duration-150',
          content.trim() && !isSending
            ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
            : 'bg-muted/50 text-muted-foreground/50 cursor-not-allowed'
        )}
      >
        {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
      </button>
    </div>
  );
});
ActionButtons.displayName = 'ActionButtons';

export const DMMessageInput = ({ 
  conversationId, 
  otherUsername, 
  replyingTo,
  onCancelReply 
}: DMMessageInputProps) => {
  const { user } = useAuthStore();
  const { sendMessage } = useDMStore();
  const isMobile = useIsMobile();
  
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft on mount and conversation change
  useEffect(() => {
    const draft = getDraft(`dm-${conversationId}`);
    setContent(draft);
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }
  }, [conversationId]);

  // Focus textarea when replying
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  // Debounced draft save
  const saveDraftDebounced = useCallback((conversationId: string, content: string) => {
    if (draftSaveTimeoutRef.current) {
      clearTimeout(draftSaveTimeoutRef.current);
    }
    draftSaveTimeoutRef.current = setTimeout(() => {
      saveDraft(`dm-${conversationId}`, content);
    }, DRAFT_SAVE_DELAY);
  }, []);

  // Fixed auto-resize
  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = '0px';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, MIN_TEXTAREA_HEIGHT), MAX_TEXTAREA_HEIGHT);
    textarea.style.height = `${newHeight}px`;
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > MAX_LENGTH) return;

    setContent(value);
    saveDraftDebounced(conversationId, value);
    resizeTextarea();
  }, [conversationId, saveDraftDebounced, resizeTextarea]);

  const handleSubmit = async () => {
    if (!content.trim() || !user || isSending) return;

    const messageContent = content.trim();
    
    // Clear input immediately for instant feedback
    setContent('');
    clearDraft(`dm-${conversationId}`);
    const currentReplyTo = replyingTo;
    onCancelReply?.();
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = `${MIN_TEXTAREA_HEIGHT}px`;
    }
    
    setIsSending(true);
    try {
      const sent = await sendMessage(conversationId, user.id, messageContent, currentReplyTo?.id);

      // Presence: sending a DM is explicit activity; refresh last_seen immediately.
      if (sent) {
        const auth = useAuthStore.getState();
        if (auth.manualStatus !== 'offline') {
          auth.updateLastSeen();
        }
        if (auth.manualStatus !== 'offline' && auth.manualStatus !== 'dnd') {
          auth.updateStatus('online', { source: 'auto' });
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  // Apply formatting to selected text or insert format syntax
  const applyFormatShortcut = useCallback((formatType: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);

    const syntax = FORMAT_SYNTAX[formatType];
    if (!syntax) return;

    const { prefix, suffix } = syntax;
    
    if (selectedText) {
      const newContent = 
        content.slice(0, start) + 
        prefix + selectedText + suffix + 
        content.slice(end);

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
  }, [content]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Format shortcuts (Ctrl/Cmd + key)
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          applyFormatShortcut('bold');
          return;
        case 'i':
          e.preventDefault();
          applyFormatShortcut('italic');
          return;
        case 'e':
          e.preventDefault();
          applyFormatShortcut('code');
          return;
        case 'p':
          e.preventDefault();
          applyFormatShortcut('spoiler');
          return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [applyFormatShortcut, handleSubmit]);

  // Handle emoji selection - insert at cursor position
  const handleEmojiSelect = useCallback((emoji: string) => {
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
  }, [content]);

  // Handle format selection from toolbar
  const handleFormat = useCallback((formatType: string, value?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);

    let syntax: { prefix: string; suffix: string };
    
    if (formatType === 'codeblock') {
      syntax = getCodeBlockSyntax(value || '');
    } else {
      syntax = FORMAT_SYNTAX[formatType];
    }

    if (!syntax) return;

    const { prefix, suffix } = syntax;
    
    const textToWrap = selectedText || 'text';
    const newContent = 
      content.slice(0, start) + 
      prefix + textToWrap + suffix + 
      content.slice(end);

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
  }, [content]);

  // Handle image upload
  const handleImageUpload = async (file: File) => {
    if (!user) throw new Error('Not authenticated');

    // Generate unique filename with timestamp for 14-day cleanup tracking
    const timestamp = Date.now();
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('attachments')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('attachments')
      .getPublicUrl(data.path);

    // Send the image URL as a DM
    await sendMessage(conversationId, user.id, urlData.publicUrl, replyingTo?.id);

    // Presence: uploading/sending is activity.
    const auth = useAuthStore.getState();
    if (auth.manualStatus !== 'offline') {
      auth.updateLastSeen();
    }
    if (auth.manualStatus !== 'offline' && auth.manualStatus !== 'dnd') {
      auth.updateStatus('online', { source: 'auto' });
    }

    // Clear reply if any
    onCancelReply?.();

    showSuccess('Image uploaded successfully');
  };
  const shouldCollapse = isMobile && content.length > 10;

  return (
    <div className="px-4 pb-4 sm:pb-6 relative">
      {/* Selection-based format toolbar */}
      <SelectionFormatToolbar
        textareaRef={textareaRef}
        onFormat={handleFormat}
      />

      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-muted/40 border-b border-border/50 font-[Inter,system-ui,sans-serif] rounded-t-2xl">
          <span className="text-[12px] sm:text-[13px] leading-[1.5] text-muted-foreground">
            Replying to <span className="font-medium text-primary">@{replyingTo.sender?.username}</span>
          </span>
          <span className="text-[12px] sm:text-[13px] leading-[1.5] text-muted-foreground truncate flex-1 hidden sm:inline">
            {replyingTo.content.slice(0, 50)}{replyingTo.content.length > 50 ? '...' : ''}
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
          ${isFocused ? 'border-primary/30 shadow-lg shadow-primary/5 bg-card' : 'border-border/50 hover:border-border'}
          ${replyingTo ? 'rounded-t-none' : ''}
        `}
      >
        <div className="flex items-end gap-1 sm:gap-2 p-2 sm:p-3">
          {/* Attachment button */}
          {!shouldCollapse && (
            <button 
              onClick={() => setShowImageUpload(true)}
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
            placeholder={`Message @${otherUsername}`}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground/60 py-2 px-1 min-w-0 min-h-[40px] overflow-y-auto font-[Inter,system-ui,sans-serif]"
            style={{
              // Prevent iOS zoom on focus by using 16px minimum
              fontSize: isMobile ? '16px' : '15px',
              lineHeight: '1.5',
              fontWeight: 400,
              maxHeight: '160px',
            }}
          />

          {/* Action buttons */}
          <ActionButtons
            showEmojiPicker={showEmojiPicker}
            setShowEmojiPicker={setShowEmojiPicker}
            content={content}
            isSending={isSending}
            onSubmit={handleSubmit}
            onEmojiSelect={handleEmojiSelect}
            showAttachButton={shouldCollapse}
            onAttachClick={() => setShowImageUpload(true)}
          />
        </div>
      </div>

      {/* Image upload dialog */}
      <ImageUploadDialog
        open={showImageUpload}
        onOpenChange={setShowImageUpload}
        onUpload={handleImageUpload}
      />
    </div>
  );
};
