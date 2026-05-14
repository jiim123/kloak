import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect, memo } from "react";

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
import {
  afterNextPaint,
  beginChatPerf,
  endChannelNavigationPerf,
  endChatPerf,
  markChannelNavigationPerf,
  markChatPerf,
} from "@/lib/chatPerf";
import { isSameDay, isToday, isYesterday, format } from "date-fns";

interface MessageListProps {
  channelId: string;
  channelName: string;
  manageCurrentChannel?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS (module-scope — zero per-render allocation)
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_ENTRY_FORCE_REFETCH_MAX_AGE_MS = 5 * 60_000;
const INITIAL_CHANNEL_LOAD_LIMIT = 35;
const BACKGROUND_HISTORY_PREFETCH_DELAY_MS = 350;
const BACKGROUND_HISTORY_PREFETCH_LIMIT = 50;
const LOAD_OLDER_TOP_THRESHOLD_MIN_PX = 56;
const LOAD_OLDER_TOP_THRESHOLD_MAX_PX = 220;
const LOAD_OLDER_TOP_THRESHOLD_VIEWPORT_RATIO = 0.22;
const LOAD_OLDER_BOTTOM_DISTANCE_GUARD_PX = 300;
const LOAD_OLDER_REARM_DISTANCE_PX = 180;
const LOAD_OLDER_COOLDOWN_MS = 550;

const EMPTY_MESSAGE_ARRAY: Message[] = [];
const EMPTY_CUSTOM_EMOJI_MAP = new Map<string, string>();
const EMPTY_GLOBAL_EMOJI_MAP = new Map<string, ResolvedEmoji>();

const OVERFLOW_ANCHOR_NONE = { overflowAnchor: "none" as const };

// CRITICAL — content-visibility: auto for off-screen messages.
// This tells the browser to skip layout, style, and paint work for messages
// that aren't currently in the viewport, while still keeping them in the DOM
// (so Ctrl+F, screen readers, scrollIntoView, and direct anchor links all work).
//
// The contain-intrinsic-size: "auto 80px" means:
//   - "80px" is the fallback height the browser uses before measuring
//   - "auto" keyword tells the browser to remember the ACTUAL measured size
//     after first render, so subsequent scroll passes reserve accurate space
//     and scroll jumps are eliminated.
//
// overflowAnchor: none prevents Chrome's scroll anchoring from fighting with
// the content-visibility transitions when rows enter/leave the viewport.
const MESSAGE_ROW_STYLE: React.CSSProperties = {
  containIntrinsicSize: "auto 80px",
  overflowAnchor: "none",
};

const estimateAttachmentRenderHeight = (attachment: Message["attachments"][number]): number => {
  if (!attachment.file_type?.startsWith("image/")) return 0;
  if (!attachment.width || !attachment.height) return 200;

  const maxW = 400;
  const maxH = 300;
  let w = attachment.width;
  let h = attachment.height;

  if (w > maxW) {
    h = Math.round(h * (maxW / w));
    w = maxW;
  }

  if (h > maxH) {
    h = maxH;
  }

  return h;
};

const getMessageRowStyle = (message: Message, isGrouped: boolean): React.CSSProperties => {
  const imageHeight = Math.max(0, ...(message.attachments ?? []).map(estimateAttachmentRenderHeight));
  if (imageHeight <= 0) return MESSAGE_ROW_STYLE;

  const rowChromeHeight = isGrouped ? 24 : 64;
  return {
    ...MESSAGE_ROW_STYLE,
    containIntrinsicSize: `auto ${imageHeight + rowChromeHeight}px`,
  };
};

// Date dividers stay fully rendered — useScrollToMessage uses them as landmarks
// and they're cheap (just text + lines).
const DATE_DIVIDER_STYLE: React.CSSProperties = { overflowAnchor: "none" };

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES (pure functions — stable references)
// ─────────────────────────────────────────────────────────────────────────────

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

const getLoadOlderTopThreshold = (clientHeight: number): number => {
  const scaledThreshold = Math.round(clientHeight * LOAD_OLDER_TOP_THRESHOLD_VIEWPORT_RATIO);
  return Math.min(
    LOAD_OLDER_TOP_THRESHOLD_MAX_PX,
    Math.max(LOAD_OLDER_TOP_THRESHOLD_MIN_PX, scaledThreshold),
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ListItem =
  | { type: "message"; message: Message; previousMessage: Message | null; isNewMessagesDivider: boolean }
  | { type: "dateDivider"; label: string; date: Date };

type PendingScrollAnchor = {
  messageId: string;
  topOffset: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (memoized, module-scope)
// ─────────────────────────────────────────────────────────────────────────────

const DateDivider = memo(({ label }: { label: string }) => (
  <div className="flex items-center gap-3 px-6 my-4" style={DATE_DIVIDER_STYLE}>
    <div className="h-px flex-1 bg-border/70" />
    <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{label}</span>
    <div className="h-px flex-1 bg-border/70" />
  </div>
));
DateDivider.displayName = "DateDivider";

const GhostChannelEmpty = memo(({ channelName }: { channelName: string }) => (
  <div className="flex flex-col px-6 pt-16 pb-8 items-center text-center">
    <div className="relative mb-6">
      <div className="absolute inset-0 rounded-full bg-muted/30 blur-xl scale-150" />
      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-muted/80 to-muted/40 border border-border/50 flex items-center justify-center">
        <Ghost className="w-12 h-12 text-muted-foreground" />
      </div>
    </div>
    <h2 className="text-2xl font-medium text-foreground mb-3">Anonymous Channel</h2>
    <p className="text-muted-foreground max-w-sm leading-relaxed">
      Messages in <span className="font-medium text-foreground">#{channelName}</span> are anonymous. Your identity stays
      hidden from other members.
    </p>
  </div>
));
GhostChannelEmpty.displayName = "GhostChannelEmpty";

const RegularChannelEmpty = memo(
  ({ channelName, isVoiceAttached }: { channelName: string; isVoiceAttached: boolean }) => (
    <div className="flex flex-col px-6 pt-16 pb-8 items-start">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <Hash className="w-10 h-10 text-primary" />
      </div>
      {isVoiceAttached ? (
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
    </div>
  ),
);
RegularChannelEmpty.displayName = "RegularChannelEmpty";

const LoadingOlderIndicator = memo(() => (
  <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-20" style={OVERFLOW_ANCHOR_NONE}>
    <div className="rounded-full border border-border/70 bg-background/90 p-1.5 shadow-sm backdrop-blur-sm">
      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
    </div>
  </div>
));
LoadingOlderIndicator.displayName = "LoadingOlderIndicator";

const HeaderLoader = memo(() => (
  <div className="flex justify-center py-4" style={OVERFLOW_ANCHOR_NONE}>
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
  </div>
));
HeaderLoader.displayName = "HeaderLoader";

// Row wrapper: applies content-visibility to skip off-screen render work.
// We wrap MessageItem in a div with content-visibility: auto so the browser
// skips layout/paint for off-screen messages. Date dividers render normally.
interface RowProps {
  item: ListItem;
  authorStyle: any;
  replyAuthorStyle: any;
  customEmojiMap: Map<string, string>;
  globalEmojiMap: Map<string, ResolvedEmoji>;
  highlightedMessageId: string | null;
}
const areRowPropsEqual = (prev: RowProps, next: RowProps) => {
  if (prev.item.type !== next.item.type) return false;

  if (prev.item.type === "dateDivider" && next.item.type === "dateDivider") {
    return prev.item.label === next.item.label;
  }

  if (prev.item.type !== "message" || next.item.type !== "message") return false;

  const prevMessage = prev.item.message;
  const nextMessage = next.item.message;
  const prevWasHighlighted = prevMessage.id === prev.highlightedMessageId;
  const nextWasHighlighted = nextMessage.id === next.highlightedMessageId;

  return (
    prevMessage === nextMessage &&
    prev.item.previousMessage === next.item.previousMessage &&
    prev.item.isNewMessagesDivider === next.item.isNewMessagesDivider &&
    prev.authorStyle === next.authorStyle &&
    prev.replyAuthorStyle === next.replyAuthorStyle &&
    prev.customEmojiMap === next.customEmojiMap &&
    prev.globalEmojiMap === next.globalEmojiMap &&
    prevWasHighlighted === nextWasHighlighted
  );
};

const Row = memo(({ item, authorStyle, replyAuthorStyle, customEmojiMap, globalEmojiMap, highlightedMessageId }: RowProps) => {
  if (item.type === "dateDivider") {
    return <DateDivider label={item.label} />;
  }
  const { message, previousMessage, isNewMessagesDivider } = item;
  const isGrouped = shouldGroupMessages(message, previousMessage);

  return (
    <div data-message-row data-message-id={message.id} style={getMessageRowStyle(message, isGrouped)}>
      <MessageItem
        message={message}
        isGrouped={isGrouped}
        showNewDivider={isNewMessagesDivider}
        isHighlighted={message.id === highlightedMessageId}
        authorStyleFallback={authorStyle}
        replyAuthorStyleFallback={replyAuthorStyle}
        customEmojiMap={customEmojiMap}
        globalEmojiMap={globalEmojiMap}
      />
    </div>
  );
}, areRowPropsEqual);
Row.displayName = "Row";

type DerivedMessageView = {
  messages: Message[];
  deduplicatedMessages: Message[];
  flatItems: ListItem[];
  visibleAuthorUserIds: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const MessageList = ({ channelId, channelName, manageCurrentChannel = true }: MessageListProps) => {
  // Individual selectors — prevents re-renders on unrelated store changes
  const user = useAuthStore((s) => s.user);

  const isLoading = useMessageStore((s) => s.isLoading);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const prefetchOlderMessages = useMessageStore((s) => s.prefetchOlderMessages);
  const setCurrentChannel = useMessageStore((s) => s.setCurrentChannel);
  const channelData = useMessageStore((s) => s.messagesByChannel[channelId]);
  const isFetchingOlder = useMessageStore((s) => !!s.fetchingChannels[channelId]);

  const { isRealtimeConnected } = useConnectionStatus();
  const visibilityBlockedUserIds = useFriendStore((s) => s.visibilityBlockedUserIds);
  const currentChannel = useServerStore((s) => s.currentChannel);

  // Narrow selector — returns only the boolean, not the whole channels array
  const isVoiceAttachedTextChannel = useServerStore(
    useCallback((s) => !!s.channels.find((c) => c.id === channelId)?.linked_voice_channel_id, [channelId]),
  );

  const currentServerId = useServerStore((s) => s.currentChannel?.server_id ?? s.currentServer?.id ?? null);

  useRealtimePolls(channelId);

  const { getChannelUnread, markAsRead } = useUnreadChannelsContext();
  const channelUnread = getChannelUnread(channelId);
  const { lastReadAt, firstUnreadMessageId } = channelUnread;

  // Stable empty-array reference prevents downstream memo churn
  const rawMessages = channelData?.messages ?? EMPTY_MESSAGE_ARRAY;
  const lastMarkedMessageIdRef = useRef<string | null>(null);

  // Stable reference for visibleAuthorUserIds — prevents useAuthorStyles re-fetch
  // when author set is unchanged (e.g. on presence updates that don't add new authors).
  const visibleAuthorUserIdsRef = useRef<string[]>([]);

  const derivedView = useMemo<DerivedMessageView>(() => {
    const blockedSet =
      visibilityBlockedUserIds && visibilityBlockedUserIds.length > 0 ? new Set(visibilityBlockedUserIds) : null;
    const filteredMessages = blockedSet ? rawMessages.filter((m) => !blockedSet.has(m.user_id)) : rawMessages;

    const seen = new Map<string, Message>();
    for (const msg of filteredMessages) {
      const stableKey = getStableMessageKey(msg);
      const existing = seen.get(stableKey);
      if (!existing) {
        seen.set(stableKey, msg);
      } else if (!msg.id.startsWith("temp-") && existing.id.startsWith("temp-")) {
        seen.set(stableKey, msg);
      }
    }

    const deduplicatedMessages =
      seen.size === filteredMessages.length
        ? filteredMessages
        : filteredMessages.filter((m) => seen.get(getStableMessageKey(m)) === m);

    const items: ListItem[] = [];
    const authorIds = new Set<string>();
    const hasInitialUnread = lastMarkedMessageIdRef.current === null;
    const lastReadTime = lastReadAt ? new Date(lastReadAt).getTime() : null;
    let newMessagesDividerIndex = -1;

    if (lastReadTime !== null && firstUnreadMessageId) {
      for (let i = 0; i < deduplicatedMessages.length; i++) {
        if (new Date(deduplicatedMessages[i].created_at).getTime() > lastReadTime) {
          newMessagesDividerIndex = i;
          break;
        }
      }
    }

    for (let i = 0; i < deduplicatedMessages.length; i++) {
      const msg = deduplicatedMessages[i];
      if (msg.user_id) authorIds.add(msg.user_id);
      if (msg.reply_to?.user_id) authorIds.add(msg.reply_to.user_id);

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

      items.push({
        type: "message",
        message: msg,
        previousMessage: prevMsg,
        isNewMessagesDivider: i === newMessagesDividerIndex && hasInitialUnread,
      });
    }

    const nextVisibleAuthorUserIds = Array.from(authorIds).sort();
    const prevVisibleAuthorUserIds = visibleAuthorUserIdsRef.current;
    const visibleAuthorUserIds =
      prevVisibleAuthorUserIds.length === nextVisibleAuthorUserIds.length &&
      prevVisibleAuthorUserIds.every((id, index) => id === nextVisibleAuthorUserIds[index])
        ? prevVisibleAuthorUserIds
        : nextVisibleAuthorUserIds;

    visibleAuthorUserIdsRef.current = visibleAuthorUserIds;

    return {
      messages: filteredMessages,
      deduplicatedMessages,
      flatItems: items,
      visibleAuthorUserIds,
    };
  }, [rawMessages, visibilityBlockedUserIds, lastReadAt, firstUnreadMessageId]);

  const { messages, deduplicatedMessages, flatItems, visibleAuthorUserIds } = derivedView;

  const hasMore = channelData?.hasMore ?? true;

  const msgCount = deduplicatedMessages.length;

  const authorStyleMap = useAuthorStyles(currentServerId, visibleAuthorUserIds);

  // ── State ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(EMPTY_CUSTOM_EMOJI_MAP);
  const [globalEmojiMap, setGlobalEmojiMap] = useState<Map<string, ResolvedEmoji>>(EMPTY_GLOBAL_EMOJI_MAP);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const showJumpToPresentRef = useRef(false);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const prevChannelIdRef = useRef<string>(channelId);
  const didInitialBottomScrollRef = useRef(false);
  const lastScrollHeightRef = useRef(0);
  const pendingScrollAnchorRef = useRef<PendingScrollAnchor | null>(null);
  const channelOpenPerfRef = useRef<string | null>(null);
  const channelFirstPaintMarkedRef = useRef(false);
  const olderHistoryPerfRef = useRef<string | null>(null);
  const shouldWarmHistoryRef = useRef(false);
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const isFetchingOlderRef = useRef(isFetchingOlder);
  isFetchingOlderRef.current = isFetchingOlder;
  const hasMoreRef = useRef(hasMore);
  hasMoreRef.current = hasMore;
  const msgCountRef = useRef(msgCount);
  msgCountRef.current = msgCount;

  // Stable refs for use inside handlers/effects without triggering re-renders
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const channelIdRef = useRef(channelId);
  channelIdRef.current = channelId;
  const fetchMessagesRef = useRef(fetchMessages);
  fetchMessagesRef.current = fetchMessages;
  const deduplicatedMessagesRef = useRef(deduplicatedMessages);
  deduplicatedMessagesRef.current = deduplicatedMessages;

  const lastMessageId = useMemo(() => {
    if (messages.length === 0) return null;
    return messages[messages.length - 1].id;
  }, [messages]);
  const lastNudgedMessageIdRef = useRef<string | null>(null);

  if (prevChannelIdRef.current !== channelId) {
    prevChannelIdRef.current = channelId;
    didInitialBottomScrollRef.current = false;
  }

  const { highlightedMessageId } = useScrollToMessage({
    messages: deduplicatedMessages,
    isLoading,
    containerRef,
  });

  // TODO: the dynamic `import("@/stores/editStore")` inside this handler fires
  // every time someone presses ArrowUp to edit. Move to a static import at top of file.
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
    markChannelNavigationPerf(channelId, "message-list-effect-start");
    channelOpenPerfRef.current = beginChatPerf("channel-open", { channelId });
    channelFirstPaintMarkedRef.current = false;
    shouldWarmHistoryRef.current = false;
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
    const firstUnreadMessageId = unreadSnapshot.firstUnreadMessageId ?? null;
    const hasUnreadGap =
      hasUnreadBacklog &&
      !!firstUnreadMessageId &&
      !cacheEntry?.messages?.some((message) => message.id === firstUnreadMessageId);

    if (!hasCached) {
      markChannelNavigationPerf(channelId, "fetch-start", {
        cold: true,
        cached: false,
        limit: INITIAL_CHANNEL_LOAD_LIMIT,
      });
      shouldWarmHistoryRef.current = true;
      fetchMessages(channelId, INITIAL_CHANNEL_LOAD_LIMIT, undefined, false, false);
      return;
    }

    // Cached channels should render immediately and reconcile in the background.
    if (!isRealtimeConnected || !isFreshEnough || hasUnreadGap) {
      markChannelNavigationPerf(channelId, "fetch-start", {
        cold: false,
        cached: true,
        reconcile: true,
      });
      void fetchMessages(channelId, 50, undefined, true, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelId, manageCurrentChannel]);

  useLayoutEffect(() => {
    if (channelFirstPaintMarkedRef.current) return;
    const perfId = channelOpenPerfRef.current;
    if (!perfId) return;
    const hasRenderableState = msgCount > 0 || (!isLoading && messages.length === 0);
    if (!hasRenderableState) return;

    channelFirstPaintMarkedRef.current = true;
    afterNextPaint(() => {
      if (channelOpenPerfRef.current !== perfId) return;
      markChatPerf(perfId, "first-paint", {
        messageCount: msgCountRef.current,
        empty: messagesRef.current.length === 0,
      });
      markChannelNavigationPerf(channelId, "first-paint", {
        messageCount: msgCountRef.current,
        empty: messagesRef.current.length === 0,
      });
      afterNextPaint(() => {
        if (channelOpenPerfRef.current !== perfId) return;
        if (isLoadingRef.current || isFetchingOlderRef.current) return;
        endChatPerf(perfId, "settled", {
          messageCount: msgCountRef.current,
          hasMore: hasMoreRef.current,
        });
        endChannelNavigationPerf(channelId, "settled", {
          messageCount: msgCountRef.current,
          hasMore: hasMoreRef.current,
        });
        channelOpenPerfRef.current = null;
      });
    });
  }, [channelId, isLoading, messages.length, msgCount]);

  useEffect(() => {
    const perfId = channelOpenPerfRef.current;
    if (!perfId || !channelFirstPaintMarkedRef.current) return;
    if (isLoading || isFetchingOlder) return;

    afterNextPaint(() => {
      if (channelOpenPerfRef.current !== perfId) return;
      endChatPerf(perfId, "settled", {
        messageCount: msgCount,
        hasMore,
      });
      channelOpenPerfRef.current = null;
    });
  }, [hasMore, isFetchingOlder, isLoading, msgCount]);

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
      if (document.visibilityState === "hidden") {
        hiddenTime = Date.now();
        return;
      }
      if (isRefetching) return;
      if (hiddenTime && Date.now() - hiddenTime < MIN_HIDDEN_MS) {
        hiddenTime = null;
        return;
      }
      hiddenTime = null;
      isRefetching = true;
      if (refetchTimeout) clearTimeout(refetchTimeout);
      refetchTimeout = setTimeout(() => {
        isRefetching = false;
      }, 5000);
      const hasMessages = messagesRef.current.length > 0;
      fetchMessagesRef
        .current(channelIdRef.current, 50, undefined, true, hasMessages)
        .catch(() => {})
        .finally(() => {
          isRefetching = false;
          if (refetchTimeout) {
            clearTimeout(refetchTimeout);
            refetchTimeout = null;
          }
        });
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (refetchTimeout) clearTimeout(refetchTimeout);
    };
  }, []);

  useEffect(() => {
    if (isLoading || isFetchingOlder || !hasMore || msgCount === 0) return;
    if (document.visibilityState !== "visible") return;

    const timer = window.setTimeout(() => {
      void prefetchOlderMessages(channelId, BACKGROUND_HISTORY_PREFETCH_LIMIT).catch(() => undefined);
    }, shouldWarmHistoryRef.current ? BACKGROUND_HISTORY_PREFETCH_DELAY_MS : 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [channelId, hasMore, isFetchingOlder, isLoading, msgCount, prefetchOlderMessages]);

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

  // New message nudge
  useLayoutEffect(() => {
    const currentLength = messages.length;
    const prevLength = prevMessagesLengthRef.current;
    const currentLastId = lastMessageId;
    const prevLastId = lastNudgedMessageIdRef.current;

    const hasNewMessage =
      (currentLength > prevLength && prevLength > 0) ||
      (currentLastId !== null && prevLastId !== null && currentLastId !== prevLastId && prevLength > 0);

    if (hasNewMessage) {
      const node = containerRef.current;
      const actualDistanceFromBottom = node ? node.scrollHeight - node.scrollTop - node.clientHeight : 0;
      const effectivelyAtBottom = isNearBottomRef.current || actualDistanceFromBottom <= 150;

      if (!effectivelyAtBottom) {
        const added = Math.max(1, currentLength - prevLength);
        setNewMessageCount((prev) => prev + added);
      } else {
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

  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    if (atBottom) {
      setShowJumpToPresent(false);
      showJumpToPresentRef.current = false;
      setNewMessageCount(0);
    }
  }, []);

  const startReachedCooldownRef = useRef(false);
  const loadOlderArmedRef = useRef(true);

  const captureScrollAnchor = useCallback((): PendingScrollAnchor | null => {
    const node = containerRef.current;
    if (!node) return null;

    const containerTop = node.getBoundingClientRect().top;
    const rows = node.querySelectorAll<HTMLElement>("[data-message-row][data-message-id]");

    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      if (rect.bottom <= containerTop) continue;

      const messageId = row.dataset.messageId;
      if (!messageId) return null;

      return {
        messageId,
        topOffset: rect.top - containerTop,
      };
    }

    return null;
  }, []);

  const restoreScrollAnchor = useCallback((anchor: PendingScrollAnchor) => {
    const node = containerRef.current;
    if (!node) return false;

    const row = node.querySelector<HTMLElement>(`[data-message-id="${CSS.escape(anchor.messageId)}"]`);
    if (!row) return false;

    const containerTop = node.getBoundingClientRect().top;
    const currentTopOffset = row.getBoundingClientRect().top - containerTop;
    const delta = currentTopOffset - anchor.topOffset;

    if (Math.abs(delta) > 0.5) {
      node.scrollTop += delta;
      lastScrollHeightRef.current = node.scrollHeight;
    }

    return true;
  }, []);

  const handleLoadOlder = useCallback(() => {
    if (!hasMore || isLoading || isFetchingOlder || startReachedCooldownRef.current || !loadOlderArmedRef.current) {
      return;
    }
    const msgs = deduplicatedMessagesRef.current;
    const beforeCursor = channelData?.oldestLoadedAt || msgs[0]?.created_at;
    if (!beforeCursor) return;

    startReachedCooldownRef.current = true;
    loadOlderArmedRef.current = false;
    olderHistoryPerfRef.current = beginChatPerf("load-older", {
      channelId: channelIdRef.current,
      beforeCursor,
    });
    pendingScrollAnchorRef.current = captureScrollAnchor();

    fetchMessagesRef.current(channelIdRef.current, 50, beforeCursor).finally(() => {
      setTimeout(() => {
        startReachedCooldownRef.current = false;
      }, LOAD_OLDER_COOLDOWN_MS);
    });
  }, [hasMore, isLoading, isFetchingOlder, channelData?.oldestLoadedAt, captureScrollAnchor]);

  useLayoutEffect(() => {
    if (isFetchingOlder) return;

    const anchor = pendingScrollAnchorRef.current;
    if (!anchor) return;

    if (!restoreScrollAnchor(anchor)) {
      endChatPerf(olderHistoryPerfRef.current, "anchor-missing", {
        channelId,
        messageCount: msgCount,
      });
      olderHistoryPerfRef.current = null;
      pendingScrollAnchorRef.current = null;
      return;
    }

    // content-visibility and late intrinsic-size correction can adjust layout
    // after the first paint. Re-applying the same anchor for two frames keeps
    // the user's viewport stable without relying on browser scroll anchoring.
    let secondFrame: number | null = null;
    const firstFrame = requestAnimationFrame(() => {
      restoreScrollAnchor(anchor);
      secondFrame = requestAnimationFrame(() => {
        restoreScrollAnchor(anchor);
        endChatPerf(olderHistoryPerfRef.current, "anchor-restored", {
          channelId,
          messageCount: msgCount,
        });
        olderHistoryPerfRef.current = null;
        pendingScrollAnchorRef.current = null;
      });
    });

    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) cancelAnimationFrame(secondFrame);
    };
  }, [isFetchingOlder, msgCount, restoreScrollAnchor]);

  // Throttled scroll handler via requestAnimationFrame — scroll fires 60+/sec
  // on trackpads, so we coalesce to at most once per frame.
  const scrollRafRef = useRef<number | null>(null);
  const handleScroll = useCallback(() => {
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const node = containerRef.current;
      if (!node) return;

      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      const loadOlderTopThreshold = getLoadOlderTopThreshold(node.clientHeight);
      const loadOlderRearmThreshold = loadOlderTopThreshold + LOAD_OLDER_REARM_DISTANCE_PX;
      const atBottom = distanceFromBottom <= 100;
      const wasAtBottom = isNearBottomRef.current;

      isNearBottomRef.current = atBottom;
      lastScrollHeightRef.current = node.scrollHeight;

      if (node.scrollTop > loadOlderRearmThreshold) {
        loadOlderArmedRef.current = true;
      }

      if (
        node.scrollTop <= loadOlderTopThreshold &&
        !atBottom &&
        distanceFromBottom > LOAD_OLDER_BOTTOM_DISTANCE_GUARD_PX
      ) {
        handleLoadOlder();
      }

      if (atBottom && !wasAtBottom) {
        handleAtBottomStateChange(true);
      } else if (!atBottom && !wasAtBottom && distanceFromBottom >= 600) {
        if (!showJumpToPresentRef.current && deduplicatedMessagesRef.current.length > 10) {
          setShowJumpToPresent(true);
          showJumpToPresentRef.current = true;
        }
      }
    });
  }, [handleLoadOlder, handleAtBottomStateChange]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  // Initial bottom scroll
  useEffect(() => {
    loadOlderArmedRef.current = true;
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
    requestAnimationFrame(scrollDown);
  }, [isLoading, msgCount]);

  // ResizeObserver + MutationObserver — safety net for auto-scroll when images
  // load, embeds expand, or new messages are added.
  const messagesWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    lastScrollHeightRef.current = node.scrollHeight;
    let observerRaf: number | null = null;

    const autoScrollIfNeeded = () => {
      if (observerRaf !== null) return;
      observerRaf = requestAnimationFrame(() => {
        observerRaf = null;
        const n = containerRef.current;
        if (!n || !isNearBottomRef.current) return;
        const newHeight = n.scrollHeight;
        const oldHeight = lastScrollHeightRef.current;
        if (newHeight > oldHeight) {
          n.scrollTop = n.scrollHeight;
          isNearBottomRef.current = true;
        }
        lastScrollHeightRef.current = newHeight;
      });
    };

    const wrapper = messagesWrapperRef.current;
    if (!wrapper) {
      return () => {
        if (observerRaf !== null) cancelAnimationFrame(observerRaf);
      };
    }

    const resizeObserver = new ResizeObserver(autoScrollIfNeeded);
    const mutationObserver = new MutationObserver(autoScrollIfNeeded);

    resizeObserver.observe(wrapper);
    mutationObserver.observe(wrapper, { childList: true });

    return () => {
      if (observerRaf !== null) cancelAnimationFrame(observerRaf);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [channelId, msgCount > 0]);

  // Custom emoji map — per-server
  useEffect(() => {
    if (!currentServerId) {
      setCustomEmojiMap(EMPTY_CUSTOM_EMOJI_MAP);
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
        setCustomEmojiMap(EMPTY_CUSTOM_EMOJI_MAP);
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

  // Global emoji map — server-agnostic, load once on mount (no currentServerId dep)
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
  }, []);

  // ── Render ──
  const showEmpty = !isLoading && messages.length === 0;
  const showSkeleton = isLoading && messages.length === 0;

  return (
    <MessageMapsProvider>
      <div className="flex-1 flex flex-col min-h-0 relative">
        {showSkeleton && <MessageListSkeleton />}

        {showEmpty &&
          (currentChannel?.ghost_mode ? (
            <GhostChannelEmpty channelName={channelName} />
          ) : (
            <RegularChannelEmpty channelName={channelName} isVoiceAttached={isVoiceAttachedTextChannel} />
          ))}

        {msgCount > 0 && (
          <div
            ref={containerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden relative bg-transparent"
            onScroll={handleScroll}
            style={OVERFLOW_ANCHOR_NONE}
          >
            {isLoading && messages.length > 0 && (
              <div style={OVERFLOW_ANCHOR_NONE}>
                <HeaderLoader />
              </div>
            )}
            {isFetchingOlder && <LoadingOlderIndicator />}

            <div key={channelId} ref={messagesWrapperRef} data-messages-container>
              {flatItems.map((item, index) => {
                const key =
                  item.type === "dateDivider"
                    ? `date-divider-${item.date.toISOString().slice(0, 10)}-${index}`
                    : getStableMessageKey(item.message);
                const authorStyle = item.type === "message" ? authorStyleMap[item.message.user_id] : undefined;
                const replyAuthorStyle =
                  item.type === "message" ? authorStyleMap[item.message.reply_to?.user_id ?? ""] : undefined;
                return (
                  <Row
                    key={key}
                    item={item}
                    authorStyle={authorStyle}
                    replyAuthorStyle={replyAuthorStyle}
                    customEmojiMap={customEmojiMap}
                    globalEmojiMap={globalEmojiMap}
                    highlightedMessageId={highlightedMessageId}
                  />
                );
              })}
            </div>
          </div>
        )}

        <JumpToPresent visible={showJumpToPresent} newMessageCount={newMessageCount} onClick={scrollToBottom} />
      </div>
    </MessageMapsProvider>
  );
};
