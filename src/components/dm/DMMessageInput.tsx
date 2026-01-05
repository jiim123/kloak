import { useState, useEffect, useRef } from 'react';
import { Paperclip, Smile, Send, X, Type } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useDMStore } from '@/stores/dmStore';
import { saveDraft, getDraft, clearDraft } from '@/lib/storage';
import { EmojiGifPicker } from '@/components/modals/EmojiGifPicker';
import { FormatToolbar, FORMAT_SYNTAX, getColorSyntax, getCodeBlockSyntax } from '@/components/chat/FormatToolbar';
import { cn } from '@/lib/utils';

interface DMMessageInputProps {
  conversationId: string;
  otherUsername: string;
  replyingTo?: { id: string; sender?: { username?: string }; content: string } | null;
  onCancelReply?: () => void;
}

const MAX_LENGTH = 2000;

export const DMMessageInput = ({ 
  conversationId, 
  otherUsername, 
  replyingTo,
  onCancelReply 
}: DMMessageInputProps) => {
  const { user } = useAuthStore();
  const { sendMessage } = useDMStore();
  
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load draft on mount and conversation change
  useEffect(() => {
    const draft = getDraft(`dm-${conversationId}`);
    setContent(draft);
  }, [conversationId]);

  // Save draft on content change
  useEffect(() => {
    saveDraft(`dm-${conversationId}`, content);
  }, [conversationId, content]);

  // Focus textarea when replying
  useEffect(() => {
    if (replyingTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyingTo]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
    }
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_LENGTH) {
      setContent(value);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user || isSending) return;

    const messageContent = content.trim();
    
    // Clear input immediately for instant feedback
    setContent('');
    clearDraft(`dm-${conversationId}`);
    const currentReplyTo = replyingTo;
    onCancelReply?.();
    
    setIsSending(true);
    try {
      await sendMessage(conversationId, user.id, messageContent, currentReplyTo?.id);
    } finally {
      setIsSending(false);
    }
  };

  // Apply formatting to selected text or insert format syntax
  const applyFormatShortcut = (formatType: string) => {
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
        case 'u':
          e.preventDefault();
          applyFormatShortcut('underline');
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
  };

  // Handle emoji selection - insert at cursor position
  const handleEmojiSelect = (emoji: string) => {
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
  };

  // Handle GIF selection - insert GIF URL as message content
  const handleGifSelect = (gifUrl: string) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + gifUrl + content.slice(end);
      
      if (newContent.length <= MAX_LENGTH) {
        setContent(newContent);
      }
    } else {
      const newContent = content + gifUrl;
      if (newContent.length <= MAX_LENGTH) {
        setContent(newContent);
      }
    }
    
    setShowEmojiPicker(false);
  };

  // Handle format selection from toolbar
  const handleFormat = (formatType: string, value?: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);

    let syntax: { prefix: string; suffix: string };
    
    if (formatType === 'color' && value) {
      syntax = getColorSyntax(value);
    } else if (formatType === 'codeblock') {
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
  };

  const showCharacterWarning = content.length > MAX_LENGTH - 200;

  return (
    <div className="px-4 pb-6 relative">
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-t-2xl border-b border-border">
          <span className="text-sm text-muted-foreground">
            Replying to <span className="font-medium text-primary">@{replyingTo.sender?.username}</span>
          </span>
          <span className="text-sm text-muted-foreground truncate flex-1">
            {replyingTo.content.slice(0, 50)}{replyingTo.content.length > 50 ? '...' : ''}
          </span>
          <button 
            onClick={onCancelReply}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating input container */}
      <div 
        className={cn(
          "rounded-2xl bg-secondary border transition-all duration-200 ease-out",
          isFocused ? 'border-border -translate-y-[3px] shadow-lg' : 'border-transparent translate-y-0',
          replyingTo ? 'rounded-t-none' : ''
        )}
      >
        <div className="flex items-end gap-2 p-3">
          {/* Attachment button */}
          <button className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 mb-0.5">
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
            placeholder={`Message @${otherUsername}`}
            rows={1}
            className="flex-1 bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground text-[15px] leading-relaxed py-2 px-1 font-light"
            style={{ fontFamily: "system-ui, -apple-system, sans-serif, 'Noto Color Emoji'" }}
          />

          {/* Action buttons */}
          <div className="flex items-center gap-1 mb-0.5 relative">
            {/* Format toolbar */}
            {showFormatToolbar && (
              <div className="absolute bottom-full right-0 mb-2 z-50">
                <FormatToolbar 
                  onFormat={handleFormat} 
                  onClose={() => setShowFormatToolbar(false)} 
                />
              </div>
            )}

            {/* Character count warning */}
            {showCharacterWarning && (
              <span className={`text-xs mr-1 ${content.length > MAX_LENGTH - 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
                {MAX_LENGTH - content.length}
              </span>
            )}

            {/* Format button */}
            <button
              type="button"
              onClick={() => setShowFormatToolbar(!showFormatToolbar)}
              className={cn(
                "p-2 rounded-xl transition-colors duration-150",
                showFormatToolbar 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
              onMouseDown={(e) => e.preventDefault()}
              title="Format text"
            >
              <Type className="w-5 h-5" />
            </button>

            {/* Emoji/GIF button with picker */}
            <EmojiGifPicker
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
              onEmojiSelect={handleEmojiSelect}
              onGifSelect={handleGifSelect}
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
              onClick={handleSubmit}
              disabled={!content.trim() || isSending}
              className={`p-2 rounded-xl transition-all duration-150 ${
                content.trim() && !isSending
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
