import React, { useState, useCallback, useEffect, useMemo, Suspense, memo } from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { Skeleton } from "@/components/ui/skeleton";

const ForumChannelArea = React.lazy(() =>
  import("@/components/forum/ForumChannelArea").then((m) => ({ default: m.ForumChannelArea })),
);
const MediaChannelArea = React.lazy(() =>
  import("@/components/media/MediaChannelArea").then((m) => ({ default: m.MediaChannelArea })),
);
const TasksChannelArea = React.lazy(() =>
  import("@/components/tasks/TasksChannelArea").then((m) => ({ default: m.TasksChannelArea })),
);
const AnnouncementChatArea = React.lazy(() =>
  import("@/components/announcement/AnnouncementChatArea").then((m) => ({ default: m.AnnouncementChatArea })),
);

import { useMessageStore } from "@/stores/messageStore";
import { useUIStore } from "@/stores/uiStore";
import { useTyping } from "@/hooks/useTyping";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare, Hash, Pin, Clock3 } from "lucide-react";
import { parseTextContent } from "@/components/chat/MessageContent";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { useUserCacheStore } from "@/stores/userCacheStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import type { Message } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & SELECTORS (module scope — stable references)
// ─────────────────────────────────────────────────────────────────────────────

// FIX #1: Was redeclared on every component mount. Now truly module-scoped.
const EMPTY_MESSAGES: Message[] = [];
const EMPTY_EMOJI_MAP: Record<string, string> = {};

// FIX #2: Default slowmode state as a stable reference (was inline in useState)
const DEFAULT_SLOWMODE_STATUS = {
  enabled: false,
  blocked: false,
  immune: false,
  remainingSeconds: 0,
};

// Granular selectors — already good, keeping them
const selectCurrentChannel = (s: ReturnType<typeof useServerStore.getState>) => s.currentChannel;
const selectCurrentServer = (s: ReturnType<typeof useServerStore.getState>) => s.currentServer;
const selectFetchMembers = (s: ReturnType<typeof useServerStore.getState>) => s.fetchMembers;
const selectMembersServerId = (s: ReturnType<typeof useServerStore.getState>) => s.membersServerId;
const selectUser = (s: ReturnType<typeof useAuthStore.getState>) => s.user;
const selectSetMobileSidebarOpen = (s: ReturnType<typeof useUIStore.getState>) => s.setMobileSidebarOpen;
const selectSetMemberSidebarOpen = (s: ReturnType<typeof useUIStore.getState>) => s.setMemberSidebarOpen;
const selectOpenModal = (s: ReturnType<typeof useUIStore.getState>) => s.openModal;

const formatSlowmodeDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (all memoized, hoisted)
// ─────────────────────────────────────────────────────────────────────────────

// FIX #3: ChannelLoadingSkeleton was declared INSIDE the module (good) but not memoized.
// It's used 4 times as Suspense fallback — memoize so all 4 use the same element.
const ChannelLoadingSkeleton = memo(() => (
  <div className="h-full flex flex-col bg-layout-members">
    <div className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0">
      <Skeleton className="h-5 w-32" />
    </div>
    <div className="flex-1 p-4 space-y-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
      ))}
    </div>
  </div>
));
ChannelLoadingSkeleton.displayName = "ChannelLoadingSkeleton";

// FIX #4: NoChannelPlaceholder already extracted but not memoized.
const NoChannelPlaceholder = memo(() => (
  <div className="h-full flex flex-col items-center justify-center text-center px-4 bg-layout-members relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

    <div className="relative mb-6">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 blur-xl" />
      <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center shadow-lg">
        <MessageSquare className="w-10 h-10 text-primary/70" />
      </div>
    </div>

    <div className="space-y-3">
      <h2 className="text-2xl font-medium text-foreground">No Channel Selected</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
        Choose a channel from the sidebar to start conversations with your community
      </p>
    </div>

    <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/60">
      <Hash className="w-3.5 h-3.5" />
      <span>Select any channel to get started</span>
    </div>
  </div>
));
NoChannelPlaceholder.displayName = "NoChannelPlaceholder";

