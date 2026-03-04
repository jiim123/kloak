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
import { isSameDay, isToday, isYesterday, format } from "date-fns";

interface MessageListProps {
  channelId: string;
  channelName: string;
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
    try { rows = JSON.parse(rows); } catch { return []; }
  }
  if (!Array.isArray(rows)) return [];
  return rows.filter((row): row is MessageAuthorStyle => !!row && typeof row === "object" && "user_id" in row);
};

// Group messages from same user within 1 minute
const shouldGroupMessages = (current: Message, previous: Message | null): boolean => {
  if (!previous) return false;
  if (current.user_id !== previous.user_id) return false;
  if (current.reply_to_id) return false;
  return new Date(current.created_at).getTime() - new Date(previous.created_at).getTime() < 60_000;
};

const getStableMessageKey = (message: Message): string => {
  if (!message.id.startsWith("temp-")) return message.id;
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

  useRealtimePolls(channelId);

  const channelData = messagesByChannel[channelId];
  const isFetchingOlder = !!fetchingChannels[channelId];
  const rawMessages = channelData?.messages || [];

  // Filter blocked users — stable blocked set ref to avoid re-creating on every render
  const messages = useMemo(() => {
    if (!visibilityBlockedUserIds || visibilityBlockedUserIds.length === 0) return rawMessages;
    const blocked = new Set(visibilityBlockedUserIds);
    return rawMessages.filter((m) => !blocked.has(m.user_id));
  }, [rawMessages, visibilityBlockedUserIds]);

  const hasMore = channelData?.hasMore ?? true;

  // Deduplicate messages — skip sort since store already maintains order
  const deduplicatedMessages = useMemo(() => {
    const seen = new Map<string, Message>();
    for (const msg of messages) {
      const stableKey = getStableMessageKey(msg);
      const existing = seen.get(stableKey);
      if (!existing) {
        seen.set(stableKey, msg);
      } else if (!msg.id.startsWith("temp-") && existing.id.startsWith("temp-")) {
        seen.set(stableKey, msg);
      }
    }
    // Messages are already sorted chronologically from the store — only filter, don't re-sort
    if (seen.size === messages.length) return messages;
    return messages.filter((m) => seen.get(getStableMessageKey(m)) === m);
  }, [messages]);

  const visibleAuthorUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const msg of deduplicatedMessages) {
      if (msg.user_id) ids.add(msg.user_id);
    }
    return Array.from(ids);
  }, [deduplicatedMessages]);

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
  const authorStyleServerIdRef = useRef<string | null>(null);

  // -- Stable refs for effects that should NOT cause re-registration --
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;
  const deduplicatedMessagesRef = useRef(deduplicatedMessages);
  deduplicatedMessagesRef.current = deduplicatedMessages;

  // Reset on channel switch
  if (prevChannelIdRef.current !== channelId) {
    prevChannelIdRef.current = channelId;
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

  // Listen for Up arrow edit event — stable listener, uses ref
  useEffect(() => {
    const handleEditLastMessage = (e: CustomEvent<{ userId: string; channelId: string }>) => {
      if (e.detail.channelId !== channelIdRef.current || !e.detail.userId) return;
      const userMessages = messagesRef.current.filter((m) => m.user_id === e.detail.userId);
      if (userMessages.length > 0) {
        const lastOwnMessage = userMessages[userMessages.length - 1];
        window.dispatchEvent(new CustomEvent("startEditMessage", { detail: { messageId: lastOwnMessage.id } }));
      }
    };
    const listener = handleEditLastMessage as unknown as EventListener;
    window.addEventListener("editLastMessage", listener);
    return () => window.removeEventListener("editLastMessage", listener);
  }, []); // stable — uses refs

  // Set current channel and fetch messages
  useEffect(() => {
    if (manageCurrentChannel) setCurrentChannel(channelId);
    prevMessagesLengthRef.current = 0;
    lastMarkedMessageIdRef.current = null;
    setShowJumpToPresent(false);
    setNewMessageCount(0);

    const cacheEntry = useMessageStore.getState().messagesByChannel[channelId];
    const hasCached = (cacheEntry?.messages?.length ?? 0) > 0;
    const isFreshEnough = !!cacheEntry && Date.now() - cacheEntry.lastFetched < CHANNEL_ENTRY_FORCE_REFETCH_MAX_AGE_MS;
    const unreadSnapshot = getChannelUnread(channelId);
    const hasUnreadBacklog = (unreadSnapshot.unreadCount ?? 0) > 0;

    if (!hasCached || !isRealtimeConnected || !isFreshEnough || hasUnreadBacklog) {
      fetchMessages(channelId, 50, undefined, true, hasCached);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, manageCurrentChannel]);

  // Fallback polling when realtime is down — stable, uses refs
  useEffect(() => {
    if (isRealtimeConnected) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchMessagesRef.current(channelIdRef.current, 50, undefined, true, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [isRealtimeConnected]);

  // Reconcile after sleep/background — STABLE listener, no deps on messages.length
  useEffect(() => {
    const MIN_HIDDEN_MS = 15_000;
    let hiddenTime: number | null = null;
    let isRefetching = false;
    let refetchTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenTime = Date.now();
        return;
      }
      // visible
      if (isRefetching) return;
      if (hiddenTime && Date.now() - hiddenTime < MIN_HIDDEN_MS) {
        hiddenTime = null;
        return;
      }
      hiddenTime = null;
      isRefetching = true;
      if (refetchTimeout) clearTimeout(refetchTimeout);
      refetchTimeout = setTimeout(() => { isRefetching = false; }, 5000);

      const hasMessages = messagesRef.current.length > 0;
      fetchMessagesRef.current(channelIdRef.current, 50, undefined, true, hasMessages)
        .catch(() => {})
        .finally(() => {
          isRefetching = false;
          if (refetchTimeout) { clearTimeout(refetchTimeout); refetchTimeout = null; }
        });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (refetchTimeout) clearTimeout(refetchTimeout);
    };
  }, []); // stable — uses refs

  // Mark as read when viewing channel
  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && !latestMessage.id.startsWith("temp-") && lastMarkedMessageIdRef.current !== latestMessage.id) {
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
        requestAnimationFrame(() => {
          virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER });
        });
      }
    }
    prevMessagesLengthRef.current = currentLength;
  }, [messages.length]);

  // NEW divider index
  const newMessagesDividerIndex = useMemo(() => {
    if (!lastReadAt || !firstUnreadMessageId) return -1;
    const lastReadTime = new Date(lastReadAt).getTime();
    for (let i = 0; i < deduplicatedMessages.length; i++) {
      if (new Date(deduplicatedMessages[i].created_at).getTime() > lastReadTime) return i;
    }
    return -1;
  }, [deduplicatedMessages, lastReadAt, firstUnreadMessageId]);

  // Author style IDs — only non-ghost, non-anonymous
  const missingAuthorStyleIds = useMemo(() => {
    const missing: string[] = [];
    const seen = new Set<string>();
    for (const msg of deduplicatedMessages) {
      const id = msg.user_id;
      if (!id || id === "anonymous" || id.startsWith("ghost_") || seen.has(id) || authorStyleMap[id]) continue;
      seen.add(id);
      missing.push(id);
    }
    return missing;
  }, [deduplicatedMessages, authorStyleMap]);

  useEffect(() => {
    if (!currentServerId || !user?.id || missingAuthorStyleIds.length === 0) return;
    let cancelled = false;

    const fetchAuthorStyles = async () => {
      const batchIds = missingAuthorStyleIds.slice(0, AUTHOR_STYLE_FETCH_CHUNK);
      const { data, error } = await supabase.rpc("get_message_author_styles" as any, {
        _server_id: currentServerId, _user_ids: batchIds, _requesting_user_id: user.id,
      });
      if (error || !data || cancelled) return;
      const rows = parseAuthorStyleRows(data);
      const next: Record<string, MessageAuthorStyle> = {};
      for (const row of rows) {
        if (row.user_id) {
          next[row.user_id] = { user_id: row.user_id, role: row.role ?? null, nickname: row.nickname ?? null, roles: Array.isArray(row.roles) ? row.roles : [] };
        }
      }
      if (!cancelled && Object.keys(next).length > 0) setAuthorStyleMap((prev) => ({ ...prev, ...next }));
    };

    void fetchAuthorStyles().catch(() => {});
    return () => { cancelled = true; };
  }, [currentServerId, user?.id, missingAuthorStyleIds]);

  const scrollToBottom = useCallback(() => {
    const msgs = deduplicatedMessagesRef.current;
    virtuosoRef.current?.scrollToIndex({ index: msgs.length - 1, behavior: "smooth", align: "end" });
    setTimeout(() => { virtuosoRef.current?.scrollTo({ top: Number.MAX_SAFE_INTEGER, behavior: "auto" }); }, 350);
    setShowJumpToPresent(false);
    setNewMessageCount(0);

    const allMsgs = messagesRef.current;
    if (allMsgs.length > 0) {
      const latest = allMsgs[allMsgs.length - 1];
      if (!latest.id.startsWith("temp-") && lastMarkedMessageIdRef.current !== latest.id) {
        markAsRead(channelIdRef.current, latest.id);
        lastMarkedMessageIdRef.current = latest.id;
      }
    }
  }, [markAsRead]);

  // Stable — no dependency on deduplicatedMessages.length
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    isNearBottomRef.current = atBottom;
    if (atBottom) {
      setShowJumpToPresent(false);
      setNewMessageCount(0);
    } else {
      // Only show jump button if we have enough messages
      if (deduplicatedMessagesRef.current.length > 10) setShowJumpToPresent(true);
    }
  }, []);

  const handleStartReached = useCallback(() => {
    if (!hasMore || isLoading || isFetchingOlder) return;
    const msgs = deduplicatedMessagesRef.current;
    const beforeCursor = msgs[0]?.created_at || channelData?.oldestLoadedAt;
    if (beforeCursor) fetchMessagesRef.current(channelIdRef.current, 50, beforeCursor);
  }, [hasMore, isLoading, isFetchingOlder, channelData?.oldestLoadedAt]);

  // Render a single message row — uses refs to avoid depending on deduplicatedMessages array
  const itemContent = useCallback(
    (index: number, message: Message) => {
      if (!message) return null;
      const msgs = deduplicatedMessagesRef.current;
      const previousMessage = index > 0 ? msgs[index - 1] : null;
      const isGrouped = shouldGroupMessages(message, previousMessage);
      const showNewDivider = index === newMessagesDividerIndex && lastMarkedMessageIdRef.current === null;
      const messageDate = new Date(message.created_at);
      const previousMessageDate = previousMessage ? new Date(previousMessage.created_at) : null;
      const showDateDivider = !previousMessageDate || !isSameDay(messageDate, previousMessageDate);

      return (
        <Fragment>
          {showDateDivider && (
            <div className="flex items-center gap-3 px-4 my-4">
              <div className="h-px flex-1 bg-border/70" />
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                {getDateDividerLabel(messageDate)}
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
    [newMessagesDividerIndex, highlightedMessageId, authorStyleMap],
  );

  const computeItemKey = useCallback(
    (_index: number, message: Message) => getStableMessageKey(message),
    [],
  );

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

  const msgCount = deduplicatedMessages.length;

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {isLoading && messages.length === 0 && <MessageListSkeleton />}

      {!isLoading && messages.length === 0 && (
        <div className={`flex flex-col px-4 pt-16 pb-8 ${currentChannel?.ghost_mode ? "items-center text-center" : "items-start"}`}>
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
                Messages in <span className="font-medium text-foreground">#{channelName}</span> are anonymous. Your identity stays hidden from other members.
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
                  <p className="text-muted-foreground">Use <span className="font-medium">#{channelName}</span> to chat while in voice.</p>
                </>
              ) : (
                <>
                  <h2 className="text-3xl font-medium text-foreground mb-2">Welcome to #{channelName}!</h2>
                  <p className="text-muted-foreground mb-4">This is the start of the <span className="font-medium">#{channelName}</span> channel.</p>
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

      {msgCount > 0 && (
        <div ref={containerRef} className="flex-1 min-h-0">
          <Virtuoso
            ref={virtuosoRef}
            data={deduplicatedMessages}
            initialTopMostItemIndex={msgCount - 1}
            followOutput={(isAtBottom) => isAtBottom ? "auto" : false}
            alignToBottom
            atBottomThreshold={150}
            atBottomStateChange={handleAtBottomStateChange}
            startReached={handleStartReached}
            overscan={400}
            increaseViewportBy={{ top: 300, bottom: 150 }}
            computeItemKey={computeItemKey}
            itemContent={itemContent}
            components={{ Header: () => headerContent }}
            style={{ height: '100%' }}
            className="overflow-x-hidden"
          />
        </div>
      )}

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
              className="flex items-center gap-2 px-4 py-2 rounded-full border backdrop-blur-sm transition-colors duration-150"
              style={{
                backgroundColor: "rgba(252, 98, 43, 0.08)",
                borderColor: "rgba(252, 98, 43, 0.35)",
                color: "#fc622b",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(252, 98, 43, 0.15)"; e.currentTarget.style.borderColor = "rgba(252, 98, 43, 0.6)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(252, 98, 43, 0.08)"; e.currentTarget.style.borderColor = "rgba(252, 98, 43, 0.35)"; }}
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
