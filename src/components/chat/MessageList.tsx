import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
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
import { useUnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import { useScrollToMessage } from "@/hooks/useScrollToMessage";
import { useRealtimePolls } from "@/hooks/useRealtimePolls";
import type { Message } from "@/types";

interface MessageListProps {
  channelId: string;
  channelName: string;
}

// Group messages from same user within 1 minute
const shouldGroupMessages = (current: Message, previous: Message | null): boolean => {
  if (!previous) return false;
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

  // Deduplicate messages - prefer real messages over temp ones
  // This must be defined early so it can be used in useLayoutEffect for scroll positioning
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
      return timeA - timeB;
    });
  }, [messages]);

  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const lastMarkedMessageIdRef = useRef<string | null>(null); // Track last marked message ID instead of boolean
  const prevMessagesLengthRef = useRef(0);
  const needsScrollRef = useRef(true); // true on initial mount
  const prevChannelIdRef = useRef<string>(channelId);
  const scrollRAFRef = useRef<number | null>(null); // For requestAnimationFrame
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null); // For refetch timeout

  // Detect channel switch during RENDER PHASE (synchronous).
  // This must happen before useLayoutEffect so the flag is already
  // set when the layout effect reads it — fixing the stale-cache bug
  // where switching back to a cached channel kept the scroll at the top.
  if (prevChannelIdRef.current !== channelId) {
    prevChannelIdRef.current = channelId;
    needsScrollRef.current = true;
  }

  // Unread tracking
  const { getChannelUnread, markAsRead } = useUnreadChannelsContext();
  const { lastReadAt, firstUnreadMessageId } = getChannelUnread(channelId);

  // Scroll to message from notification
  const { highlightedMessageId } = useScrollToMessage({ messages, isLoading, containerRef });

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
    prevMessagesLengthRef.current = 0;
    lastMarkedMessageIdRef.current = null; // Reset for new channel
    setShowJumpToPresent(false);
    setNewMessageCount(0);

    // IMPORTANT: Always force a silent refetch on channel entry so users see newly arrived messages
    // even if realtime is temporarily unhealthy and the cache is still "fresh".
    const hasCached = (useMessageStore.getState().messagesByChannel[channelId]?.messages?.length ?? 0) > 0;
    fetchMessages(channelId, 50, undefined, true, hasCached);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId]);

  // Fallback polling: if realtime is paused/misconfigured, ensure the channel still updates.
  // This is intentionally light (15s) and only when visible.
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchMessages(channelId, 50, undefined, true, true);
    }, 15000);

    return () => clearInterval(interval);
  }, [channelId, fetchMessages]);

  // Scroll to bottom AFTER messages render on channel switch.
  // useLayoutEffect fires synchronously after DOM mutations but before paint,
  // so the user never sees the mid-conversation position.
  // `channelId` is in the deps so this re-fires even when switching back to a
  // cached channel whose `messages` reference hasn't changed.
  // We use deduplicatedMessages.length to ensure we scroll after the actual
  // rendered content is ready, not just when the raw messages are available.
  useLayoutEffect(() => {
    if (needsScrollRef.current && deduplicatedMessages.length > 0) {
      // Use scrollIntoView for more reliable scrolling
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      isNearBottomRef.current = true;
      needsScrollRef.current = false;
    }
  }, [deduplicatedMessages.length, channelId]);

  // Reconcile after sleep/background: refetch latest when app regains focus/visibility.
  // This ensures we catch any messages that realtime subscriptions might have missed
  // when the tab was hidden (browsers throttle/pause WebSocket connections in hidden tabs).
  // We always refetch, but silently (no loading indicator) if we already have messages.
  const hiddenTimeRef = useRef<number | null>(null);
  const isRefetchingRef = useRef(false);

  useEffect(() => {
    const MIN_HIDDEN_MS_FOR_REFETCH = 15_000; // skip refetch for quick tab switches

    // Consolidated refetch handler with error recovery
    const performRefetch = (reason: "visibility" | "focus") => {
      if (isRefetchingRef.current) return;

      // Avoid refetching on window focus if the tab is visible; visibilitychange already covers it.
      if (reason === "focus" && document.visibilityState === "visible") {
        return;
      }

      // If the tab was only hidden briefly, don't refetch.
      if (hiddenTimeRef.current) {
        const hiddenFor = Date.now() - hiddenTimeRef.current;
        if (hiddenFor > 0 && hiddenFor < MIN_HIDDEN_MS_FOR_REFETCH) {
          return;
        }
      }

      isRefetchingRef.current = true;

      // Safety timeout: force-reset refetch flag after 5 seconds
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
      refetchTimeoutRef.current = setTimeout(() => {
        isRefetchingRef.current = false;
        refetchTimeoutRef.current = null;
      }, 5000);

      // Silent refetch if we already have messages (no loading indicator)
      const hasMessages = messages.length > 0;
      fetchMessages(channelId, 50, undefined, true, hasMessages)
        .catch((error) => {
          console.error("Failed to refetch messages on focus/visibility:", error);
        })
        .finally(() => {
          isRefetchingRef.current = false;
          if (refetchTimeoutRef.current) {
            clearTimeout(refetchTimeoutRef.current);
            refetchTimeoutRef.current = null;
          }
        });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        // Track when tab becomes hidden
        hiddenTimeRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        // Refetch when tab becomes visible
        performRefetch("visibility");
        hiddenTimeRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      // Cleanup timeout on unmount
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
      }
      // Cleanup RAF on unmount
      if (scrollRAFRef.current !== null) {
        cancelAnimationFrame(scrollRAFRef.current);
      }
    };
  }, [channelId, fetchMessages, messages.length]);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    // Only react to actual new messages (not initial load or temp→real replacement)
    if (currentLength > prevLength && prevLength > 0) {
      if (isNearBottomRef.current && bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: "smooth" });
        setNewMessageCount(0);
      } else {
        setNewMessageCount((prev) => prev + (currentLength - prevLength));
      }
    }

    prevMessagesLengthRef.current = currentLength;
  }, [messages.length]);

  // Mark as read when viewing channel (automatic)
  // Only mark as read if we're at the bottom and haven't already marked this message
  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      const latestMessage = messages[messages.length - 1];
      if (
        latestMessage &&
        !latestMessage.id.startsWith("temp-") &&
        lastMarkedMessageIdRef.current !== latestMessage.id
      ) {
        markAsRead(channelId, latestMessage.id);
        lastMarkedMessageIdRef.current = latestMessage.id;
      }
    }
  }, [messages, channelId, markAsRead]);

  // Handle scroll events with RAF for better performance
  const handleScroll = useCallback(() => {
    // Cancel any pending RAF to debounce scroll updates
    if (scrollRAFRef.current !== null) {
      cancelAnimationFrame(scrollRAFRef.current);
    }

    scrollRAFRef.current = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      const wasNearBottom = isNearBottomRef.current;
      const isNearBottom = distanceFromBottom < 100;

      isNearBottomRef.current = isNearBottom;

      // Only update state if the near-bottom status changed
      if (wasNearBottom !== isNearBottom) {
        setShowJumpToPresent(!isNearBottom && deduplicatedMessages.length > 0);
      }

      // Load more when scrolling to top
      if (scrollTop < 100 && hasMore && !isLoading) {
        const oldestMessage = deduplicatedMessages[0];
        if (oldestMessage) {
          fetchMessages(channelId, 50, oldestMessage.created_at);
        }
      }

      scrollRAFRef.current = null;
    });
  }, [channelId, hasMore, isLoading, deduplicatedMessages, fetchMessages]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowJumpToPresent(false);
    setNewMessageCount(0);

    // Mark as read, but only if different from last marked message
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (
        !latestMessage.id.startsWith("temp-") &&
        lastMarkedMessageIdRef.current !== latestMessage.id
      ) {
        markAsRead(channelId, latestMessage.id);
        lastMarkedMessageIdRef.current = latestMessage.id;
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

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden" onScroll={handleScroll}>
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
          <div
            className={`flex flex-col px-4 pt-16 pb-8 ${currentChannel?.ghost_mode ? "items-center text-center" : "items-start"}`}
          >
            {currentChannel?.ghost_mode ? (
              <>
                <div className="relative mb-6">
                  <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl scale-150" />
                  <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 flex items-center justify-center">
                    <Ghost className="w-12 h-12 text-muted-foreground" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-foreground mb-3">Anonymous Channel</h2>
                <p className="text-muted-foreground max-w-sm leading-relaxed">
                  Messages in <span className="font-semibold text-foreground">#{channelName}</span> are anonymous. Your
                  identity stays hidden from other members.
                </p>
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
            const isGrouped = shouldGroupMessages(message, previousMessage);
            const showNewDivider = index === newMessagesDividerIndex && lastMarkedMessageIdRef.current === null;

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
