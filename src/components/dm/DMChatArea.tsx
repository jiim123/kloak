import { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from "react";
import { ArrowDown, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StackedAvatars } from "@/components/ui/stacked-avatars";
import { useDMStore } from "@/stores/dmStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useFriendStore } from "@/stores/friendStore";
import { useUnreadDMsContext } from "@/hooks/useUnreadDMsContext";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useScrollToMessage } from "@/hooks/useScrollToMessage";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageInput } from "@/components/chat/MessageInput";
import { MessageItem, type DMActions } from "@/components/chat/MessageItem";
import { MessageMapsProvider } from "@/components/chat/MessageMapsContext";
import { normalizeDirectMessage } from "@/lib/dmNormalizer";
import { DMHeader } from "./DMHeader";
import { GroupChatHeader } from "./GroupChatHeader";
import type { DirectMessage, Message, User } from "@/types";

const DM_LOAD_OLDER_TOP_THRESHOLD_MIN_PX = 96;
const DM_LOAD_OLDER_TOP_THRESHOLD_MAX_PX = 420;
const DM_LOAD_OLDER_TOP_THRESHOLD_VIEWPORT_RATIO = 0.35;
const DM_LOAD_OLDER_BOTTOM_DISTANCE_GUARD_PX = 300;

const getDMLoadOlderTopThreshold = (clientHeight: number): number => {
  const scaledThreshold = Math.round(clientHeight * DM_LOAD_OLDER_TOP_THRESHOLD_VIEWPORT_RATIO);
  return Math.min(
    DM_LOAD_OLDER_TOP_THRESHOLD_MAX_PX,
    Math.max(DM_LOAD_OLDER_TOP_THRESHOLD_MIN_PX, scaledThreshold),
  );
};