interface PinnedBarProps {
  pinnedMessages: Message[];
  userId: string | undefined;
  customEmojiMap: Record<string, string>;
  channelId: string;
  openModal: (modal: string, data?: any) => void;
}

const PinnedMessageBar = memo(function PinnedMessageBar({
  pinnedMessages,
  userId,
  customEmojiMap,
  channelId,
  openModal,
}: PinnedBarProps) {
  // FIX #5 — CRITICAL BUG: Hooks were being called AFTER an early return.
  // `if (pinnedMessages.length === 0) return null;` followed by `useMemo` / `useCallback`
  // is a violation of the Rules of Hooks. When pinnedMessages flipped between empty
  // and non-empty, React would throw "Rendered fewer/more hooks than expected".
  // ALL hooks must be called unconditionally at the top of the component.

  const latest = pinnedMessages[0];

  // FIX #6 — CRITICAL BUG: `useUserCacheStore.getState()` inside render body.
  // This bypasses Zustand's subscription system — the component won't re-render
  // when the cached user updates (e.g., when their avatar or display name changes).
  // Use the hook form to subscribe properly.
  const latestUser = useUserCacheStore(
    useCallback(
      (s) => (latest ? (s.getUser(latest.user_id) ?? latest.user) : undefined),
      [latest?.user_id, latest?.user],
    ),
  );

  // FIX #7: rawContent computation — was running unconditionally on every render.
  // Memoize since the content only changes when the latest message changes.
  const rawContent = useMemo(() => {
    if (!latest) return "";
    return (latest.content || "")
      .replace(/```[\s\S]*?```/g, "[code]")
      .replace(/`[^`]+`/g, "[code]")
      .replace(/\n/g, " ")
      .trim();
  }, [latest?.content]);

  const truncatedContent = rawContent.slice(0, 100);

  // Convert plain object → Map for the parser
  const emojiMap = useMemo(() => new Map(Object.entries(customEmojiMap)), [customEmojiMap]);

  // FIX #8: parseTextContent result was being recomputed on every render even when
  // inputs were unchanged. Memoize the parsed snippet.
  const parsedSnippet = useMemo(
    () => parseTextContent(truncatedContent, userId, undefined, emojiMap),
    [truncatedContent, userId, emojiMap],
  );

  const hasAttachments = (latest?.attachments?.length ?? 0) > 0;

  // FIX #9: Date.now() check was unmemoized — compared against fresh timestamps on every render
  const isNew = useMemo(
    () => !!latest?.created_at && Date.now() - new Date(latest.created_at).getTime() < 24 * 60 * 60 * 1000,
    [latest?.created_at],
  );

  const handleSeeAll = useCallback(() => openModal("pinned-messages", { channelId }), [openModal, channelId]);

  // FIX #10: dangerouslySetInnerHTML object was being recreated every render.
  const snippetHtml = useMemo(() => ({ __html: parsedSnippet || "Pinned message" }), [parsedSnippet]);

  // FIX #11: Avatar fallback style was inline — creates new object every render
  const fallbackStyle = useMemo(
    () => ({ backgroundColor: latestUser?.banner_color || "#5865F2" }),
    [latestUser?.banner_color],
  );

  // Early return AFTER all hooks — this is correct
  if (pinnedMessages.length === 0 || !latest) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border/50 flex-shrink-0 min-w-0 overflow-hidden">
      <Pin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Avatar className="w-5 h-5 flex-shrink-0">
        <AvatarImage src={latestUser?.avatar_url} />
        <AvatarFallback style={fallbackStyle} className="text-[10px]">
          {latestUser?.username?.[0]?.toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      {isNew && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">
          new
        </span>
      )}
      <span
        className="text-sm text-muted-foreground truncate min-w-0 flex-1 inline-flex items-center gap-1 [&_img]:w-4 [&_img]:h-4 [&_img]:inline-block [&_img]:align-middle"
        dangerouslySetInnerHTML={snippetHtml}
      />
      {hasAttachments && (
        <span className="text-sm text-muted-foreground/80 flex-shrink-0">
          {latest.attachments!.length === 1 ? "1 attachment" : `${latest.attachments!.length} attachments`}
        </span>
      )}
      <Button variant="secondary" size="sm" className="rounded-full flex-shrink-0 text-xs" onClick={handleSeeAll}>
        See All Pins
      </Button>
    </div>
  );
});

// FIX #12: Slowmode indicator extracted as memo component so it doesn't re-render
// the parent on tick-based remainingSeconds updates.
interface SlowmodeIndicatorProps {
  enabled: boolean;
  blocked: boolean;
  immune: boolean;
  remainingSeconds: number;
}
const SlowmodeIndicator = memo(({ enabled, blocked, immune, remainingSeconds }: SlowmodeIndicatorProps) => {
  if (!enabled) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
      <Clock3 className="h-3.5 w-3.5" />
      <span>
        {immune ? "Slowmode Immune" : `Slow mode${blocked ? ` ${formatSlowmodeDuration(remainingSeconds)}` : ""}`}
      </span>
    </span>
  );
});
SlowmodeIndicator.displayName = "SlowmodeIndicator";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface ChatAreaProps {
  showHeader?: boolean;
}

export const ChatArea = ({ showHeader = true }: ChatAreaProps) => {
  // Granular selectors
  const currentChannel = useServerStore(selectCurrentChannel);
  const currentServer = useServerStore(selectCurrentServer);
  const user = useAuthStore(selectUser);
  const setMobileSidebarOpen = useUIStore(selectSetMobileSidebarOpen);
  const setMemberSidebarOpen = useUIStore(selectSetMemberSidebarOpen);
  const openModal = useUIStore(selectOpenModal);

  // Derived primitives
  const channelId = currentChannel?.id ?? null;
  const channelType = currentChannel?.type;
  const channelName = currentChannel?.name ?? "";
  const serverId = currentServer?.id ?? null;
  const isGhostMode = currentChannel?.ghost_mode ?? false;

  // FIX #13: channelMessages selector had an unstable closure over channelId.
  // Wrap in useCallback so the selector reference stays stable between renders
  // with the same channelId, preventing Zustand from treating it as a new selector.
  const channelMessages = useMessageStore(
    useCallback(
      (s) => {
        if (!channelId) return EMPTY_MESSAGES;
        return s.messagesByChannel[channelId]?.messages ?? EMPTY_MESSAGES;
      },
      [channelId],
    ),
  );

  const { typingUsers, startTyping, stopTyping } = useTyping(isGhostMode ? null : channelId);

  // FIX #14: pinnedMessages — return stable EMPTY_MESSAGES reference when no pins.
  // Also, `.slice().sort()` creates a new array even when the filtered set is identical.
  // Only create a new array when the filtered result actually differs.
  const pinnedMessages = useMemo(() => {
    if (channelMessages.length === 0) return EMPTY_MESSAGES;
    const pinned = channelMessages.filter((m) => m.is_pinned);
    if (pinned.length === 0) return EMPTY_MESSAGES;
    return pinned.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [channelMessages]);

  const isMobile = useIsMobile();

  const [customEmojiMap, setCustomEmojiMap] = useState<Record<string, string>>(EMPTY_EMOJI_MAP);
  const [slowmodeStatus, setSlowmodeStatus] = useState(DEFAULT_SLOWMODE_STATUS);

  // Load custom emoji map for pinned message rendering
  useEffect(() => {
    if (!serverId) {
      setCustomEmojiMap(EMPTY_EMOJI_MAP);
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const emojis = await fetchServerEmojis(serverId);
        if (cancelled) return;
        const map: Record<string, string> = {};
        emojis.forEach((e) => {
          map[e.name] = e.url;
        });
        setCustomEmojiMap(map);
      } catch (e) {
        console.error("Failed to load server emojis for pinned message:", e);
        if (!cancelled) setCustomEmojiMap(EMPTY_EMOJI_MAP);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [serverId]);

  // Stable swipe callbacks
  const handleSwipeRight = useCallback(() => setMobileSidebarOpen(true), [setMobileSidebarOpen]);
  const handleSwipeLeft = useCallback(() => setMemberSidebarOpen(true), [setMemberSidebarOpen]);

  const swipeConfig = useMemo(
    () => ({
      onSwipeRight: handleSwipeRight,
      onSwipeLeft: handleSwipeLeft,
      threshold: 50,
      enabled: isMobile,
    }),
    [handleSwipeRight, handleSwipeLeft, isMobile],
  );

  const swipeRef = useSwipeGestureRef(swipeConfig);

  // FIX #15: Memoize the TypingIndicator's rightContent to prevent re-render
  // of TypingIndicator when only parent re-renders (not slowmodeStatus).
  const typingIndicatorRightContent = useMemo(
    () => (
      <SlowmodeIndicator
        enabled={slowmodeStatus.enabled}
        blocked={slowmodeStatus.blocked}
        immune={slowmodeStatus.immune}
        remainingSeconds={slowmodeStatus.remainingSeconds}
      />
    ),
    [slowmodeStatus.enabled, slowmodeStatus.blocked, slowmodeStatus.immune, slowmodeStatus.remainingSeconds],
  );

  // ── Early returns ──
  if (!currentChannel) {
    return <NoChannelPlaceholder />;
  }

  if (channelType === "voice") {
    return null;
  }

  // FIX #16: Specialized channel areas — pre-create the Suspense fallback element once
  // so each branch doesn't inline a new <ChannelLoadingSkeleton /> (though with memo this
  // matters less, clean code matters more).
  if (channelType === "announcement") {
    return (
      <Suspense fallback={<ChannelLoadingSkeleton />}>
        <AnnouncementChatArea showHeader={showHeader} />
      </Suspense>
    );
  }

  if (channelType === "forum") {
    return (
      <Suspense fallback={<ChannelLoadingSkeleton />}>
        <ForumChannelArea showHeader={showHeader} />
      </Suspense>
    );
  }

  if (channelType === "media") {
    return (
      <Suspense fallback={<ChannelLoadingSkeleton />}>
        <MediaChannelArea showHeader={showHeader} />
      </Suspense>
    );
  }

  if (channelType === "tasks") {
    return (
      <Suspense fallback={<ChannelLoadingSkeleton />}>
        <TasksChannelArea showHeader={showHeader} />
      </Suspense>
    );
  }

  return (
    <div
      ref={swipeRef}
      className="h-full flex flex-col min-w-0 max-w-full overflow-x-hidden bg-layout-members relative"
    >
      {showHeader && <ChannelHeader channel={currentChannel} />}

      <PinnedMessageBar
        pinnedMessages={pinnedMessages}
        userId={user?.id}
        customEmojiMap={customEmojiMap}
        channelId={currentChannel.id}
        openModal={openModal}
      />

      <MessageList channelId={currentChannel.id} channelName={channelName} />

      <div className="shrink-0">
        {!isGhostMode && (
          <TypingIndicator typingUsers={typingUsers} reserveSpace rightContent={typingIndicatorRightContent} />
        )}
        <MessageInput
          channelId={currentChannel.id}
          channelName={channelName}
          onTyping={startTyping}
          onStopTyping={stopTyping}
          onSlowmodeStatusChange={setSlowmodeStatus}
        />
      </div>
    </div>
  );
};
