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

  // FIX 3: Flat array of messages + date dividers for ViewportList
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

  useRealtimeUserUpdates(visibleAuthorUserIds, `channel-authors:${channelId}`);
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
  const [prependComplete, setPrependComplete] = useState(0);
  // Guard: prevents handleLoadOlder from firing during programmatic scroll-to-bottom
  const isProgrammaticScrollRef = useRef(false);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;
  const deduplicatedMessagesRef = useRef(deduplicatedMessages);
  deduplicatedMessagesRef.current = deduplicatedMessages;

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
    virtuosoRef: listRef,
    containerRef,
  });

  useEffect(() => {
    const handleEditLastMessage = (e: CustomEvent<{ userId: string; channelId: string }>) => {
      if (e.detail.channelId !== channelIdRef.current || !e.detail.userId) return;
      const userMessages = messagesRef.current.filter((m) => m.user_id === e.detail.userId);
      if (userMessages.length > 0) setExternalEditTargetId(userMessages[userMessages.length - 1].id);
    };
    const listener = handleEditLastMessage as unknown as EventListener;
    window.addEventListener("editLastMessage", listener);
    return () => window.removeEventListener("editLastMessage", listener);
  }, []);

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

  // FIX 4: New message nudge with isNearBottom guard at execution time
  useEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;
    if (currentLength > prevLength && prevLength > 0) {
      if (!isNearBottomRef.current) {
        setNewMessageCount((prev) => prev + (currentLength - prevLength));
      } else {
        const nudge = () => {
          const node = containerRef.current;
          if (node && isNearBottomRef.current) {
            node.scrollTop = node.scrollHeight;
          }
        };
        requestAnimationFrame(nudge);
        setTimeout(nudge, 200);
      }
    }
    prevMessagesLengthRef.current = currentLength;
  }, [messages.length]);

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

    isProgrammaticScrollRef.current = true;
    node.scrollTop = node.scrollHeight;

    // Single delayed confirmation after ViewportList settles
    setTimeout(() => {
      if (node) node.scrollTop = node.scrollHeight;
      isProgrammaticScrollRef.current = false;
    }, 100);

    setShowJumpToPresent(false);
    setNewMessageCount(0);
    isNearBottomRef.current = true;

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

  const handleAtBottomStateChange = useCallback((atBottom: boolean, distanceFromBottom?: number) => {
    isNearBottomRef.current = atBottom;
    if (atBottom) {
      setShowJumpToPresent(false);
      setNewMessageCount(0);
    }
    if (!atBottom && (distanceFromBottom ?? 0) >= 600 && deduplicatedMessagesRef.current.length > 10) {
      setShowJumpToPresent(true);
    }
  }, []);

  const startReachedCooldownRef = useRef(false);

  const handleLoadOlder = useCallback(() => {
    if (!hasMore || isLoading || isFetchingOlder || startReachedCooldownRef.current) return;
    const msgs = deduplicatedMessagesRef.current;
    const beforeCursor = channelData?.oldestLoadedAt || msgs[0]?.created_at;
    if (!beforeCursor) return;

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
        if (rect.bottom >= containerTop + 1) {
          anchorMessageId = msg.id;
          anchorOffset = rect.top - containerTop;
          break;
        }
      }
    }
    const requestId = ++prependRequestIdRef.current;

    pendingPrependAnchorRef.current = { requestId, prevTop, prevHeight, anchorMessageId, anchorOffset };

    fetchMessagesRef.current(channelIdRef.current, 50, beforeCursor).then(() => {
      setPrependComplete((prev) => prev + 1);
    }).finally(() => {
      setTimeout(() => { startReachedCooldownRef.current = false; }, 220);
    });
  }, [hasMore, isLoading, isFetchingOlder, channelData?.oldestLoadedAt]);

  // Prepend anchor restoration — ONLY fires on actual prepend completion
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
  }, [prependComplete]);

  // Scroll handler — uses React onScroll (synchronous, no rAF cascading).
  // Only updates refs during scroll; state updates are on transitions only.
  const handleScroll = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;

    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const atBottom = distanceFromBottom <= 150;

    // Load older — only when genuinely near top and not during programmatic scroll
    if (node.scrollTop <= 96 && !isProgrammaticScrollRef.current && !atBottom && distanceFromBottom > 300) {
      handleLoadOlder();
    }

    // Only call handleAtBottomStateChange on actual transitions to avoid
    // unnecessary state updates (re-renders) during continuous scrolling.
    const wasAtBottom = isNearBottomRef.current;
    if (atBottom && !wasAtBottom) {
      // Transition: scrolled TO bottom
      handleAtBottomStateChange(true, distanceFromBottom);
    } else if (!atBottom && wasAtBottom) {
      // Transition: scrolled AWAY from bottom — just update the ref, defer jump button
      isNearBottomRef.current = false;
    } else if (!atBottom && !wasAtBottom && distanceFromBottom >= 600) {
      // Already scrolled up, check if we should show jump button
      // Use ref check to avoid calling setState if already showing
      if (!showJumpToPresent && deduplicatedMessagesRef.current.length > 10) {
        setShowJumpToPresent(true);
      }
    }
  }, [handleLoadOlder, handleAtBottomStateChange, showJumpToPresent]);

  // FIX 4: Initial bottom scroll with null guards
  useEffect(() => {
    if (isLoading || msgCount === 0 || didInitialBottomScrollRef.current) return;
    didInitialBottomScrollRef.current = true;
    isProgrammaticScrollRef.current = true;
    requestAnimationFrame(() => {
      const node = containerRef.current;
      if (!node) return;
      node.scrollTop = node.scrollHeight;
      setTimeout(() => {
        const n = containerRef.current;
        if (!n) return;
        n.scrollTop = n.scrollHeight;
        isNearBottomRef.current = true;
        isProgrammaticScrollRef.current = false;
      }, 100);
    });
  }, [isLoading, msgCount]);

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
