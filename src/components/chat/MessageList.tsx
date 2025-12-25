import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MessageItem } from './MessageItem';
import { useMessageStore } from '@/stores/messageStore';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import type { Message } from '@/types';

interface MessageListProps {
  channelId: string;
  channelName: string;
}

// Group messages from same user within 5 minutes
const shouldGroupMessages = (current: Message, previous: Message | null): boolean => {
  if (!previous) return false;
  if (current.user_id !== previous.user_id) return false;
  if (current.reply_to_id) return false; // Don't group replies
  
  const currentTime = new Date(current.created_at).getTime();
  const previousTime = new Date(previous.created_at).getTime();
  const fiveMinutes = 5 * 60 * 1000;
  
  return currentTime - previousTime < fiveMinutes;
};

export const MessageList = ({ channelId, channelName }: MessageListProps) => {
  const { messages, isLoading, hasMore, fetchMessages, clearMessages } = useMessageStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isNearBottomRef = useRef(true);

  // Enable realtime updates
  useRealtimeMessages(channelId);

  // Fetch messages on channel change
  useEffect(() => {
    clearMessages();
    fetchMessages(channelId);
  }, [channelId, fetchMessages, clearMessages]);

  // Auto-scroll when new messages arrive (if near bottom)
  useEffect(() => {
    if (isNearBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      setNewMessageCount(0);
    } else if (messages.length > 0) {
      setNewMessageCount((prev) => prev + 1);
    }
  }, [messages.length]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // Near bottom = within 100px
    isNearBottomRef.current = distanceFromBottom < 100;
    setShowJumpToPresent(!isNearBottomRef.current && messages.length > 0);

    // Load more when scrolling to top
    if (scrollTop < 100 && hasMore && !isLoading) {
      const oldestMessage = messages[0];
      if (oldestMessage) {
        fetchMessages(channelId, 50, oldestMessage.created_at);
      }
    }
  }, [channelId, hasMore, isLoading, messages, fetchMessages]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowJumpToPresent(false);
    setNewMessageCount(0);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto"
        onScroll={handleScroll}
      >
        {/* Loading indicator at top */}
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Channel welcome message */}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
              <span className="text-4xl">#</span>
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Welcome to #{channelName}!
            </h2>
            <p className="text-muted-foreground">
              This is the start of the #{channelName} channel.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="py-4">
          {messages.map((message, index) => {
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const isGrouped = shouldGroupMessages(message, previousMessage);
            
            return (
              <MessageItem
                key={message.id}
                message={message}
                isGrouped={isGrouped}
              />
            );
          })}
        </div>

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Jump to present button */}
      {showJumpToPresent && (
        <Button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 rounded-full shadow-lg"
          size="sm"
        >
          <ChevronDown className="w-4 h-4 mr-1" />
          {newMessageCount > 0 ? `${newMessageCount} new message${newMessageCount > 1 ? 's' : ''}` : 'Jump to present'}
        </Button>
      )}
    </div>
  );
};
