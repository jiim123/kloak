import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Ghost } from "lucide-react";
import { ChevronDown, Loader2, Hash, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MessageItem } from "./MessageItem";
import { MessageListSkeleton } from "@/components/ui/skeletons";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useServerStore } from "@/stores/serverStore";
import { useUnread } from "@/hooks/useUnread";
import { useScrollToMessage } from "@/hooks/useScrollToMessage";
import { useRealtimePolls } from "@/hooks/useRealtimePolls";
import type { Message } from "@/types";

interface MessageListProps {
  channelId: string;
  channelName: string;
}

// Group messages from same user within 1 minute
const shouldGroupMessages = (current: Message, previous: Message | null, isAnnouncementChannel: boolean): boolean => {
  if (!previous) return false;
  // Never group messages in announcement channels - each announcement should be separate
  if (isAnnouncementChannel) return false;
  if (current.user_id !== previous.user_id) return false;
  if (current.reply_to_id) return false; // Don't group replies

  const currentTime = new Date(current.created_at).getTime();
  const previousTime = new Date(previous.created_at).getTime();

  // Changed from 5 minutes to 1 minute
  const oneMinute = 1 * 60 * 1000;

  return currentTime - previousTime < oneMinute;
};

/**
 * Generate a stable key for a message that survives optimistic→real ID changes.
 * Uses timestamp (rounded to second) + user_id + content prefix.
 * This ensures React doesn't unmount/remount when temp-xxx becomes a real UUID.
 */
const getStableMessageKey = (message: Message): string => {
  // For non-temp messages, just use the ID (it's stable)
  if (!message.id.startsWith("temp-")) {
    return message.id;
  }
  // For temp messages, use content-based key that will match the real message
  const timestamp = Math.floor(new Date(message.created_at).getTime() / 1000);
  const contentPrefix = message.content.substring(0, 30).replace(/\s+/g, "_");
  return `pending-${timestamp}-${message.user_id}-${contentPrefix}`;
};

