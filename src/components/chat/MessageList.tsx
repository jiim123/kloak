import { useEffect, useRef, useState, useCallback, useMemo, Fragment, useLayoutEffect } from "react";

import { Ghost } from "lucide-react";
import { Loader2, Hash, Sparkles } from "lucide-react";

import { MessageItem } from "./MessageItem";
import { JumpToPresent } from "./JumpToPresent";
import { MessageListSkeleton } from "@/components/ui/skeletons";
import { useMessageStore } from "@/stores/messageStore";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useServerStore } from "@/stores/serverStore";
import { useUnreadChannelsContext } from "@/hooks/useUnreadChannelsContext";
import { useScrollToMessage } from "@/hooks/useScrollToMessage";
import { useRealtimePolls } from "@/hooks/useRealtimePolls";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";

import { useAuthorStyles } from "@/hooks/useAuthorStyles";
import { MessageMapsProvider } from "./MessageMapsContext";
import type { Message } from "@/types";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { getGlobalEmojiMap, type ResolvedEmoji } from "@/lib/globalEmojiResolver";
import { isSameDay, isToday, isYesterday, format } from "date-fns";

interface MessageListProps {
  channelId: string;
  channelName: string;
  manageCurrentChannel?: boolean;
}

const CHANNEL_ENTRY_FORCE_REFETCH_MAX_AGE_MS = 5 * 60_000;

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
  const rawMessages = useMemo(() => channelData?.messages || [], [channelData?.messages]);

  const messages = useMemo(() => {
    if (!visibilityBlockedUserIds || visibilityBlockedUserIds.length === 0) return rawMessages;
    const blocked = new Set(visibilityBlockedUserIds);
    return rawMessages.filter((m) => !blocked.has(m.user_id));
  }, [rawMessages, visibilityBlockedUserIds]);

  const hasMore = channelData?.hasMore ?? true;

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
    if (seen.size === messages.length) return messages;
    return messages.filter((m) => seen.get(getStableMessageKey(m)) === m);
  }, [messages]);

  type ListItem =
    | { type: "message"; message: Message }
    | { type: "dateDivider"; label: string; date: Date };

  const flatItems = useMemo(() => {
    const items: ListItem[] = [];
    for (let i = 0; i < deduplicatedMessages.length; i++) {
      const msg = deduplicatedMessages[i];
      const msgDate = new Date(msg.created_at);
      const prevMsg = i > 0 ? deduplicatedMessages[i - 1] : null;
      const prevDate = prevMsg ? new Date(prevMsg.created_at) : null;
      if (!prevDate || !isSameDay(msgDate, prevDate)) {
        items.push({
          type: "dateDivider",
          label: getDateDividerLabel(msgDate),
          date: msgDate,
        });
      }
      items.push({ type: "message", message: msg });
    }
    return items;
  }, [deduplicatedMessages]);

  const visibleAuthorUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const msg of deduplicatedMessages) {
      if (msg.user_id) ids.add(msg.user_id);
    }
    return Array.from(ids);
  }, [deduplicatedMessages]);
  const msgCount = deduplicatedMessages.length;

  
  const authorStyleMap = useAuthorStyles(currentServerId, visibleAuthorUserIds);

  useEffect(() => {
    if (!currentServerId) {
      setCustomEmojiMap(new Map());
      return;
    }
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const load = async (attempt: number) => {
      try {
        const emojis = await fetchServerEmojis(currentServerId, { force: attempt > 0 });
        if (cancelled) return;
        const next = new Map<string, string>();
        emojis.forEach((e) => next.set(e.name, e.url));
        setCustomEmojiMap(next);
      } catch {
        if (cancelled) return;
        setCustomEmojiMap(new Map());
        if (attempt < 2) {
          retryTimer = setTimeout(() => load(attempt + 1), 700 * Math.pow(2, attempt));
        }
      }
    };
    load(0);
    return () => { cancelled = true; if (retryTimer) clearTimeout(retryTimer); };
  }, [currentServerId]);

  useEffect(() => {
    let cancelled = false;
    getGlobalEmojiMap().then((map) => { if (!cancelled) setGlobalEmojiMap(map); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [currentServerId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [_unused, _setUnused] = useState<string | null>(null); // kept for stable hook order
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [globalEmojiMap, setGlobalEmojiMap] = useState<Map<string, ResolvedEmoji>>(new Map());
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const showJumpToPresentRef = useRef(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const prevMessagesLengthRef = useRef(0);
  const prevChannelIdRef = useRef<string>(channelId);
  const didInitialBottomScrollRef = useRef(false);
  const lastScrollHeightRef = useRef(0);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;
  const deduplicatedMessagesRef = useRef(deduplicatedMessages);
  deduplicatedMessagesRef.current = deduplicatedMessages;

  // Stable last-message-id for detecting genuinely new messages
  const lastMessageId = useMemo(() => {
    if (messages.length === 0) return null;
    return messages[messages.length - 1].id;
  }, [messages]);
  const lastNudgedMessageIdRef = useRef<string | null>(null);

  if (prevChannelIdRef.current !== channelId) {
    prevChannelIdRef.current = channelId;
    didInitialBottomScrollRef.current = false;
  }

  const { getChannelUnread, markAsRead } = useUnreadChannelsContext();
  const channelUnread = getChannelUnread(channelId);
  const { lastReadAt, firstUnreadMessageId } = channelUnread;

  const { highlightedMessageId } = useScrollToMessage({
    messages: deduplicatedMessages,
    isLoading,
    containerRef,
  });

  useEffect(() => {
    const handleEditLastMessage = (e: CustomEvent<{ userId: string; channelId: string }>) => {
      if (e.detail.channelId !== channelIdRef.current || !e.detail.userId) return;
      const userMessages = messagesRef.current.filter((m) => m.user_id === e.detail.userId);
      if (userMessages.length > 0) {
        const msg = userMessages[userMessages.length - 1];
        import("@/stores/editStore").then(({ useEditStore }) => {
          useEditStore.getState().startEditing({
            id: msg.id,
            channelId: msg.channel_id,
            content: msg.content,
            isDM: false,
          });
        });
      }
    };
    const listener = handleEditLastMessage as unknown as EventListener;
    window.addEventListener("editLastMessage", listener);
    return () => window.removeEventListener("editLastMessage", listener);
  }, []);

  useEffect(() => {
    if (manageCurrentChannel) setCurrentChannel(channelId);
    prevMessagesLengthRef.current = 0;
    lastNudgedMessageIdRef.current = null;
    lastMarkedMessageIdRef.current = null;
    setShowJumpToPresent(false);
    showJumpToPresentRef.current = false;
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

  useEffect(() => {
    if (isRealtimeConnected) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchMessagesRef.current(channelIdRef.current, 50, undefined, true, true);
    }, 30000);
    return () => clearInterval(interval);
  }, [isRealtimeConnected]);

  useEffect(() => {
    const MIN_HIDDEN_MS = 15_000;
    let hiddenTime: number | null = null;
    let isRefetching = false;
    let refetchTimeout: ReturnType<typeof setTimeout> | null = null;
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") { hiddenTime = Date.now(); return; }
      if (isRefetching) return;
      if (hiddenTime && Date.now() - hiddenTime < MIN_HIDDEN_MS) { hiddenTime = null; return; }
      hiddenTime = null;
      isRefetching = true;
      if (refetchTimeout) clearTimeout(refetchTimeout);
      refetchTimeout = setTimeout(() => { isRefetching = false; }, 5000);
      const hasMessages = messagesRef.current.length > 0;
      fetchMessagesRef.current(channelIdRef.current, 50, undefined, true, hasMessages)
        .catch(() => {})
        .finally(() => { isRefetching = false; if (refetchTimeout) { clearTimeout(refetchTimeout); refetchTimeout = null; } });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => { document.removeEventListener("visibilitychange", handleVisibility); if (refetchTimeout) clearTimeout(refetchTimeout); };
  }, []);

  useEffect(() => {
    if (messages.length > 0 && isNearBottomRef.current) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && !latestMessage.id.startsWith("temp-") && lastMarkedMessageIdRef.current !== latestMessage.id) {
        markAsRead(channelId, latestMessage.id);
        lastMarkedMessageIdRef.current = latestMessage.id;
      }
    }
  }, [messages, channelId, markAsRead]);

  // New message nudge — tracks lastMessageId for reliable detection
  useLayoutEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;
    const currentLastId = lastMessageId;
    const prevLastId = lastNudgedMessageIdRef.current;

    // Detect genuinely new message: either length increased or last ID changed
    const hasNewMessage =
      (currentLength > prevLength && prevLength > 0) ||
      (currentLastId !== null && prevLastId !== null && currentLastId !== prevLastId && prevLength > 0);

    if (hasNewMessage) {
      const node = containerRef.current;
      const actualDistanceFromBottom = node
        ? node.scrollHeight - node.scrollTop - node.clientHeight
        : 0;
      const effectivelyAtBottom = isNearBottomRef.current || actualDistanceFromBottom <= 150;

      if (!effectivelyAtBottom) {
        const added = Math.max(1, currentLength - prevLength);
        setNewMessageCount((prev) => prev + added);
      } else {
        // Single immediate scroll — ResizeObserver handles subsequent size changes
        const n = containerRef.current;
        if (n) {
          n.scrollTop = n.scrollHeight;
          isNearBottomRef.current = true;
          lastScrollHeightRef.current = n.scrollHeight;
        }
      }
    }

    prevMessagesLengthRef.current = currentLength;
    if (currentLastId) lastNudgedMessageIdRef.current = currentLastId;
  }, [lastMessageId, messages.length]);

  // Safety-net removed: it was forcing users back to bottom on small scrolls

  const newMessagesDividerIndex = useMemo(() => {
    if (!lastReadAt || !firstUnreadMessageId) return -1;
    const lastReadTime = new Date(lastReadAt).getTime();
    for (let i = 0; i < deduplicatedMessages.length; i++) {
      if (new Date(deduplicatedMessages[i].created_at).getTime() > lastReadTime) return i;
    }
    return -1;
  }, [deduplicatedMessages, lastReadAt, firstUnreadMessageId]);

  const scrollToBottom = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;

    node.scrollTop = node.scrollHeight;
    lastScrollHeightRef.current = node.scrollHeight;
    isNearBottomRef.current = true;

    setShowJumpToPresent(false);
    showJumpToPresentRef.current = false;
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

  useEffect(() => {
    const handleChannelMessageSent = (e: CustomEvent<{ channelId: string }>) => {
      if (e.detail.channelId !== channelIdRef.current) return;
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    };
    const listener = handleChannelMessageSent as unknown as EventListener;
    window.addEventListener("channelMessageSent", listener);
    return () => window.removeEventListener("channelMessageSent", listener);
  }, [scrollToBottom]);

  const handleExternalEditHandled = useCallback((_messageId: string) => {
    // No-op — editing now handled by editStore
  }, []);

  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    if (atBottom) {
      setShowJumpToPresent(false);
      showJumpToPresentRef.current = false;
      setNewMessageCount(0);
    }
  }, []);

  const startReachedCooldownRef = useRef(false);

  const handleLoadOlder = useCallback(() => {
    if (!hasMore || isLoading || isFetchingOlder || startReachedCooldownRef.current) return;
    const msgs = deduplicatedMessagesRef.current;
    const beforeCursor = channelData?.oldestLoadedAt || msgs[0]?.created_at;
    if (!beforeCursor) return;

    startReachedCooldownRef.current = true;

    fetchMessagesRef.current(channelIdRef.current, 50, beforeCursor)
      .finally(() => {
        setTimeout(() => { startReachedCooldownRef.current = false; }, 220);
      });
  }, [hasMore, isLoading, isFetchingOlder, channelData?.oldestLoadedAt]);


  const handleScroll = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distanceFromBottom <= 100;
    const wasAtBottom = isNearBottomRef.current;

    // ALWAYS sync the ref so it never gets stuck
    isNearBottomRef.current = atBottom;

    // Track scroll height for ResizeObserver
    lastScrollHeightRef.current = node.scrollHeight;

    // Load older — only when genuinely near top
    if (node.scrollTop <= 96 && !atBottom && distanceFromBottom > 300) {
      handleLoadOlder();
    }

    // State transitions only
    if (atBottom && !wasAtBottom) {
      handleAtBottomStateChange(true);
    } else if (!atBottom && !wasAtBottom && distanceFromBottom >= 600) {
      if (!showJumpToPresentRef.current && deduplicatedMessagesRef.current.length > 10) {
        setShowJumpToPresent(true);
        showJumpToPresentRef.current = true;
      }
    }
  }, [handleLoadOlder, handleAtBottomStateChange]);

  // Initial bottom scroll
  useEffect(() => {
    if (isLoading || msgCount === 0 || didInitialBottomScrollRef.current) return;
    didInitialBottomScrollRef.current = true;

    const scrollDown = () => {
      const node = containerRef.current;
      if (node) {
        node.scrollTop = node.scrollHeight;
        lastScrollHeightRef.current = node.scrollHeight;
        isNearBottomRef.current = true;
      }
    };

    scrollDown();
    // Single retry after a frame for late-rendering content
    requestAnimationFrame(scrollDown);
  }, [isLoading, msgCount]);

  // ResizeObserver + MutationObserver — dual safety net for auto-scroll
  const messagesWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    lastScrollHeightRef.current = node.scrollHeight;

    const autoScrollIfNeeded = () => {
      const n = containerRef.current;
      if (!n || !isNearBottomRef.current) return;
      const newHeight = n.scrollHeight;
      const oldHeight = lastScrollHeightRef.current;
      if (newHeight > oldHeight) {
        n.scrollTop = n.scrollHeight;
        isNearBottomRef.current = true;
      }
      lastScrollHeightRef.current = newHeight;
    };

    // ResizeObserver: catches element size changes (images loading, embeds expanding)
    const resizeObserver = new ResizeObserver(autoScrollIfNeeded);

    // MutationObserver: catches new DOM nodes being added (new messages rendered)
    const mutationObserver = new MutationObserver(autoScrollIfNeeded);

    const wrapper = messagesWrapperRef.current;
    if (wrapper) {
      resizeObserver.observe(wrapper);
      mutationObserver.observe(wrapper, { childList: true, subtree: true });
    }

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [channelId, msgCount > 0]); // re-attach when channel changes or first messages arrive

  const authorStyleMapRef = useRef(authorStyleMap);
  authorStyleMapRef.current = authorStyleMap;
  const customEmojiMapRef = useRef(customEmojiMap);
  customEmojiMapRef.current = customEmojiMap;
  const globalEmojiMapRef = useRef(globalEmojiMap);
  globalEmojiMapRef.current = globalEmojiMap;
  const highlightedMessageIdRef = useRef(highlightedMessageId);
  highlightedMessageIdRef.current = highlightedMessageId;
  // externalEditTargetId removed — editing handled by editStore

  const itemContent = useCallback(
    (item: ListItem, index: number) => {
      if (item.type === "dateDivider") {
        return (
          <div
            key={`date-divider-${item.date.toISOString().slice(0, 10)}`}
            className="flex items-center gap-3 px-6 my-4"
            style={{ overflowAnchor: "none" }}
          >
            <div className="h-px flex-1 bg-border/70" />
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              {item.label}
            </span>
            <div className="h-px flex-1 bg-border/70" />
          </div>
        );
      }

      const message = item.message;
      // Find previous message in deduplicatedMessages for grouping
      const msgs = deduplicatedMessagesRef.current;
      const msgIdx = msgs.indexOf(message);
      const previousMessage = msgIdx > 0 ? msgs[msgIdx - 1] : null;
      const isGrouped = shouldGroupMessages(message, previousMessage);
      const showNewDivider = msgIdx === newMessagesDividerIndex && lastMarkedMessageIdRef.current === null;

      return (
        <MessageItem
          key={message.id}
          message={message}
          isGrouped={isGrouped}
          showNewDivider={showNewDivider}
          isHighlighted={message.id === highlightedMessageIdRef.current}
          authorStyleFallback={authorStyleMapRef.current[message.user_id]}
          customEmojiMap={customEmojiMapRef.current}
          globalEmojiMap={globalEmojiMapRef.current}
        />
      );
    },
    [newMessagesDividerIndex, handleExternalEditHandled],
  );

  const computeItemKey = useCallback(
    (item: ListItem, index: number) => {
      if (!item) return `item-${index}`;
      if (item.type === "dateDivider") return `date-divider-${item.date.toISOString().slice(0, 10)}`;
      return getStableMessageKey(item.message);
    },
    [],
  );

  const headerContent = useMemo(() => {
    if (isLoading && messages.length > 0) {
      return (
        <div className="flex justify-center py-4" style={{ overflowAnchor: "none" }}>
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      );
    }
    return null;
  }, [isLoading, messages.length]);

  return (
    <MessageMapsProvider>
    <div className="flex-1 flex flex-col min-h-0 relative">
      {isLoading && messages.length === 0 && <MessageListSkeleton />}

      {!isLoading && messages.length === 0 && (
        <div className={`flex flex-col px-6 pt-16 pb-8 ${currentChannel?.ghost_mode ? "items-center text-center" : "items-start"}`}>
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
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative bg-transparent"
          onScroll={handleScroll}
          style={{ overflowAnchor: 'auto' }}
        >
          <div style={{ overflowAnchor: "none" }}>{headerContent}</div>
          {isFetchingOlder && (
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20" style={{ overflowAnchor: "none" }}>
              <div className="rounded-full border border-border/70 bg-background/90 p-1.5 shadow-sm backdrop-blur-sm">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <div key={channelId} ref={messagesWrapperRef} data-messages-container>
            {flatItems.map((item, index) => (
              <Fragment key={computeItemKey(item, index)}>
                {itemContent(item, index)}
              </Fragment>
            ))}
          </div>
        </div>
      )}

      <JumpToPresent
        visible={showJumpToPresent}
        newMessageCount={newMessageCount}
        onClick={scrollToBottom}
      />
    </div>
    </MessageMapsProvider>
  );
};
