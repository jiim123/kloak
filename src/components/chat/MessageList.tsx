import { useEffect, useRef, useState, useCallback, useMemo, Fragment } from "react";
import { Virtuoso, type VirtuosoHandle } from "react-virtuoso";

import { Ghost } from "lucide-react";
import { ChevronDown, Loader2, Hash, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageItem } from "./MessageItem";
import { MessageListSkeleton } from "@/components/ui/skeletons";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useServerStore } from "@/stores/serverStore";
import { useUnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import { useScrollToMessage } from "@/hooks/useScrollToMessage";
import { useRealtimePolls } from "@/hooks/useRealtimePolls";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useRealtimeUserUpdates } from "@/hooks/useRealtimeUserUpdates";
import { supabase } from "@/integrations/supabase/client";
import type { CustomServerRole, Message, ServerRole } from "@/types";
import { format, isSameDay, isToday, isYesterday } from "date-fns";

interface MessageListProps {
  channelId: string;
  channelName: string;
  /** When false, don't mutate global currentChannel in server store */
  manageCurrentChannel?: boolean;
}

const CHANNEL_ENTRY_FORCE_REFETCH_MAX_AGE_MS = 12_000;
const AUTHOR_STYLE_FETCH_CHUNK = 100;

interface MessageAuthorStyle {
  user_id: string;
  role?: ServerRole | null;
  nickname?: string | null;
  roles?: CustomServerRole[];
}

const parseAuthorStyleRows = (payload: unknown): MessageAuthorStyle[] => {
  let rows: unknown = payload;

  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      return [];
    }
  }

  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is MessageAuthorStyle => !!row && typeof row === "object" && "user_id" in row);
};

// Group messages from same user within 1 minute
const shouldGroupMessages = (current: Message, previous: Message | null): boolean => {
  if (!previous) return false;
  if (current.user_id !== previous.user_id) return false;
  if (current.reply_to_id) return false;

  const currentTime = new Date(current.created_at).getTime();
  const previousTime = new Date(previous.created_at).getTime();
  const oneMinute = 1 * 60 * 1000;

  return currentTime - previousTime < oneMinute;
};

const getStableMessageKey = (message: Message): string => {
  if (!message.id.startsWith("temp-")) {
    return message.id;
  }
  const timestamp = Math.floor(new Date(message.created_at).getTime() / 1000);
  const contentPrefix = message.content.substring(0, 30).replace(/\s+/g, "_");
  return `pending-${timestamp}-${message.user_id}-${contentPrefix}`;
};

const getDateDividerLabel = (date: Date): string => {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE, MMMM d, yyyy");
};