export const MessageList = ({ channelId, channelName }: MessageListProps) => {
  const { user } = useAuthStore();
  const { isLoading, fetchMessages, setCurrentChannel, messagesByChannel } = useMessageStore();
  const visibilityBlockedUserIds = useFriendStore((s) => s.visibilityBlockedUserIds);
  const { currentChannel } = useServerStore();
  const isAnnouncementChannel = currentChannel?.type === "announcement";

  // Polls realtime + auto-close expired (best effort)
  useRealtimePolls(channelId);

  // Subscribe to messages for this specific channel
  const channelData = messagesByChannel[channelId];
  const rawMessages = channelData?.messages || [];
  const messages = useMemo(() => {
    if (!visibilityBlockedUserIds || visibilityBlockedUserIds.length === 0) return rawMessages;
    const blocked = new Set(visibilityBlockedUserIds);
    return rawMessages.filter((m) => !blocked.has(m.user_id));
  }, [rawMessages, visibilityBlockedUserIds]);
  const hasMore = channelData?.hasMore ?? true;

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const hasMarkedAsReadRef = useRef(false);
  const prevMessagesLengthRef = useRef(0);

  // Unread tracking
  const channelIds = useMemo(() => [channelId], [channelId]);
  const { getChannelUnread, markAsRead } = useUnread(channelIds);
  const { lastReadAt, firstUnreadMessageId } = getChannelUnread(channelId);

  // Scroll to message from notification
  const { highlightedMessageId } = useScrollToMessage({ messages, isLoading });

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

  // Set current channel and fetch messages (with caching)
  useEffect(() => {
    setCurrentChannel(channelId);
    fetchMessages(channelId).then(() => {
      // For announcement channels, scroll to top (newest); for others, scroll to bottom
      setTimeout(() => {
        if (isAnnouncementChannel) {
          containerRef.current?.scrollTo({ top: 0, behavior: "instant" });
          isNearBottomRef.current = false;
        } else {
          bottomRef.current?.scrollIntoView({ behavior: "instant" });
          isNearBottomRef.current = true;
        }
        setShowJumpToPresent(false);
      }, 50);
    });
    hasMarkedAsReadRef.current = false;
    prevMessagesLengthRef.current = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, isAnnouncementChannel]);

  // Reconcile after sleep/background: refetch latest when app regains focus/visibility.
  // This ensures we catch any messages that realtime subscriptions might have missed
  // when the tab was hidden (browsers throttle/pause WebSocket connections in hidden tabs).
  // We always refetch, but silently (no loading indicator) if we already have messages.
  const hiddenTimeRef = useRef<number | null>(null);
  const isRefetchingRef = useRef(false);
  
  useEffect(() => {
    const handleFocus = () => {
      // Always refetch when tab regains focus to catch missed realtime messages
      // But only if we're not already refetching
      if (!isRefetchingRef.current) {
        isRefetchingRef.current = true;
        // Silent refetch if we already have messages (no loading indicator)
        const hasMessages = messages.length > 0;
        fetchMessages(channelId, 50, undefined, true, hasMessages).finally(() => {
          isRefetchingRef.current = false;
        });
      }
      hiddenTimeRef.current = null;
    };
    
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Track when tab becomes hidden
        hiddenTimeRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        // Always refetch when tab becomes visible to catch missed realtime messages
        // This ensures users see all messages even if realtime subscriptions were paused
        if (!isRefetchingRef.current) {
          isRefetchingRef.current = true;
          // Silent refetch if we already have messages (no loading indicator)
          const hasMessages = messages.length > 0;
          fetchMessages(channelId, 50, undefined, true, hasMessages).finally(() => {
            isRefetchingRef.current = false;
          });
        }
        hiddenTimeRef.current = null;
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [channelId, fetchMessages, messages.length]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    // Only react to actual new messages (not initial load or temp→real replacement)
    if (currentLength > prevLength && prevLength > 0) {
      if (isAnnouncementChannel) {
        // For announcement channels, scroll to top (newest) if near top
        if (isNearBottomRef.current === false && containerRef.current) {
          containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
          setNewMessageCount(0);
        } else {
          setNewMessageCount((prev) => prev + (currentLength - prevLength));
        }
      } else {
        // For regular channels, scroll to bottom if near bottom
        if (isNearBottomRef.current && bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: "smooth" });
          setNewMessageCount(0);
        } else {
          setNewMessageCount((prev) => prev + (currentLength - prevLength));
        }
      }
    }

    prevMessagesLengthRef.current = currentLength;
  }, [messages.length, isAnnouncementChannel]);

  // Mark as read when viewing channel (automatic)
  useEffect(() => {
    if (messages.length > 0 && !hasMarkedAsReadRef.current) {
      // For announcement channels, mark as read when viewing top (newest)
      // For regular channels, mark as read when viewing bottom (newest)
      const shouldMarkAsRead = isAnnouncementChannel 
        ? !isNearBottomRef.current // Near top = viewing newest
        : isNearBottomRef.current; // Near bottom = viewing newest
      
      if (shouldMarkAsRead) {
        const latestMessage = isAnnouncementChannel 
          ? messages[0] // First in array = newest
          : messages[messages.length - 1]; // Last in array = newest
        if (latestMessage && !latestMessage.id.startsWith("temp-")) {
          markAsRead(channelId, latestMessage.id);
          hasMarkedAsReadRef.current = true;
        }
      }
    }
  }, [messages, channelId, markAsRead, isAnnouncementChannel]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    if (isAnnouncementChannel) {
      // For announcement channels: top = newest, bottom = oldest
      // "Near bottom" means viewing older messages
      isNearBottomRef.current = distanceFromBottom < 100;
      // "Jump to present" = jump to top (newest)
      setShowJumpToPresent(scrollTop > 100 && messages.length > 0);

      // Load more older messages when scrolling to bottom
      if (distanceFromBottom < 100 && hasMore && !isLoading) {
        const oldestMessage = messages[messages.length - 1]; // Last in array = oldest
        if (oldestMessage) {
          fetchMessages(channelId, 50, oldestMessage.created_at);
        }
      }
    } else {
      // For regular channels: top = oldest, bottom = newest
      isNearBottomRef.current = distanceFromBottom < 100;
      setShowJumpToPresent(!isNearBottomRef.current && messages.length > 0);

      // Load more when scrolling to top
      if (scrollTop < 100 && hasMore && !isLoading) {
        const oldestMessage = messages[0];
        if (oldestMessage) {
          fetchMessages(channelId, 50, oldestMessage.created_at);
        }
      }
    }
  }, [channelId, hasMore, isLoading, messages, fetchMessages, isAnnouncementChannel]);

  const scrollToBottom = () => {
    if (isAnnouncementChannel) {
      // For announcement channels, "present" = top (newest)
      containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      setShowJumpToPresent(false);
      setNewMessageCount(0);
      // Mark as read when jumping to present (newest message)
      if (messages.length > 0) {
        const latestMessage = messages[0]; // First in array = newest
        if (!latestMessage.id.startsWith("temp-")) {
          markAsRead(channelId, latestMessage.id);
        }
      }
    } else {
      // For regular channels, "present" = bottom (newest)
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      setShowJumpToPresent(false);
      setNewMessageCount(0);
      // Mark as read when jumping to present
      if (messages.length > 0) {
        const latestMessage = messages[messages.length - 1];
        if (!latestMessage.id.startsWith("temp-")) {
          markAsRead(channelId, latestMessage.id);
        }
      }
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

  // Deduplicate messages - prefer real messages over temp ones
  const deduplicatedMessages = useMemo(() => {
    const seen = new Map<string, Message>();

    // First pass: collect all messages by their stable key
    for (const msg of messages) {
      const stableKey = getStableMessageKey(msg);
      const existing = seen.get(stableKey);

      if (!existing) {
        seen.set(stableKey, msg);
      } else {
        // Prefer real message over temp message
        if (msg.id.startsWith("temp-") && !existing.id.startsWith("temp-")) {
          // Keep existing (real message)
        } else if (!msg.id.startsWith("temp-") && existing.id.startsWith("temp-")) {
          // Replace with real message
          seen.set(stableKey, msg);
        }
        // If both are same type, keep first one
      }
    }

    // Convert back to array and sort by created_at
    // For announcement channels, sort newest first (descending)
    // For other channels, sort oldest first (ascending)
    return Array.from(seen.values()).sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return isAnnouncementChannel ? timeB - timeA : timeA - timeB;
    });
  }, [messages, isAnnouncementChannel]);

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
            {currentChannel?.ghost_mode ? (
              <>
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
                  <Ghost className="w-10 h-10 text-muted-foreground" />
                </div>
                <h2 className="text-3xl font-bold text-foreground mb-2">Anonymous Channel</h2>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Messages in <span className="font-semibold">#{channelName}</span> are anonymous. 
                  Your username and avatar won't be visible to other members.
                </p>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Ghost className="w-4 h-4" />
                    <span>Your identity is hidden from other members</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    <span>Be the first to send an anonymous message!</span>
                  </div>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="py-4">
          {deduplicatedMessages.map((message, index) => {
            const previousMessage = index > 0 ? deduplicatedMessages[index - 1] : null;
            const isGrouped = shouldGroupMessages(message, previousMessage, isAnnouncementChannel);
            const showNewDivider = index === newMessagesDividerIndex && !hasMarkedAsReadRef.current;

            return (
              <MessageItem
                key={getStableMessageKey(message)}
                message={message}
                isGrouped={isGrouped}
                showNewDivider={showNewDivider}
                isHighlighted={message.id === highlightedMessageId}
              />
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
              variant="primary"
              className="relative overflow-hidden rounded-full shadow-xl px-4 py-2 h-auto"
            >
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
