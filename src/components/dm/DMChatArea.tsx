import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import { useUnreadDMs } from '@/hooks/useUnreadDMs';
import { formatMessageTimestamp } from '@/lib/format';
import { DMMessageInput } from './DMMessageInput';
import type { DirectMessage } from '@/types';

export const DMChatArea = () => {
  const { user } = useAuthStore();
  const { currentConversation, isLoading, fetchMessages, getMessages } = useDMStore();
  const { markAsRead } = useUnreadDMs(user?.id || null);
  
  // Get messages for current conversation from cache
  const messages = currentConversation ? getMessages(currentConversation.id) : [];
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);

  // Fetch messages and mark as read when conversation changes
  useEffect(() => {
    if (currentConversation?.id) {
      fetchMessages(currentConversation.id);
      markAsRead(currentConversation.id);
    }
  }, [currentConversation?.id, fetchMessages, markAsRead]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isAtBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (messages.length > 0) {
      // Count new messages when not at bottom
      setNewMessageCount((prev) => prev + 1);
    }
  }, [messages.length, isAtBottom]);

  // Reset new message count when scrolling to bottom
  useEffect(() => {
    if (isAtBottom) {
      setNewMessageCount(0);
    }
  }, [isAtBottom]);

  // Check scroll position
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 100;
    setIsAtBottom(atBottom);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessageCount(0);
    setIsAtBottom(true);
  };

  // Group messages by sender within 5 minutes
  const groupMessages = (msgs: DirectMessage[]) => {
    const groups: { message: DirectMessage; isFirst: boolean }[] = [];
    
    msgs.forEach((msg, index) => {
      const prevMsg = msgs[index - 1];
      const isFirst =
        !prevMsg ||
        prevMsg.sender_id !== msg.sender_id ||
        new Date(msg.created_at || '').getTime() - new Date(prevMsg.created_at || '').getTime() > 5 * 60 * 1000;
      
      groups.push({ message: msg, isFirst });
    });

    return groups;
  };

  const groupedMessages = groupMessages(messages);

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'online': return 'status-online';
      case 'idle': return 'status-idle';
      case 'dnd': return 'status-dnd';
      default: return 'status-offline';
    }
  };

  if (!currentConversation) {
    return (
      <div className="h-full flex items-center justify-center bg-layout-chat">
        <div className="text-center text-muted-foreground">
          <p>Select a conversation or start a new one</p>
        </div>
      </div>
    );
  }

  const otherUser = currentConversation.other_user;

  return (
    <div className="h-full flex flex-col bg-layout-chat">
      {/* Header - hidden on mobile since we have MobileHeader */}
      <div className="h-12 px-4 hidden md:flex items-center gap-3 border-b border-border shadow-sm">
        <div className="relative flex-shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
            style={{ backgroundColor: otherUser?.banner_color || '#5865F2' }}
          >
            {otherUser?.avatar_url ? (
              <img
                src={otherUser.avatar_url}
                alt={otherUser.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              (otherUser?.username?.[0] || '?').toUpperCase()
            )}
          </div>
          <div
            className={cn(
              'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-layout-chat',
              getStatusClass(otherUser?.status)
            )}
          />
        </div>
        <span className="font-semibold text-foreground">
          {otherUser?.display_name || otherUser?.username || 'Unknown'}
        </span>
      </div>

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4"
        onScroll={handleScroll}
      >
        {/* Start of conversation */}
        <div className="py-8 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold"
              style={{ backgroundColor: otherUser?.banner_color || '#5865F2' }}
            >
              {otherUser?.avatar_url ? (
                <img
                  src={otherUser.avatar_url}
                  alt={otherUser.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                (otherUser?.username?.[0] || '?').toUpperCase()
              )}
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">
            {otherUser?.display_name || otherUser?.username}
          </h2>
          <p className="text-muted-foreground">
            This is the beginning of your direct message history with{' '}
            <span className="font-semibold">@{otherUser?.username}</span>.
          </p>
        </div>

        {/* Messages */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-pulse-subtle text-muted-foreground">Loading messages...</div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {groupedMessages.map(({ message, isFirst }) => (
              <div
                key={message.id}
                className={cn(
                  'group flex gap-4 py-0.5 px-2 -mx-2 rounded hover:bg-secondary/30 transition-smooth',
                  isFirst && 'mt-4 pt-1'
                )}
              >
                {/* Avatar or spacer */}
                <div className="w-10 flex-shrink-0">
                  {isFirst && (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: message.sender?.banner_color || '#5865F2' }}
                    >
                      {message.sender?.avatar_url ? (
                        <img
                          src={message.sender.avatar_url}
                          alt={message.sender.username}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        (message.sender?.username?.[0] || '?').toUpperCase()
                      )}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {isFirst && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="font-medium text-foreground">
                        {message.sender?.display_name || message.sender?.username}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatMessageTimestamp(message.created_at || '')}
                      </span>
                    </div>
                  )}

                  {/* Reply preview */}
                  {message.reply_to && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1 pl-3 border-l-2 border-muted">
                      <span className="font-medium">
                        @{message.reply_to.sender?.username}
                      </span>
                      <span className="truncate">{message.reply_to.content}</span>
                    </div>
                  )}

                  <p className="text-foreground whitespace-pre-wrap break-words">
                    {message.content}
                  </p>

                  {message.edited_at && (
                    <span className="text-xs text-muted-foreground">(edited)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Jump to present button */}
      {!isAtBottom && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
          <Button
            size="sm"
            className="gap-2 shadow-lg"
            onClick={scrollToBottom}
          >
            <ArrowDown className="w-4 h-4" />
            {newMessageCount > 0 ? `${newMessageCount} new messages` : 'Jump to Present'}
          </Button>
        </div>
      )}

      {/* Message input - matches channel input style */}
      <DMMessageInput
        conversationId={currentConversation.id}
        otherUsername={otherUser?.username || 'user'}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
};
