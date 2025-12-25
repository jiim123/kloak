import { useState, useEffect, useRef, useCallback } from 'react';
import { PlusCircle, Smile, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { saveDraft, getDraft, clearDraft } from '@/lib/storage';
import { getMessagePreview } from '@/lib/message';

interface MessageInputProps {
  channelId: string;
  channelName: string;
  onTyping: () => void;
  onStopTyping: () => void;
}

const MAX_LENGTH = 2000;

export const MessageInput = ({ channelId, channelName, onTyping, onStopTyping }: MessageInputProps) => {
  const { user } = useAuthStore();
  const { replyingTo, setReplyingTo, sendMessage } = useMessageStore();
  const { members } = useServerStore();
  
  const [content, setContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if user is muted
  const currentMember = members.find(m => m.user_id === user?.id);
  const isMuted = currentMember?.is_muted || false;

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
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const maxHeight = 5 * 24; // Approximately 5 lines
      textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [content, adjustHeight]);

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
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user || isMuted) return;

    const messageContent = content.trim();
    setContent('');
    clearDraft(channelId);
    onStopTyping();

    await sendMessage(channelId, user.id, messageContent, replyingTo?.id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  const showCharacterWarning = content.length > MAX_LENGTH - 200;

  if (isMuted) {
    return (
      <div className="px-4 pb-6">
        <div className="flex items-center justify-center py-4 px-4 bg-secondary rounded-lg">
          <span className="text-muted-foreground">You are muted in this server</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-6">
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-t-lg border-b border-border">
          <span className="text-sm text-muted-foreground">
            Replying to <span className="font-medium text-primary">@{replyingTo.user?.username}</span>
          </span>
          <span className="text-sm text-muted-foreground truncate flex-1">
            {getMessagePreview(replyingTo.content, 50)}
          </span>
          <Button variant="ghost" size="icon" className="w-6 h-6" onClick={cancelReply}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Input container */}
      <div className={`flex items-end gap-2 bg-secondary px-4 py-2 ${replyingTo ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <Button type="button" variant="ghost" size="icon" className="w-8 h-8 flex-shrink-0">
          <PlusCircle className="w-5 h-5" />
        </Button>

        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            className="min-h-[24px] max-h-[120px] border-0 bg-transparent focus-visible:ring-0 p-0 resize-none overflow-hidden"
            rows={1}
          />
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {showCharacterWarning && (
            <span className={`text-xs ${content.length > MAX_LENGTH - 50 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {MAX_LENGTH - content.length}
            </span>
          )}

          <Button type="button" variant="ghost" size="icon" className="w-8 h-8">
            <Smile className="w-5 h-5" />
          </Button>

          {content.trim() && (
            <Button size="icon" className="w-8 h-8" onClick={handleSubmit}>
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
