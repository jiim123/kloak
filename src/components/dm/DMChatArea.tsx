import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { ArrowDown, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StackedAvatars } from '@/components/ui/stacked-avatars';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useFriendStore } from '@/stores/friendStore';
import { useUnreadDMsContext } from '@/hooks/useUnreadDMsContext';
import { useSwipeGestureRef } from '@/hooks/useSwipeGesture';
import { useIsMobile } from '@/hooks/use-mobile';
import { DMMessageInput } from './DMMessageInput';
import { DMMessageItem } from './DMMessageItem';
import { DMHeader } from './DMHeader';
import { GroupChatHeader } from './GroupChatHeader';
import type { DirectMessage, User } from '@/types';

export const DMChatArea = () => {
  const { user } = useAuthStore();
  const { currentConversation, isLoading, fetchMessages, getMessages } = useDMStore();
  const { setMobileSidebarOpen } = useUIStore();
  const { blockedUsers, visibilityBlockedUserIds } = useFriendStore();
  const { markAsRead } = useUnreadDMsContext();
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
  const scrollRAFRef = useRef<number | null>(null);
  const needsScrollRef = useRef(true);
  const prevConversationIdRef = useRef<string | null>(null);

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);

  // Detect conversation switch during render phase (synchronous)
  if (prevConversationIdRef.current !== currentConversation?.id) {
    prevConversationIdRef.current = currentConversation?.id || null;
    needsScrollRef.current = true;
  }

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
      setNewMessageCount(0);
      setIsAtBottom(true);
    }
  }, [currentConversation?.id, user?.id, fetchMessages, markAsRead]);

  // Scroll to bottom AFTER messages render on conversation switch
  // useLayoutEffect fires synchronously after DOM mutations but before paint
  useLayoutEffect(() => {
    if (needsScrollRef.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' });
      setIsAtBottom(true);
      needsScrollRef.current = false;
    }
  }, [messages.length, currentConversation?.id]);

  // Removed: visibility-change handler was redundant — realtime handles incoming messages

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

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (scrollRAFRef.current !== null) {
        cancelAnimationFrame(scrollRAFRef.current);
      }
    };
  }, []);

  // Check scroll position with RAF debouncing for better performance
  const handleScroll = useCallback(() => {
    // Cancel any pending RAF to debounce scroll updates
    if (scrollRAFRef.current !== null) {
      cancelAnimationFrame(scrollRAFRef.current);
    }

    scrollRAFRef.current = requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;

      // Only update state if value changed to prevent unnecessary re-renders
      setIsAtBottom((prev) => {
        if (prev !== atBottom) {
          return atBottom;
        }
        return prev;
      });

      scrollRAFRef.current = null;
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMessageCount(0);
    setIsAtBottom(true);
  }, []);

  // Group messages by sender within 5 minutes - memoized to prevent recalculation
  const groupedMessages = useMemo(() => {
    const groups: { message: DirectMessage; isFirst: boolean }[] = [];

    messages.forEach((msg, index) => {
      const prevMsg = messages[index - 1];
      const isFirst =
        !prevMsg ||
        prevMsg.sender_id !== msg.sender_id ||
        new Date(msg.created_at || '').getTime() - new Date(prevMsg.created_at || '').getTime() > 5 * 60 * 1000;

      groups.push({ message: msg, isFirst });
    });

    return groups;
  }, [messages]);

  // Determine if this is a group conversation
  const isGroup = currentConversation?.is_group || false;

  // Get other participants for group chats (excluding current user)
  const otherParticipants = useMemo(() => {
    if (!isGroup || !currentConversation?.participants) return [];
    return currentConversation.participants
      .filter((p) => p.user_id !== user?.id)
      .map((p) => p.user)
      .filter((u): u is User => u != null);
  }, [isGroup, currentConversation?.participants, user?.id]);

  // Get display name for group intro
  const getGroupDisplayName = useCallback(() => {
    if (!currentConversation) return "";
    if (currentConversation.name) return currentConversation.name;
    
    const names = otherParticipants
      .slice(0, 3)
      .map((p) => p.display_name || p.username || "Unknown");
    
    if (otherParticipants.length > 3) {
      return `${names.join(", ")} and ${otherParticipants.length - 3} others`;
    }
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    if (names.length === 0) return "Group";
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }, [currentConversation, otherParticipants]);

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
      {/* Header - different for group vs 1:1 */}
      {isGroup ? (
        <GroupChatHeader 
          conversation={currentConversation} 
          participants={otherParticipants} 
        />
      ) : (
        <DMHeader otherUser={otherUser} />
      )}

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4"
        onScroll={handleScroll}
      >
        {/* Start of conversation - different for group vs 1:1 */}
        {isGroup ? (
          <div className="py-8 mb-4">
            <div className="flex items-center gap-4 mb-4">
              <StackedAvatars users={otherParticipants} size="lg" />
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              {currentConversation.name || "Group Chat"}
            </h2>
            <p className="text-muted-foreground">
              This is the beginning of your group chat with{' '}
              <span className="font-semibold">{getGroupDisplayName()}</span>.
            </p>
          </div>
        ) : (
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
        )}

        {/* Messages */}
        {isLoading && messages.length === 0 ? (
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
            className="gap-2 shadow-lg"
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
          otherUsername={isGroup ? getGroupDisplayName() : (otherUser?.username || 'user')}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}
    </div>
  );
};
