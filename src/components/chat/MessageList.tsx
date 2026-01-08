import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { ChevronDown, Loader2, Hash, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageItem } from "./MessageItem";
import { MessageListSkeleton } from "@/components/ui/skeletons";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";
import { useUnread } from "@/hooks/useUnread";
import type { Message } from "@/types";

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
  const { user } = useAuthStore();
  const { messages, isLoading, hasMore, fetchMessages, clearMessages } = useMessageStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const hasMarkedAsReadRef = useRef(false);

  // Unread tracking
  const channelIds = useMemo(() => [channelId], [channelId]);
  const { getChannelUnread, markAsRead } = useUnread(channelIds);
  const { lastReadAt, firstUnreadMessageId } = getChannelUnread(channelId);

  // Enable realtime updates
  useRealtimeMessages(channelId);

  // Listen for Up arrow edit event
  useEffect(() => {
    const handleEditLastMessage = (e: CustomEvent<{ userId: string; channelId: string }>) => {
      if (e.detail.channelId !== channelId || !e.detail.userId) return;

      // Find the last message by this user in this channel
      const userMessages = messages.filter((m) => m.user_id === e.detail.userId);
      if (userMessages.length > 0) {
        const lastOwnMessage = userMessages[userMessages.length - 1];
        // Dispatch event to trigger edit on that specific message
        window.dispatchEvent(
          new CustomEvent("startEditMessage", {
            detail: { messageId: lastOwnMessage.id },
          }),
        );
      }
    };

    window.addEventListener("editLastMessage" as any, handleEditLastMessage);
    return () => window.removeEventListener("editLastMessage" as any, handleEditLastMessage);
  }, [channelId, messages]);

  // Fetch messages on channel change and scroll to bottom
  useEffect(() => {
    clearMessages();
    fetchMessages(channelId).then(() => {
      // Scroll to bottom after messages load
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "instant" });
        isNearBottomRef.current = true;
        setShowJumpToPresent(false);
      }, 50);
    });
    hasMarkedAsReadRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Auto-scroll when new messages arrive (if near bottom)
  useEffect(() => {
    if (isNearBottomRef.current && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
      setNewMessageCount(0);
    } else if (messages.length > 0) {
      setNewMessageCount((prev) => prev + 1);
    }
  }, [messages.length]);

  // Mark as read when viewing channel (automatic)
  useEffect(() => {
    if (messages.length > 0 && !hasMarkedAsReadRef.current && isNearBottomRef.current) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage) {
        markAsRead(channelId, latestMessage.id);
        hasMarkedAsReadRef.current = true;
      }
    }
  }, [messages, channelId, markAsRead]);

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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowJumpToPresent(false);
    setNewMessageCount(0);
    // Mark as read when jumping to present
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      markAsRead(channelId, latestMessage.id);
    }
  };

  // Find the index where the NEW divider should appear
  const newMessagesDividerIndex = useMemo(() => {
    if (!lastReadAt || !firstUnreadMessageId) return -1;

    const lastReadTime = new Date(lastReadAt).getTime();
    for (let i = 0; i < messages.length; i++) {
      const msgTime = new Date(messages[i].created_at).getTime();
      if (msgTime > lastReadTime) {
        return i;
      }
    }
    return -1;
  }, [messages, lastReadAt, firstUnreadMessageId]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div ref={containerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {/* Loading skeleton for initial load */}
        {isLoading && messages.length === 0 && <MessageListSkeleton />}

        {/* Loading indicator for pagination */}
        {isLoading && messages.length > 0 && (
          <div className="flex justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Channel welcome message - enhanced empty state */}
        {!isLoading && messages.length === 0 && (
          <div className="flex flex-col items-start px-4 pt-16 pb-8">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <Hash className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground mb-2">Welcome to #{channelName}!</h2>
            <p className="text-muted-foreground mb-4">
              This is the start of the <span className="font-semibold">#{channelName}</span> channel.
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 text-yellow-500" />
              <span>Be the first to send a message!</span>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="py-4">
          {messages.map((message, index) => {
            const previousMessage = index > 0 ? messages[index - 1] : null;
            const isGrouped = shouldGroupMessages(message, previousMessage);
            const showNewDivider = index === newMessagesDividerIndex && !hasMarkedAsReadRef.current;

            return (
              <div key={message.id}>
                {/* New messages divider */}
                {showNewDivider && (
                  <div className="flex items-center gap-2 px-4 my-2">
                    <div className="flex-1 h-px bg-destructive" />
                    <span className="text-xs font-semibold text-destructive uppercase px-2">New</span>
                    <div className="flex-1 h-px bg-destructive" />
                  </div>
                )}
                <MessageItem message={message} isGrouped={isGrouped} />
              </div>
            );
          })}
        </div>

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Jump to present button */}
      <AnimatePresence>
        {showJumpToPresent && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="absolute bottom-4 right-4 z-10"
          >
            <Button
              onClick={scrollToBottom}
              className="relative overflow-hidden rounded-full shadow-xl backdrop-blur-md bg-background/80 border-2 border-primary/30 hover:bg-background/90 hover:border-primary/50 transition-all px-4 py-2 h-auto"
            >
              {/* Animated border pulse */}
              <span className="absolute inset-0 rounded-full border-1 border-primary/50 animate-pulse-border pointer-events-none" />

              {/* Content */}
              <div className="relative flex items-center gap-2">
                <ChevronDown className="w-4 h-4" />
                <span className="text-sm font-medium">
                  {newMessageCount > 0 ? `${newMessageCount} new` : "Jump to present"}
                </span>
              </div>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
