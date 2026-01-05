import { useState, useEffect, useRef } from 'react';
import { Paperclip, Smile, Send, X, Loader2, WifiOff, Type } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOptimisticMessage } from '@/hooks/useOptimisticMessage';
import { saveDraft, getDraft, clearDraft } from '@/lib/storage';
import { getMessagePreview, extractMentions } from '@/lib/message';
import { MentionAutocomplete } from './MentionAutocomplete';
import { EmojiPicker } from '@/components/modals/EmojiPicker';
import { FormatToolbar, FORMAT_SYNTAX, getColorSyntax, getCodeBlockSyntax } from './FormatToolbar';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, showWarning, handleError } from '@/lib/errorHandler';
import { messageRateLimiter, validateMessageContent } from '@/lib/security';

interface MessageInputProps {
  channelId: string;
  channelName: string;
  onTyping: () => void;
  onStopTyping: () => void;
}

const MAX_LENGTH = 2000;

export const MessageInput = ({ channelId, channelName, onTyping, onStopTyping }: MessageInputProps) => {
  const { user } = useAuthStore();
  const { replyingTo, setReplyingTo } = useMessageStore();
  const { members, currentServer } = useServerStore();
  const { createMentionNotification } = useNotificationStore();
  const { getQueuedForChannel } = useOfflineQueueStore();
  const { isOnline } = useOnlineStatus();
  const { sendOptimistic } = useOptimisticMessage();
  
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showFormatToolbar, setShowFormatToolbar] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is muted or admin
  const currentMember = members.find(m => m.user_id === user?.id);
  const isMuted = currentMember?.is_muted || false;
  const isAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin' || currentMember?.role === 'moderator';

  // Load draft on mount and channel change
  useEffect(() => {
    const draft = getDraft(channelId);
    setContent(draft);
  }, [channelId]);

  // Save draft on content change
  useEffect(() => {
    saveDraft(channelId, content);
  }, [channelId, content]);

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

  // Handle mention detection
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_LENGTH) {
      setContent(value);
      
      // Typing indicator
      onTyping();
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        onStopTyping();
      }, 2000);

      // Check for @ mentions
      const cursorPosition = e.target.selectionStart;
      const textBeforeCursor = value.slice(0, cursorPosition);
      const atIndex = textBeforeCursor.lastIndexOf('@');
      
      if (atIndex !== -1) {
        const textAfterAt = textBeforeCursor.slice(atIndex + 1);
        // Only show if there's no space after @ (still typing the mention)
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionQuery(textAfterAt);
          setMentionStartIndex(atIndex);
          setShowMentions(true);
          
          // Calculate position
          if (textareaRef.current) {
            setMentionPosition({
              top: 40, // Position above input
              left: 0,
            });
          }
        } else {
          setShowMentions(false);
        }
      } else {
        setShowMentions(false);
      }
    }
  };

  const handleMentionSelect = (option: { type: string; id?: string; label: string }) => {
    if (mentionStartIndex === -1) return;
    
    // Replace the @query with the selected mention
    const beforeMention = content.slice(0, mentionStartIndex);
    const afterMention = content.slice(mentionStartIndex + mentionQuery.length + 1);
    
    let mentionText: string;
    if (option.type === 'user' && option.id) {
      mentionText = `<@${option.id}> `;
    } else {
      mentionText = `@${option.type} `;
    }
    
    const newContent = beforeMention + mentionText + afterMention;
    setContent(newContent);
    setShowMentions(false);
    setMentionStartIndex(-1);
    
    // Focus back on textarea after a brief delay to prevent mobile keyboard
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user || isMuted || isSending) return;

    const messageContent = content.trim();
    
    // Validate message content
    const validation = validateMessageContent(messageContent);
    if (!validation.valid) {
      showWarning('Invalid message', validation.error || 'Please check your message');
      return;
    }
    
    // Rate limiting check
    if (!messageRateLimiter.isAllowed(user.id)) {
      const remaining = messageRateLimiter.getRemainingTime(user.id);
      showWarning('Slow down cowboy!', `Try again in ${remaining} seconds`);
      return;
    }
    
    // Clear input immediately for instant feedback
    setContent('');
    clearDraft(channelId);
    onStopTyping();
    setShowMentions(false);
    const currentReplyTo = replyingTo;
    setReplyingTo(null);

    // Use optimistic send - message appears instantly, syncs in background
    const message = await sendOptimistic({
      channelId,
      content: messageContent,
      replyToId: currentReplyTo?.id,
    });
    
    // Handle mentions in background (non-blocking)
    if (message && currentServer && !message.id.startsWith('temp-')) {
      const mentions = extractMentions(messageContent);
      
      // Process mentions asynchronously without blocking
      Promise.resolve().then(async () => {
        for (const mention of mentions) {
          if (mention.type === 'user' && mention.id && mention.id !== user.id) {
            await supabase.from('mentions').insert({
              message_id: message.id,
              user_id: mention.id,
              mention_type: 'user',
            });
            
            await createMentionNotification(
              mention.id,
              user.id,
              channelId,
              channelName,
              currentServer.id
            );
          } else if (mention.type === 'everyone' || mention.type === 'here') {
            const targetMembers = mention.type === 'here'
              ? members.filter(m => m.user?.status === 'online' && m.user_id !== user.id)
              : members.filter(m => m.user_id !== user.id);
            
            for (const member of targetMembers.slice(0, 50)) {
              await supabase.from('mentions').insert({
                message_id: message.id,
                user_id: member.user_id,
                mention_type: mention.type,
              });
              
              await createMentionNotification(
                member.user_id,
                user.id,
                channelId,
                channelName,
                currentServer.id
              );
            }
          }
        }
      }).catch(err => console.error('Failed to process mentions:', err));
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
      // Wrap selected text
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
      // Insert format syntax with cursor between
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
    // Let mention autocomplete handle these keys
    if (showMentions && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      return;
    }

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

    // Up arrow to edit last message when input is empty
    if (e.key === 'ArrowUp' && !content.trim()) {
      e.preventDefault();
      // Dispatch custom event to trigger edit on the last own message
      window.dispatchEvent(new CustomEvent('editLastMessage', { 
        detail: { userId: user?.id, channelId } 
      }));
    }
  };

  // Get queued messages for this channel
  const queuedMessages = getQueuedForChannel(channelId);

  const cancelReply = () => {
    setReplyingTo(null);
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
        
        // Don't focus immediately on mobile to prevent keyboard popup
        // Use requestAnimationFrame to ensure content is updated first
        requestAnimationFrame(() => {
          const newCursorPos = start + emoji.length;
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        });
      }
    } else {
      // Fallback: append to end
      const newContent = content + emoji;
      if (newContent.length <= MAX_LENGTH) {
        setContent(newContent);
      }
    }
    
    // Close picker
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
    
    // If text is selected, wrap it with format syntax
    // If no selection, insert format syntax and place cursor between
    const textToWrap = selectedText || 'text';
    const newContent = 
      content.slice(0, start) + 
      prefix + textToWrap + suffix + 
      content.slice(end);

    if (newContent.length <= MAX_LENGTH) {
      setContent(newContent);
      
      requestAnimationFrame(() => {
        if (selectedText) {
          // Move cursor after the formatted text
          const newPos = start + prefix.length + selectedText.length + suffix.length;
          textarea.setSelectionRange(newPos, newPos);
        } else {
          // Select the placeholder 'text' for easy replacement
          const selectStart = start + prefix.length;
          const selectEnd = selectStart + 4; // length of 'text'
          textarea.setSelectionRange(selectStart, selectEnd);
        }
        textarea.focus();
      });
    }
  };

  const showCharacterWarning = content.length > MAX_LENGTH - 200;

  if (isMuted) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center py-4 px-4 bg-secondary rounded-2xl">
          <span className="text-muted-foreground">You are muted in this server</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6 relative">
      {/* Queued messages indicator */}
      {queuedMessages.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 mb-2 bg-[hsl(var(--nomo-warning))]/10 border border-[hsl(var(--nomo-warning))]/20 rounded-xl text-sm text-[hsl(var(--nomo-warning))]">
          <WifiOff className="w-4 h-4" />
          <span>{queuedMessages.length} message{queuedMessages.length > 1 ? 's' : ''} waiting to send</span>
        </div>
      )}

      {/* Mention Autocomplete */}
      {showMentions && (
        <MentionAutocomplete
          query={mentionQuery}
          position={mentionPosition}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentions(false)}
          isAdmin={isAdmin}
        />
      )}

      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-t-2xl border-b border-border">
          <span className="text-sm text-muted-foreground">
            Replying to <span className="font-medium text-primary">@{replyingTo.user?.username}</span>
          </span>
          <span className="text-sm text-muted-foreground truncate flex-1">
            {getMessagePreview(replyingTo.content, 50)}
          </span>
          <button 
            onClick={cancelReply}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Floating input container */}
      <div 
        className={`
          rounded-2xl bg-secondary border transition-all duration-200 ease-out
          ${isFocused ? 'border-border -translate-y-[3px] shadow-lg' : 'border-transparent translate-y-0'}
          ${replyingTo ? 'rounded-t-none' : ''}
        `}
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
            placeholder={`Message #${channelName}`}
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
              className={`p-2 rounded-xl transition-colors duration-150 ${
                showFormatToolbar 
                  ? 'text-primary bg-primary/10' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              onMouseDown={(e) => e.preventDefault()}
              title="Format text"
            >
              <Type className="w-5 h-5" />
            </button>

            {/* Emoji button with picker */}
            <EmojiPicker
              open={showEmojiPicker}
              onOpenChange={setShowEmojiPicker}
              onEmojiSelect={handleEmojiSelect}
            >
              <button 
                type="button"
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150"
                onMouseDown={(e) => {
                  // Prevent focus loss from textarea on desktop
                  e.preventDefault();
                }}
              >
                <Smile className="w-5 h-5" />
              </button>
            </EmojiPicker>

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
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
