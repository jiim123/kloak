import { useEffect, useRef, useState, useCallback, useMemo, Fragment, useLayoutEffect } from "react";
import { ViewportList, type ViewportListRef } from "react-viewport-list";

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
import { useRealtimeUserUpdates } from "@/hooks/useRealtimeUserUpdates";
import { useAuthorStyles } from "@/hooks/useAuthorStyles";
import type { Message } from "@/types";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { getGlobalEmojiMap, type ResolvedEmoji } from "@/lib/globalEmojiResolver";
import { isSameDay, isToday, isYesterday, format } from "date-fns";

interface MessageListProps {
  channelId: string;
  channelName: string;
  manageCurrentChannel?: boolean;
}

const CHANNEL_ENTRY_FORCE_REFETCH_MAX_AGE_MS = 12_000;

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
  const rawMessages = useMemo(() => channelData?.messages || [], [channelData?.messages]);

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
  const msgCount = deduplicatedMessages.length;

  useRealtimeUserUpdates(visibleAuthorUserIds, `channel-authors:${channelId}`);

  // Author styles via shared hook (uses the correct _secure RPC)
  const authorStyleMap = useAuthorStyles(currentServerId, visibleAuthorUserIds);

  // Load emoji maps once per message list instead of once per message row.
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

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [currentServerId]);

  useEffect(() => {
    let cancelled = false;
    getGlobalEmojiMap()
      .then((map) => {
        if (!cancelled) setGlobalEmojiMap(map);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [currentServerId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<ViewportListRef>(null);
  const [externalEditTargetId, setExternalEditTargetId] = useState<string | null>(null);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const [globalEmojiMap, setGlobalEmojiMap] = useState<Map<string, ResolvedEmoji>>(new Map());
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const lastMarkedMessageIdRef = useRef<string | null>(null);
  const prevMessagesLengthRef = useRef(0);
  const prevChannelIdRef = useRef<string>(channelId);
  const didInitialBottomScrollRef = useRef(false);
  const pendingPrependAnchorRef = useRef<{
    requestId: number;
    prevTop: number;
    prevHeight: number;
    anchorMessageId: string | null;
    anchorOffset: number | null;
  } | null>(null);
  const prependRequestIdRef = useRef(0);

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
    didInitialBottomScrollRef.current = false;
  }

  // Unread tracking
  const { getChannelUnread, markAsRead } = useUnreadChannelsContext();
  const channelUnread = getChannelUnread(channelId);
  const { lastReadAt, firstUnreadMessageId } = channelUnread;

  // Scroll to message from notification / reply clicks
  const { highlightedMessageId } = useScrollToMessage({
    messages: deduplicatedMessages,
    isLoading,
    virtuosoRef: listRef,
    containerRef,
  });

  // Listen for Up arrow edit event — stable listener, uses ref
  useEffect(() => {
    const handleEditLastMessage = (e: CustomEvent<{ userId: string; channelId: string }>) => {
      if (e.detail.channelId !== channelIdRef.current || !e.detail.userId) return;
      const userMessages = messagesRef.current.filter((m) => m.user_id === e.detail.userId);
      if (userMessages.length > 0) {
        const lastOwnMessage = userMessages[userMessages.length - 1];
        setExternalEditTargetId(lastOwnMessage.id);
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

  // Ref to track whether we're in a "sticky bottom" period after a new message arrives.
  // During this window, any content height changes (emoji replacement, mention resolution,
  // link previews) will automatically re-scroll to the bottom.
  const stickyBottomUntilRef = useRef<number>(0);

  // New message count tracking + bottom nudge
  useEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;
    if (currentLength > prevLength && prevLength > 0) {
      if (!isNearBottomRef.current) {
        setNewMessageCount((prev) => prev + (currentLength - prevLength));
      } else {
        // Mark a sticky-bottom window (500ms) so any subsequent height changes
        // from async DOM updates (fluent emoji, mention resolution, link previews)
        // will keep the scroll pinned to the bottom.
        stickyBottomUntilRef.current = Date.now() + 500;

        const nudge = () => {
          const node = containerRef.current;
          if (!node) return;
          node.scrollTop = node.scrollHeight;
        };
        // Immediate nudge after React commit
        requestAnimationFrame(nudge);
        // Catch fluent emoji replacement (runs at ~50ms delay)
        setTimeout(nudge, 80);
        // Catch mention user resolution & custom emoji async fetches
        setTimeout(nudge, 300);
      }
    }
    prevMessagesLengthRef.current = currentLength;
  }, [messages.length]);

  // ResizeObserver on the scroll container — when content height changes while
  // we're in the sticky-bottom window, re-pin to the bottom. This catches any
  // async DOM mutations (emoji images loading, link preview embeds, etc.)
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      if (Date.now() < stickyBottomUntilRef.current) {
        node.scrollTop = node.scrollHeight;
      }
    });

    // Observe the scroll container's first child (the content wrapper) for size changes
    // because the container itself doesn't resize — its scrollHeight changes.
    // We observe mutations on the container's children instead.
    const mutationObserver = new MutationObserver(() => {
      if (Date.now() < stickyBottomUntilRef.current) {
        node.scrollTop = node.scrollHeight;
      }
    });

    mutationObserver.observe(node, { childList: true, subtree: true, attributes: false });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, [channelId]);

  // NEW divider index
  const newMessagesDividerIndex = useMemo(() => {
    if (!lastReadAt || !firstUnreadMessageId) return -1;
    const lastReadTime = new Date(lastReadAt).getTime();
    for (let i = 0; i < deduplicatedMessages.length; i++) {
      if (new Date(deduplicatedMessages[i].created_at).getTime() > lastReadTime) return i;
    }
    return -1;
  }, [deduplicatedMessages, lastReadAt, firstUnreadMessageId]);


  const scrollToBottom = useCallback(() => {
    const msgs = deduplicatedMessagesRef.current;
    listRef.current?.scrollToIndex({ index: msgs.length - 1, alignToTop: false });
    setTimeout(() => {
      const node = containerRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
    }, 150);
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

  const handleExternalEditHandled = useCallback((messageId: string) => {
    setExternalEditTargetId((current) => (current === messageId ? null : current));
  }, []);

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

  // Debounce ref to prevent startReached from firing on every scroll frame
  const startReachedCooldownRef = useRef(false);

  const handleLoadOlder = useCallback(() => {
    if (!hasMore || isLoading || isFetchingOlder || startReachedCooldownRef.current) return;
    const msgs = deduplicatedMessagesRef.current;
    const beforeCursor = channelData?.oldestLoadedAt || msgs[0]?.created_at;
    if (!beforeCursor) return;

    // Set cooldown to prevent repeated calls while scrolling near top
    startReachedCooldownRef.current = true;
    const scroller = containerRef.current;
    const prevTop = scroller?.scrollTop ?? 0;
    const prevHeight = scroller?.scrollHeight ?? 0;
    let anchorMessageId: string | null = null;
    let anchorOffset: number | null = null;
    if (scroller) {
      const containerTop = scroller.getBoundingClientRect().top;
      for (const msg of msgs) {
        const el = document.getElementById(`message-${msg.id}`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        // First message touching or below the top viewport edge.
        if (rect.bottom >= containerTop + 1) {
          anchorMessageId = msg.id;
          anchorOffset = rect.top - containerTop;
          break;
        }
      }
    }
    const requestId = ++prependRequestIdRef.current;

    pendingPrependAnchorRef.current = {
      requestId,
      prevTop,
      prevHeight,
      anchorMessageId,
      anchorOffset,
    };

    fetchMessagesRef.current(channelIdRef.current, 50, beforeCursor).finally(() => {
      // If no prepend happened (or restore didn't run), clear stale anchor.
      requestAnimationFrame(() => {
        if (pendingPrependAnchorRef.current?.requestId === requestId) {
          pendingPrependAnchorRef.current = null;
        }
      });
      // Small cooldown to avoid accidental double-fire from rapid clicks.
      setTimeout(() => {
        startReachedCooldownRef.current = false;
      }, 220);
    });
  }, [hasMore, isLoading, isFetchingOlder, channelData?.oldestLoadedAt]);

  // Apply prepend anchor restoration before paint to avoid visible jump.
  useLayoutEffect(() => {
    const anchor = pendingPrependAnchorRef.current;
    if (!anchor) return;
    const node = containerRef.current;
    if (!node) return;

    if (anchor.anchorMessageId && anchor.anchorOffset !== null) {
      const anchorEl = document.getElementById(`message-${anchor.anchorMessageId}`);
      if (anchorEl) {
        const containerTop = node.getBoundingClientRect().top;
        const nextOffset = anchorEl.getBoundingClientRect().top - containerTop;
        const offsetDelta = nextOffset - anchor.anchorOffset;
        if (offsetDelta !== 0) node.scrollTop += offsetDelta;
        pendingPrependAnchorRef.current = null;
        return;
      }
    }

    const heightDelta = node.scrollHeight - anchor.prevHeight;
    if (heightDelta !== 0) node.scrollTop = anchor.prevTop + heightDelta;
    pendingPrependAnchorRef.current = null;
  }, [deduplicatedMessages.length, channelId]);

  const handleScroll = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;

    if (node.scrollTop <= 96) {
      handleLoadOlder();
    }

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distanceFromBottom <= 150;

    // During the sticky-bottom window (after a new message arrives), don't flip
    // isNearBottom to false — async DOM changes (emoji replacement, mention
    // resolution) temporarily increase scrollHeight before our nudge catches up.
    if (!atBottom && Date.now() < stickyBottomUntilRef.current) {
      return;
    }

    if (atBottom !== isNearBottomRef.current) {
      handleAtBottomStateChange(atBottom);
    }

  }, [handleLoadOlder, handleAtBottomStateChange]);

  useEffect(() => {
    if (isLoading || msgCount === 0 || didInitialBottomScrollRef.current) return;
    didInitialBottomScrollRef.current = true;
    requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({ index: msgCount - 1, alignToTop: false });
      setTimeout(() => {
        const node = containerRef.current;
        if (!node) return;
        node.scrollTop = node.scrollHeight;
        handleAtBottomStateChange(true);
      }, 120);
    });
  }, [isLoading, msgCount, handleAtBottomStateChange]);

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
            externalEditTargetId={externalEditTargetId}
            onExternalEditHandled={handleExternalEditHandled}
            customEmojiMap={customEmojiMap}
            globalEmojiMap={globalEmojiMap}
          />
        </Fragment>
      );
    },
    [
      newMessagesDividerIndex,
      highlightedMessageId,
      authorStyleMap,
      externalEditTargetId,
      handleExternalEditHandled,
      customEmojiMap,
      globalEmojiMap,
    ],
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
        <div
          ref={containerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative"
          style={{ overflowAnchor: "none" }}
          onScroll={handleScroll}
        >
          {headerContent}
          {isFetchingOlder && (
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20">
              <div className="rounded-full border border-border/70 bg-background/90 p-1.5 shadow-sm backdrop-blur-sm">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
          <ViewportList
            key={channelId}
            ref={listRef}
            viewportRef={containerRef}
            items={deduplicatedMessages}
            overscan={8}
            overflowAnchor="none"
          >
            {(message, index) => (
              <Fragment key={computeItemKey(index, message)}>
                {itemContent(index, message)}
              </Fragment>
            )}
          </ViewportList>
        </div>
      )}

      <JumpToPresent
        visible={showJumpToPresent}
        newMessageCount={newMessageCount}
        onClick={scrollToBottom}
      />
    </div>
  );
};
