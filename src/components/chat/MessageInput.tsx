import { useState, useEffect, useRef, useCallback } from 'react';
import { PlusCircle, Smile, Send, X, Loader2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuthStore } from '@/stores/authStore';
import { useMessageStore } from '@/stores/messageStore';
import { useServerStore } from '@/stores/serverStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { useOfflineQueueStore } from '@/stores/offlineQueueStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { saveDraft, getDraft, clearDraft } from '@/lib/storage';
import { getMessagePreview, extractMentions } from '@/lib/message';
import { MentionAutocomplete } from './MentionAutocomplete';
import { supabase } from '@/integrations/supabase/client';
import { showSuccess, handleError } from '@/lib/errorHandler';

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
  const { members, currentServer } = useServerStore();
  const { createMentionNotification } = useNotificationStore();
  const { addToQueue, getQueuedForChannel } = useOfflineQueueStore();
  const { isOnline } = useOnlineStatus();
  
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  
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
    
    // Focus back on textarea
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    if (!content.trim() || !user || isMuted || isSending) return;

    const messageContent = content.trim();
    setContent('');
    setIsSending(true);
    clearDraft(channelId);
    onStopTyping();
    setShowMentions(false);

    // If offline, queue the message
    if (!isOnline) {
      addToQueue({
        channelId,
        userId: user.id,
        content: messageContent,
        replyToId: replyingTo?.id,
      });
      setIsSending(false);
      setReplyingTo(null);
      showSuccess('Message queued', 'Will be sent when you reconnect.');
      return;
    }

    try {
      const message = await sendMessage(channelId, user.id, messageContent, replyingTo?.id);
    
      if (message && currentServer) {
        // Parse and track mentions
        const mentions = extractMentions(messageContent);
        
        for (const mention of mentions) {
          if (mention.type === 'user' && mention.id && mention.id !== user.id) {
            // Create mention record
            await supabase.from('mentions').insert({
              message_id: message.id,
              user_id: mention.id,
              mention_type: 'user',
            });
            
            // Create notification
            await createMentionNotification(
              mention.id,
              user.id,
              channelId,
              channelName,
              currentServer.id
            );
          } else if (mention.type === 'everyone' || mention.type === 'here') {
            // Notify all server members (or online members for @here)
            const targetMembers = mention.type === 'here'
              ? members.filter(m => m.user?.status === 'online' && m.user_id !== user.id)
              : members.filter(m => m.user_id !== user.id);
            
            for (const member of targetMembers.slice(0, 50)) { // Limit to 50 to prevent spam
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
      }
    } catch (error) {
      handleError(error, 'Failed to send message');
      // Restore content if sending failed
      setContent(messageContent);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Let mention autocomplete handle these keys
    if (showMentions && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
      return;
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
    <div className="px-4 pb-6 relative">
      {/* Queued messages indicator */}
      {queuedMessages.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 mb-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-500">
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
            <Button 
              size="icon" 
              className="w-8 h-8" 
              onClick={handleSubmit}
              disabled={isSending}
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