export const MessageList = ({ channelId, channelName, manageCurrentChannel = true }: MessageListProps) => {
  const { user } = useAuthStore();
  const { isLoading, fetchMessages, setCurrentChannel, messagesByChannel, fetchingChannels } = useMessageStore();
  const { isRealtimeConnected } = useConnectionStatus();
  const visibilityBlockedUserIds = useFriendStore((s) => s.visibilityBlockedUserIds);
  const currentChannel = useServerStore((s) => s.currentChannel);
  const channels = useServerStore((s) => s.channels);
  const currentServerId = useServerStore((s) => s.currentChannel?.server_id ?? s.currentServer?.id ?? null);
  const isVoiceAttachedTextChannel = useMemo(
    () => !!channels.find((c) => c.id === channelId)?.linked_voice_channel_id,
    [channels, channelId],
  );

  // Polls realtime + auto-close expired (best effort)
  useRealtimePolls(channelId);

  // Subscribe to messages for this specific channel
  const channelData = messagesByChannel[channelId];
  const isFetchingOlder = !!fetchingChannels[channelId];
  const rawMessages = channelData?.messages || [];
  const messages = useMemo(() => {
    if (!visibilityBlockedUserIds || visibilityBlockedUserIds.length === 0) return rawMessages;
    const blocked = new Set(visibilityBlockedUserIds);
    return rawMessages.filter((m) => !blocked.has(m.user_id));
  }, [rawMessages, visibilityBlockedUserIds]);
  const hasMore = channelData?.hasMore ?? true;

  // Deduplicate messages - prefer real messages over temp ones
  const deduplicatedMessages = useMemo(() => {
    const seen = new Map<string, Message>();

    for (const msg of messages) {
      const stableKey = getStableMessageKey(msg);
      const existing = seen.get(stableKey);

      if (!existing) {
        seen.set(stableKey, msg);
      } else {
        if (msg.id.startsWith("temp-") && !existing.id.startsWith("temp-")) {
          // Keep existing (real message)
        } else if (!msg.id.startsWith("temp-") && existing.id.startsWith("temp-")) {
          seen.set(stableKey, msg);
        }
      }
    }

    return Array.from(seen.values()).sort((a, b) => {
      const timeA = new Date(a.created_at).getTime();
      const timeB = new Date(b.created_at).getTime();
      return timeA - timeB;
    });
  }, [messages]);

  const visibleAuthorUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const msg of deduplicatedMessages) {
      if (msg.user_id) ids.add(msg.user_id);
    }
    return Array.from(ids);
  }, [deduplicatedMessages]);

  // Keep author profile fields fresh for currently rendered messages.
  useRealtimeUserUpdates(visibleAuthorUserIds, `channel-authors:${channelId}`);

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [authorStyleMap, setAuthorStyleMap] = useState<Record<string, MessageAuthorStyle>>({});
  const isNearBottomRef = useRef(true);
  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const prevMessagesLengthRef = useRef(0);
  const prevChannelIdRef = useRef<string>(channelId);
  const refetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authorStyleServerIdRef = useRef<string | null>(null);
  const initialScrollDoneRef = useRef(false);

  // Detect channel switch
  if (prevChannelIdRef.current !== channelId) {
    prevChannelIdRef.current = channelId;
    initialScrollDoneRef.current = false;
  }

  useEffect(() => {
    if (authorStyleServerIdRef.current === currentServerId) return;
    authorStyleServerIdRef.current = currentServerId;
    setAuthorStyleMap({});
  }, [currentServerId]);

  // Unread tracking
  const { getChannelUnread, markAsRead } = useUnreadChannelsContext();
  const channelUnread = getChannelUnread(channelId);
  const { lastReadAt, firstUnreadMessageId } = channelUnread;

  // Scroll to message from notification / reply clicks
  const { highlightedMessageId } = useScrollToMessage({ messages: deduplicatedMessages, isLoading, virtuosoRef });

  // Listen for Up arrow edit event
  useEffect(() => {
    const handleEditLastMessage = (e: CustomEvent<{ userId: string; channelId: string }>) => {
      if (e.detail.channelId !== channelId || !e.detail.userId) return;
      const userMessages = messages.filter((m) => m.user_id === e.detail.userId);
      if (userMessages.length > 0) {
        const lastOwnMessage = userMessages[userMessages.length - 1];
        window.dispatchEvent(
          new CustomEvent("startEditMessage", {
            detail: { messageId: lastOwnMessage.id },
          }),
        );
      }
    };
    const listener = handleEditLastMessage as unknown as EventListener;
    window.addEventListener("editLastMessage", listener);
    return () => window.removeEventListener("editLastMessage", listener);
  }, [channelId, messages]);

  // Set current channel and fetch messages (with caching)
  useEffect(() => {
    if (manageCurrentChannel) {
      setCurrentChannel(channelId);
    }
    prevMessagesLengthRef.current = 0;
    lastMarkedMessageIdRef.current = null;
    setShowJumpToPresent(false);
    setNewMessageCount(0);

    const cacheEntry = useMessageStore.getState().messagesByChannel[channelId];
    const hasCached = (cacheEntry?.messages?.length ?? 0) > 0;
    const isFreshEnough = !!cacheEntry && Date.now() - cacheEntry.lastFetched < CHANNEL_ENTRY_FORCE_REFETCH_MAX_AGE_MS;
    const unreadSnapshot = getChannelUnread(channelId);
    const hasUnreadBacklog = (unreadSnapshot.unreadCount ?? 0) > 0;

    const shouldForceRefetch = !hasCached || !isRealtimeConnected || !isFreshEnough || hasUnreadBacklog;
    if (shouldForceRefetch) {
      fetchMessages(channelId, 50, undefined, true, hasCached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, manageCurrentChannel]);

  // Fallback polling only when realtime is not healthy.
  useEffect(() => {
    if (isRealtimeConnected) return;

    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchMessages(channelId, 50, undefined, true, true);
    }, 30000);

    return () => clearInterval(interval);
  }, [channelId, fetchMessages, isRealtimeConnected]);

  // Reconcile after sleep/background
  const hiddenTimeRef = useRef<number | null>(null);
  const isRefetchingRef = useRef(false);

  useEffect(() => {
    const MIN_HIDDEN_MS_FOR_REFETCH = 15_000;

    const performRefetch = (reason: "visibility" | "focus") => {
      if (isRefetchingRef.current) return;
      if (reason === "focus" && document.visibilityState === "visible") return;

      if (hiddenTimeRef.current) {
        const hiddenFor = Date.now() - hiddenTimeRef.current;
        if (hiddenFor > 0 && hiddenFor < MIN_HIDDEN_MS_FOR_REFETCH) return;
      }

      isRefetchingRef.current = true;
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
      refetchTimeoutRef.current = setTimeout(() => {
        isRefetchingRef.current = false;
        refetchTimeoutRef.current = null;
      }, 5000);

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
        hiddenTimeRef.current = Date.now();
      } else if (document.visibilityState === "visible") {
        performRefetch("visibility");
        hiddenTimeRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (refetchTimeoutRef.current) clearTimeout(refetchTimeoutRef.current);
    };
  }, [channelId, fetchMessages, messages.length]);

  // Mark as read when viewing channel (automatic)
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

  // New message count tracking + bottom nudge
  useEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;

    if (currentLength > prevLength && prevLength > 0) {
      if (!isNearBottomRef.current) {
        setNewMessageCount((prev) => prev + (currentLength - prevLength));
      } else {
        // User is at bottom — Virtuoso's followOutput scrolls to the new item,
        // but may only reveal its top edge. Nudge to absolute bottom after render.
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER });
        });
      }
    }

    prevMessagesLengthRef.current = currentLength;
  }, [messages.length]);

  // Find the index where the NEW divider should appear
  const newMessagesDividerIndex = useMemo(() => {
    if (!lastReadAt || !firstUnreadMessageId) return -1;
    const lastReadTime = new Date(lastReadAt).getTime();
    for (let i = 0; i < deduplicatedMessages.length; i++) {
      const msgTime = new Date(deduplicatedMessages[i].created_at).getTime();
      if (msgTime > lastReadTime) {
        return i;
      }
    }
    return -1;
  }, [deduplicatedMessages, lastReadAt, firstUnreadMessageId]);

  const messageAuthorIds = useMemo(() => {
    const unique = new Set<string>();
    for (const message of deduplicatedMessages) {
      const authorId = message.user_id;
      if (!authorId) continue;
      if (authorId === "anonymous") continue;
      if (authorId.startsWith("ghost_")) continue;
      unique.add(authorId);
    }
    return Array.from(unique);
  }, [deduplicatedMessages]);

  const missingAuthorStyleIds = useMemo(
    () => messageAuthorIds.filter((userId) => !authorStyleMap[userId]),
    [messageAuthorIds, authorStyleMap],
  );

  useEffect(() => {
    if (!currentServerId || !user?.id || missingAuthorStyleIds.length === 0) return;

    let cancelled = false;

    const fetchAuthorStyles = async () => {
      const batchIds = missingAuthorStyleIds.slice(0, AUTHOR_STYLE_FETCH_CHUNK);
      const { data, error } = await supabase.rpc("get_message_author_styles" as any, {
        _server_id: currentServerId,
        _user_ids: batchIds,
        _requesting_user_id: user.id,
      });

      if (error || !data || cancelled) return;

      const rows = parseAuthorStyleRows(data);
      const next: Record<string, MessageAuthorStyle> = {};

      for (const row of rows) {
        if (row.user_id) {
          next[row.user_id] = {
            user_id: row.user_id,
            role: row.role ?? null,
            nickname: row.nickname ?? null,
            roles: Array.isArray(row.roles) ? row.roles : [],
          };
        }
      }

      if (cancelled || Object.keys(next).length === 0) return;
      setAuthorStyleMap((prev) => ({ ...prev, ...next }));
    };

    void fetchAuthorStyles().catch((error) => {
      console.error("Unexpected error fetching message author styles:", error);
    });

    return () => {
      cancelled = true;
    };
  }, [currentServerId, user?.id, missingAuthorStyleIds]);

  const scrollToBottom = useCallback(() => {
    // Use scrollToIndex with 'end' align and then nudge to absolute bottom
    // to ensure the last message is fully visible including its padding
    virtuosoRef.current?.scrollToIndex({
      index: deduplicatedMessages.length - 1,
      behavior: "smooth",
      align: "end",
    });
    // After the smooth scroll lands, nudge to the absolute bottom to ensure
    // the full last item (including any padding/margins) is visible
    setTimeout(() => {
      virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "auto" });
    }, 350);
    setShowJumpToPresent(false);
    setNewMessageCount(0);

    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (!latestMessage.id.startsWith("temp-") && lastMarkedMessageIdRef.current !== latestMessage.id) {
        markAsRead(channelId, latestMessage.id);
        lastMarkedMessageIdRef.current = latestMessage.id;
      }
    }
  }, [deduplicatedMessages.length, messages, channelId, markAsRead]);

  // Virtuoso callbacks
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    isNearBottomRef.current = atBottom;
    if (atBottom) {
      setShowJumpToPresent(false);
      setNewMessageCount(0);
    } else if (deduplicatedMessages.length > 10) {
      setShowJumpToPresent(true);
    }
  }, [deduplicatedMessages.length]);

  const handleStartReached = useCallback(() => {
    if (hasMore && !isLoading && !isFetchingOlder) {
      const beforeCursor = deduplicatedMessages[0]?.created_at || channelData?.oldestLoadedAt || undefined;
      if (beforeCursor) {
        fetchMessages(channelId, 50, beforeCursor);
      }
    }
  }, [hasMore, isLoading, isFetchingOlder, deduplicatedMessages, channelData?.oldestLoadedAt, fetchMessages, channelId]);

  // Render a single message row with date dividers and unread dividers
  const itemContent = useCallback(
    (index: number, message: Message) => {
      if (!message) return null;

      const previousMessage = index > 0 ? deduplicatedMessages[index - 1] : null;
      const isGrouped = shouldGroupMessages(message, previousMessage);
      const showNewDivider = index === newMessagesDividerIndex && lastMarkedMessageIdRef.current === null;
      const messageDate = new Date(message.created_at);
      const previousMessageDate = previousMessage ? new Date(previousMessage.created_at) : null;
      const showDateDivider = !previousMessageDate || !isSameDay(messageDate, previousMessageDate);
      const dateDividerLabel = getDateDividerLabel(messageDate);

      return (
        <Fragment>
          {showDateDivider && (
            <div className="flex items-center gap-3 px-4 my-4">
              <div className="h-px flex-1 bg-border/70" />
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {dateDividerLabel}
              </span>
              <div className="h-px flex-1 bg-border/70" />
            </div>
          )}
          <MessageItem
            message={message}
            isGrouped={isGrouped}
            showNewDivider={showNewDivider}
            isHighlighted={message.id === highlightedMessageId}
            authorStyleFallback={authorStyleMap[message.user_id]}
          />
        </Fragment>
      );
    },
    [deduplicatedMessages, newMessagesDividerIndex, highlightedMessageId, authorStyleMap],
  );

  // Compute key for each item
  const computeItemKey = useCallback(
    (index: number) => {
      const message = deduplicatedMessages[index];
      return message ? getStableMessageKey(message) : `idx-${index}`;
    },
    [deduplicatedMessages],
  );

  // Header component (shown at top of list)
  const headerContent = useMemo(() => {
    if (isLoading && messages.length > 0) {
      return (
        <div className="flex justify-center py-4">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return null;
  }, [isLoading, messages.length]);

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Loading skeleton for initial load */}
      {isLoading && messages.length === 0 && <MessageListSkeleton />}

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
              <h2 className="text-2xl font-medium text-foreground mb-3">Anonymous Channel</h2>
              <p className="text-muted-foreground max-w-sm leading-relaxed">
                Messages in <span className="font-medium text-foreground">#{channelName}</span> are anonymous. Your
                identity stays hidden from other members.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                <Hash className="w-10 h-10 text-primary" />
              </div>
              {isVoiceAttachedTextChannel ? (
                <>
                  <h2 className="text-2xl font-medium text-foreground mb-2">No messages yet</h2>
                  <p className="text-muted-foreground">
                    Use <span className="font-medium">#{channelName}</span> to chat while in voice.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-medium text-foreground mb-2">Welcome to #{channelName}!</h2>
                  <p className="text-muted-foreground mb-4">
                    This is the start of the <span className="font-medium">#{channelName}</span> channel.
                  </p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    <span>Be the first to send a message!</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Virtuoso message list */}
      {deduplicatedMessages.length > 0 && (
        <div ref={containerRef} className="flex-1 min-h-0">
          <Virtuoso
            ref={virtuosoRef}
            data={deduplicatedMessages}
            initialTopMostItemIndex={deduplicatedMessages.length - 1}
            followOutput={(isAtBottom) => isAtBottom ? "auto" : false}
            alignToBottom
            atBottomThreshold={150}
            atBottomStateChange={handleAtBottomStateChange}
            startReached={handleStartReached}
            overscan={600}
            increaseViewportBy={{ top: 400, bottom: 200 }}
            computeItemKey={computeItemKey}
            itemContent={itemContent}
            components={{
              Header: () => headerContent,
            }}
            style={{ height: '100%' }}
            className="overflow-x-hidden"
          />
        </div>
      )}

      {/* Jump to present button */}
      <AnimatePresence>
        {showJumpToPresent && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute bottom-4 right-4 z-10"
          >
            <button
              onClick={scrollToBottom}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/40 bg-primary text-primary-foreground shadow-md transition-colors duration-150 hover:bg-primary/90 hover:border-primary/60"
            >
              <ChevronDown className="w-4 h-4" />
              <span className="text-sm font-medium">
                {newMessageCount > 0 ? `${newMessageCount} new` : "Jump to present"}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