export const DMChatArea = () => {
  const { user } = useAuthStore();
  const { currentConversation, isLoading, fetchMessages, getMessages, prefetchOlderMessages } = useDMStore();
  const { setMobileSidebarOpen } = useUIStore();
  const { blockedUsers, visibilityBlockedUserIds } = useFriendStore();
  const { markAsRead } = useUnreadDMsContext();
  const isMobile = useIsMobile();
  const currentConversationId = currentConversation?.id ?? null;
  const historyMeta = useDMStore((state) =>
    currentConversationId ? state.historyMetaByConversation[currentConversationId] : undefined,
  );
  const isFetchingOlder = useDMStore((state) =>
    currentConversationId ? !!state.fetchingOlderByConversation[currentConversationId] : false,
  );

  // Get messages for current conversation from cache
  const rawMessages = currentConversation ? getMessages(currentConversation.id) : [];

  // Normalize DM messages to Message shape for unified MessageItem
  const messages: Message[] = useMemo(
    () => rawMessages.map(normalizeDirectMessage),
    [rawMessages],
  );

  // Keep raw messages for reply lookups
  const rawMessagesRef = useRef(rawMessages);
  rawMessagesRef.current = rawMessages;

  // Check if either user has blocked the other
  const otherUserId = currentConversation?.other_user?.id;
  const isBlockedByMe = blockedUsers.some((b) => b.id === otherUserId);
  const isBlockedByThem = otherUserId ? visibilityBlockedUserIds.includes(otherUserId) && !isBlockedByMe : false;

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollRAFRef = useRef<number | null>(null);
  const needsScrollRef = useRef(true);
  const prevConversationIdRef = useRef<string | null>(null);
  const pendingOlderRestoreRef = useRef<{ scrollHeight: number; scrollTop: number } | null>(null);
  const prevMessageCountRef = useRef(0);
  const prevLastMessageIdRef = useRef<string | null>(null);

  const { highlightedMessageId } = useScrollToMessage({ messages, isLoading, containerRef: messagesContainerRef });

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [replyingTo, setReplyingTo] = useState<DirectMessage | null>(null);

  // Detect conversation switch during render phase (synchronous)
  if (prevConversationIdRef.current !== currentConversation?.id) {
    prevConversationIdRef.current = currentConversation?.id || null;
    needsScrollRef.current = true;
    pendingOlderRestoreRef.current = null;
    prevMessageCountRef.current = 0;
    prevLastMessageIdRef.current = null;
  }

  // Swipe gesture for mobile
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
  useLayoutEffect(() => {
    if (needsScrollRef.current && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      setIsAtBottom(true);
      needsScrollRef.current = false;
    }
  }, [messages.length, currentConversation?.id]);

  useLayoutEffect(() => {
    const pendingRestore = pendingOlderRestoreRef.current;
    const container = messagesContainerRef.current;
    if (!pendingRestore || !container) return;

    const delta = container.scrollHeight - pendingRestore.scrollHeight;
    container.scrollTop = pendingRestore.scrollTop + delta;
    pendingOlderRestoreRef.current = null;
  }, [messages.length]);

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  // Auto-scroll to bottom on appended new messages
  useEffect(() => {
    const prevCount = prevMessageCountRef.current;
    const prevLastMessageId = prevLastMessageIdRef.current;
    const appendedNewMessage =
      prevCount > 0 &&
      messages.length >= prevCount &&
      lastMessageId !== null &&
      prevLastMessageId !== null &&
      lastMessageId !== prevLastMessageId;

    if (appendedNewMessage) {
      if (isAtBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        setNewMessageCount((prev) => prev + 1);
      }
    }

    prevMessageCountRef.current = messages.length;
    prevLastMessageIdRef.current = lastMessageId;
  }, [isAtBottom, lastMessageId, messages.length]);

  useEffect(() => {
    if (isAtBottom) setNewMessageCount(0);
  }, [isAtBottom]);

  useEffect(() => {
    return () => {
      if (scrollRAFRef.current !== null) cancelAnimationFrame(scrollRAFRef.current);
    };
  }, []);

  useEffect(() => {
    if (!currentConversation?.id || !user?.id || isLoading || isFetchingOlder) return;
    if (historyMeta?.hasMore === false || rawMessages.length === 0) return;
    if (document.visibilityState !== "visible") return;

    const timer = window.setTimeout(() => {
      void prefetchOlderMessages(currentConversation.id, user.id, 50).catch(() => undefined);
    }, 700);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    currentConversation?.id,
    historyMeta?.hasMore,
    isFetchingOlder,
    isLoading,
    prefetchOlderMessages,
    rawMessages.length,
    user?.id,
  ]);

  const handleScroll = useCallback(() => {
    if (scrollRAFRef.current !== null) cancelAnimationFrame(scrollRAFRef.current);
    scrollRAFRef.current = requestAnimationFrame(() => {
      const container = messagesContainerRef.current;
      if (!container) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const loadOlderTopThreshold = getDMLoadOlderTopThreshold(clientHeight);
      const atBottom = distanceFromBottom < 100;
      setIsAtBottom((prev) => (prev !== atBottom ? atBottom : prev));
      if (
        currentConversation?.id &&
        user?.id &&
        !isFetchingOlder &&
        historyMeta?.hasMore !== false &&
        historyMeta?.oldestLoadedMessageId &&
        scrollTop <= loadOlderTopThreshold &&
        !atBottom &&
        distanceFromBottom > DM_LOAD_OLDER_BOTTOM_DISTANCE_GUARD_PX
      ) {
        pendingOlderRestoreRef.current = { scrollHeight, scrollTop };
        void fetchMessages(currentConversation.id, user.id, 50, historyMeta.oldestLoadedMessageId);
      }
      scrollRAFRef.current = null;
    });
  }, [
    currentConversation?.id,
    fetchMessages,
    historyMeta?.hasMore,
    historyMeta?.oldestLoadedMessageId,
    isFetchingOlder,
    user?.id,
  ]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setNewMessageCount(0);
    setIsAtBottom(true);
  }, []);

  // Group messages by sender within 5 minutes
  const groupedMessages = useMemo(() => {
    const groups: { message: Message; isFirst: boolean }[] = [];
    messages.forEach((msg, index) => {
      const prevMsg = messages[index - 1];
      const isFirst =
        !prevMsg ||
        prevMsg.user_id !== msg.user_id ||
        new Date(msg.created_at || "").getTime() - new Date(prevMsg.created_at || "").getTime() > 5 * 60 * 1000;
      groups.push({ message: msg, isFirst });
    });
    return groups;
  }, [messages]);

  // DM actions for unified MessageItem
  const dmStore = useDMStore;
  const dmActionsConfig: DMActions = useMemo(() => ({
    editMessage: async (messageId: string, userId: string, content: string) => {
      await dmStore.getState().editMessage(messageId, userId, content);
    },
    deleteMessage: async (messageId: string, userId: string) => {
      await dmStore.getState().deleteMessage(messageId, userId);
    },
    addReaction: async (messageId: string, userId: string, emoji: string) => {
      await dmStore.getState().addReaction(messageId, userId, emoji);
    },
    removeReaction: async (messageId: string, userId: string, emoji: string) => {
      await dmStore.getState().removeReaction(messageId, userId, emoji);
    },
    onReply: (message: Message) => {
      // Find the raw DM message to set as reply
      const raw = rawMessagesRef.current.find((m) => m.id === message.id);
      if (raw) setReplyingTo(raw);
    },
    conversationId: currentConversation?.id,
  }), [currentConversation?.id]);

  // Determine if this is a group conversation
  const isGroup = currentConversation?.is_group || false;

  // Get other participants for group chats
  const otherParticipants = useMemo(() => {
    if (!isGroup || !currentConversation?.participants) return [];
    return currentConversation.participants
      .filter((p) => p.user_id !== user?.id)
      .map((p) => p.user)
      .filter((u): u is User => u != null);
  }, [isGroup, currentConversation?.participants, user?.id]);

  const getGroupDisplayName = useCallback(() => {
    if (!currentConversation) return "";
    if (currentConversation.name) return currentConversation.name;
    const names = otherParticipants.slice(0, 3).map((p) => p.display_name || p.username || "Unknown");
    if (otherParticipants.length > 3) return `${names.join(", ")} and ${otherParticipants.length - 3} others`;
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    if (names.length === 0) return "Group";
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  }, [currentConversation, otherParticipants]);

  // Build the dmConfig for the unified MessageInput reply state
  const dmInputReplyingTo = useMemo(() => {
    if (!replyingTo) return null;
    return {
      id: replyingTo.id,
      sender: replyingTo.sender,
      content: replyingTo.content,
    };
  }, [replyingTo]);

  // Participants used for @mention autocomplete and mention rendering in DMs.
  // 1:1: just the other user. Group: all other participants. Always exclude self.
  const mentionParticipants = useMemo<User[]>(() => {
    if (isGroup) return otherParticipants;
    const other = currentConversation?.other_user;
    return other ? [other] : [];
  }, [isGroup, otherParticipants, currentConversation?.other_user]);

  if (!currentConversation) {
    return (
      <div className="h-full flex items-center justify-center bg-layout-members">
        <div className="text-center text-muted-foreground">
          <p>Select a conversation or start a new one</p>
        </div>
      </div>
    );
  }

  const otherUser = currentConversation.other_user;
  const isBlocked = isBlockedByMe || isBlockedByThem;

  return (
    <MessageMapsProvider isDM participants={mentionParticipants}>
    <div ref={swipeRef} className="relative h-full flex flex-col bg-layout-members">
      {/* Desktop header; mobile uses the global app header from AppLayout. */}
      <div className="hidden md:block">
        {isGroup ? (
          <GroupChatHeader conversation={currentConversation} participants={otherParticipants} />
        ) : (
          <DMHeader otherUser={otherUser} />
        )}
      </div>

      {/* Messages container */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {/* Start of conversation */}
        {isGroup ? (
          <div className="px-4 py-8 mb-4">
            <div className="flex items-center gap-4 mb-4">
              <StackedAvatars users={otherParticipants} size="lg" />
            </div>
            <h2 className="text-2xl font-medium text-foreground">{currentConversation.name || "Group Chat"}</h2>
            <p className="text-muted-foreground">
              This is the beginning of your group chat with{" "}
              <span className="font-medium">{getGroupDisplayName()}</span>.
            </p>
          </div>
        ) : (
          <div className="px-4 py-8 mb-4">
            <div className="flex items-center gap-4 mb-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-foreground text-3xl font-medium"
                style={{ backgroundColor: otherUser?.banner_color || "#5865F2" }}
              >
                {otherUser?.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt={otherUser.username}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  (otherUser?.username?.[0] || "?").toUpperCase()
                )}
              </div>
            </div>
            <h2 className="text-2xl font-medium text-foreground">{otherUser?.display_name || otherUser?.username}</h2>
          </div>
        )}

        {/* Messages */}
        {isLoading && rawMessages.length === 0 ? (
          <div className="flex items-center justify-center px-4 py-8">
            <div className="animate-pulse-subtle text-muted-foreground">Loading messages...</div>
          </div>
        ) : (
          <div>
            {groupedMessages.map(({ message, isFirst }) => (
              <MessageItem
                key={message.id}
                message={message}
                isGrouped={!isFirst}
                isHighlighted={message.id === highlightedMessageId}
                dmActions={isBlocked ? undefined : dmActionsConfig}
                flushOuterXPadding
              />
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Jump to present button */}
      {!isAtBottom && (
        <div className="pointer-events-none absolute bottom-24 left-1/2 z-[80] -translate-x-1/2">
          <Button variant="primary" size="sm" className="pointer-events-auto gap-2 shadow-lg" onClick={scrollToBottom}>
            <ArrowDown className="w-4 h-4" />
            {newMessageCount > 0 ? `${newMessageCount} new messages` : "Jump to Present"}
          </Button>
        </div>
      )}

      {/* Blocked state indicator */}
      {isBlocked ? (
        <div className="px-4 pb-4 sm:pb-6">
          <div className="flex items-center justify-center gap-2 py-4 px-4 bg-secondary rounded-2xl border border-border">
            <Ban className="w-4 h-4 text-muted-foreground" />
            <span className="text-[14px] sm:text-[15px] leading-[1.5] font-[Inter,system-ui,sans-serif] text-muted-foreground">
              {isBlockedByMe ? "You have blocked this user" : "You cannot message this user"}
            </span>
          </div>
        </div>
      ) : (
        <MessageInput
          dmConfig={{
            conversationId: currentConversation.id,
            otherUsername: isGroup ? getGroupDisplayName() : otherUser?.username || "user",
            replyingTo: dmInputReplyingTo,
            onCancelReply: () => setReplyingTo(null),
            participants: mentionParticipants,
          }}
        />
      )}
    </div>
    </MessageMapsProvider>
  );
};
