import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowDown, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useFriendStore } from '@/stores/friendStore';
import { useUnreadDMs } from '@/hooks/useUnreadDMs';
import { useSwipeGestureRef } from '@/hooks/useSwipeGesture';
import { useIsMobile } from '@/hooks/use-mobile';
import { DMMessageInput } from './DMMessageInput';
import { DMMessageItem } from './DMMessageItem';
import { DMHeader } from './DMHeader';
import type { DirectMessage } from '@/types';

export const DMChatArea = () => {
  const { user } = useAuthStore();
  const { currentConversation, isLoading, fetchMessages, getMessages } = useDMStore();
  const { setMobileSidebarOpen } = useUIStore();
  const { blockedUsers, visibilityBlockedUserIds } = useFriendStore();
  const { markAsRead } = useUnreadDMs(user?.id || null);
  const isMobile = useIsMobile();
  
  // Get messages for current conversation from cache
  const messages = currentConversation ? getMessages(currentConversation.id) : [];
  
  // Check if either user has blocked the other
  // blockedUsers = users that I have blocked
  // visibilityBlockedUserIds = all users in a "blocked" relationship with me (both directions)
  const otherUserId = currentConversation?.other_user?.id;
  const isBlockedByMe = blockedUsers.some((b) => b.id === otherUserId);
  // If other user is in visibility blocked but NOT in my blocked list, they blocked me
  const isBlockedByThem = otherUserId ? visibilityBlockedUserIds.includes(otherUserId) && !isBlockedByMe : false;
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);

  // Swipe gesture for mobile - swipe right to open sidebar
  const swipeRef = useSwipeGestureRef({
    onSwipeRight: () => setMobileSidebarOpen(true),
    threshold: 50,
    enabled: isMobile,
  });

  // Fetch messages and mark as read when conversation changes
  useEffect(() => {
    if (currentConversation?.id && user?.id) {
      fetchMessages(currentConversation.id, user.id);
      markAsRead(currentConversation.id);
    }
  }, [currentConversation?.id, user?.id, fetchMessages, markAsRead]);

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
  const isBlocked = isBlockedByMe || isBlockedByThem;

  return (
    <div ref={swipeRef} className="h-full flex flex-col bg-layout-chat">
      {/* DM Header - sticky on mobile, hidden desktop handled inside */}
      <DMHeader otherUser={otherUser} />

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
              <DMMessageItem
                key={message.id}
                message={message}
                isFirst={isFirst}
                onReply={isBlocked ? undefined : setReplyingTo}
              />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Jump to present button */}
      {!isAtBottom && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
          <Button
            variant="primary"
            size="sm"
            className="gap-2 shadow-lg bg-primary text-primary-foreground hover:bg-primary-hover"
            onClick={scrollToBottom}
          >
            <ArrowDown className="w-4 h-4" />
            {newMessageCount > 0 ? `${newMessageCount} new messages` : 'Jump to Present'}
          </Button>
        </div>
      )}

      {/* Blocked state indicator */}
      {isBlocked ? (
        <div className="px-4 pb-4 sm:pb-6">
          <div className="flex items-center justify-center gap-2 py-4 px-4 bg-secondary rounded-2xl border border-border">
            <Ban className="w-4 h-4 text-muted-foreground" />
            <span className="text-[14px] sm:text-[15px] leading-[1.5] font-[Inter,system-ui,sans-serif] text-muted-foreground">
              {isBlockedByMe 
                ? "You have blocked this user" 
                : "You cannot message this user"}
            </span>
          </div>
        </div>
      ) : (
        /* Message input - matches channel input style */
        <DMMessageInput
          conversationId={currentConversation.id}
          otherUsername={otherUser?.username || 'user'}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}
    </div>
  );
};
