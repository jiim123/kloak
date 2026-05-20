import React, { useState, useCallback, useEffect, useMemo, useRef, Suspense } from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { Skeleton } from "@/components/ui/skeleton";

const ForumChannelArea = React.lazy(() => import("@/components/forum/ForumChannelArea").then(m => ({ default: m.ForumChannelArea })));
const MediaChannelArea = React.lazy(() => import("@/components/media/MediaChannelArea").then(m => ({ default: m.MediaChannelArea })));
const TasksChannelArea = React.lazy(() => import("@/components/tasks/TasksChannelArea").then(m => ({ default: m.TasksChannelArea })));
const AnnouncementChatArea = React.lazy(() => import("@/components/announcement/AnnouncementChatArea").then(m => ({ default: m.AnnouncementChatArea })));

const ChannelLoadingSkeleton = () => (
  <div className="h-full flex flex-col bg-layout-members">
    <div className="h-12 border-b border-border flex items-center px-4 gap-2 shrink-0">
      <Skeleton className="h-5 w-32" />
    </div>
    <div className="flex-1 p-4 space-y-4">
      {[...Array(5)].map((_, i) => (
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

// ── Granular Zustand selectors (stable references, minimal re-renders) ──

const selectCurrentChannel = (s: ReturnType<typeof useServerStore.getState>) => s.currentChannel;
const selectCurrentServer = (s: ReturnType<typeof useServerStore.getState>) => s.currentServer;
const selectFetchMembers = (s: ReturnType<typeof useServerStore.getState>) => s.fetchMembers;
const selectMembers = (s: ReturnType<typeof useServerStore.getState>) => s.members;
const selectMembersServerId = (s: ReturnType<typeof useServerStore.getState>) => s.membersServerId;
const selectUser = (s: ReturnType<typeof useAuthStore.getState>) => s.user;
const selectSetMobileSidebarOpen = (s: ReturnType<typeof useUIStore.getState>) => s.setMobileSidebarOpen;
const selectSetMemberSidebarOpen = (s: ReturnType<typeof useUIStore.getState>) => s.setMemberSidebarOpen;
const selectOpenModal = (s: ReturnType<typeof useUIStore.getState>) => s.openModal;
const EMPTY_MESSAGES: Message[] = [];

const formatSlowmodeDuration = (totalSeconds: number): string => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

// ── Empty‑channel placeholder (static, extracted to avoid re‑creation) ──

const NoChannelPlaceholder = () => (
  <div className="h-full flex flex-col items-center justify-center text-center px-4 bg-layout-members relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

    <div className="relative mb-6">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 blur-xl" />
      <div className="relative flex items-center justify-center">
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
);

// ── Pinned‑message bar (memoised separately) ──

interface PinnedBarProps {
  pinnedMessages: any[];
  userId: string | undefined;
  customEmojiMap: Record<string, string>;
  channelId: string;
  openModal: (modal: string, data?: any) => void;
}

const PinnedMessageBar = React.memo(function PinnedMessageBar({
  pinnedMessages,
  userId,
  customEmojiMap,
  channelId,
  openModal,
}: PinnedBarProps) {
  if (pinnedMessages.length === 0) return null;

  const latest = pinnedMessages[0];
  // Phase 1: look up user from centralized cache
  const latestUser = useUserCacheStore.getState().getUser(latest.user_id) ?? latest.user;

  const rawContent = (latest.content || "")
    .replace(/```[\s\S]*?```/g, "[code]")
    .replace(/`[^`]+`/g, "[code]")
    .replace(/\n/g, " ")
    .trim();

  const truncatedContent = rawContent.slice(0, 100);
  // Convert plain object → Map for the parser (keeps the rest of the app untouched)
  const emojiMap = useMemo(() => new Map(Object.entries(customEmojiMap)), [customEmojiMap]);
  const parsedSnippet = parseTextContent(truncatedContent, userId, undefined, emojiMap);
  const hasAttachments = (latest.attachments?.length ?? 0) > 0;
  const isNew = latest.created_at && Date.now() - new Date(latest.created_at).getTime() < 24 * 60 * 60 * 1000;

  const handleSeeAll = useCallback(() => openModal("pinned-messages", { channelId }), [openModal, channelId]);

  // Clear loading-placeholder background on snippet images once they load
  // (replaces the CSP-violating inline `onload` attribute).
  const snippetRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    const el = snippetRef.current;
    if (!el) return;
    const handleLoad = (e: Event) => {
      const target = e.target;
      if (target instanceof HTMLImageElement && target.dataset.loadingBg === "true") {
        target.style.backgroundColor = "transparent";
        delete target.dataset.loadingBg;
      }
    };
    el.addEventListener("load", handleLoad, true);
    return () => el.removeEventListener("load", handleLoad, true);
  }, []);

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border/50 flex-shrink-0 min-w-0 overflow-hidden">
      <Pin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Avatar className="w-5 h-5 flex-shrink-0">
        <AvatarImage src={latestUser?.avatar_url} />
        <AvatarFallback style={{ backgroundColor: latestUser?.banner_color || "#5865F2" }} className="text-[10px]">
          {latestUser?.username?.[0]?.toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      {isNew && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">
          new
        </span>
      )}
      <span
        ref={snippetRef}
        className="text-sm text-muted-foreground truncate min-w-0 flex-1 inline-flex items-center gap-1 [&_img]:w-4 [&_img]:h-4 [&_img]:inline-block [&_img]:align-middle"
        dangerouslySetInnerHTML={{ __html: parsedSnippet || "Pinned message" }}
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


// ── Main component ──

// ── Main component ──

interface ChatAreaProps {
  showHeader?: boolean;
}

export const ChatArea = ({ showHeader = true }: ChatAreaProps) => {
  // Granular selectors — component only re‑renders when these specific values change
  const currentChannel = useServerStore(selectCurrentChannel);
  const currentServer = useServerStore(selectCurrentServer);
  const fetchMembers = useServerStore(selectFetchMembers);
  const members = useServerStore(selectMembers);
  const membersServerId = useServerStore(selectMembersServerId);
  const user = useAuthStore(selectUser);
  const setMobileSidebarOpen = useUIStore(selectSetMobileSidebarOpen);
  const setMemberSidebarOpen = useUIStore(selectSetMemberSidebarOpen);
  const openModal = useUIStore(selectOpenModal);

  // Derived primitives (stable across renders when values don't change)
  const channelId = currentChannel?.id ?? null;
  const channelType = currentChannel?.type;
  const channelName = currentChannel?.name ?? "";
  const serverId = currentServer?.id ?? null;
  const isGhostMode = currentChannel?.ghost_mode ?? false;
  const hasCurrentUserMember = useMemo(
    () => !!user?.id && members.some((member) => member.user_id === user.id),
    [members, user?.id],
  );
  const channelMessages = useMessageStore((s) => {
    if (!channelId) return EMPTY_MESSAGES;
    return s.messagesByChannel[channelId]?.messages ?? EMPTY_MESSAGES;
  });

  const membershipFetchKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!serverId || !user?.id || !channelId) return;
    if (membersServerId === serverId && hasCurrentUserMember) return;

    const fetchKey = `${serverId}:${user.id}:${membersServerId ?? "none"}:${hasCurrentUserMember ? "present" : "missing"}`;
    if (membershipFetchKeyRef.current === fetchKey) return;
    membershipFetchKeyRef.current = fetchKey;

    void fetchMembers(serverId, { force: membersServerId === serverId });
  }, [serverId, user?.id, channelId, membersServerId, hasCurrentUserMember, fetchMembers]);

  const { typingUsers, startTyping, stopTyping } = useTyping(isGhostMode ? null : channelId);
  const pinnedMessages = useMemo(() => {
    if (channelMessages.length === 0) return EMPTY_MESSAGES;
    return channelMessages
      .filter((m) => m.is_pinned)
      .slice()
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [channelMessages]);
  const isMobile = useIsMobile();

  // Store emojis as a plain object so reference equality checks work with useMemo
  const [customEmojiMap, setCustomEmojiMap] = useState<Record<string, string>>({});
  const [slowmodeStatus, setSlowmodeStatus] = useState<{ enabled: boolean; blocked: boolean; immune: boolean; remainingSeconds: number }>({
    enabled: false,
    blocked: false,
    immune: false,
    remainingSeconds: 0,
  });

  // Load custom emoji map for pinned message rendering
  useEffect(() => {
    if (!serverId) {
      setCustomEmojiMap({});
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
        if (!cancelled) setCustomEmojiMap({});
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

  // ── Early returns (all hooks are already called above) ──

  if (!currentChannel) {
    return <NoChannelPlaceholder />;
  }

  if (channelType === "voice") {
    return null;
  }

  if (channelType === "announcement") {
    return <Suspense fallback={<ChannelLoadingSkeleton />}><AnnouncementChatArea showHeader={showHeader} /></Suspense>;
  }

  if (channelType === "forum") {
    return <Suspense fallback={<ChannelLoadingSkeleton />}><ForumChannelArea showHeader={showHeader} /></Suspense>;
  }

  if (channelType === "media") {
    return <Suspense fallback={<ChannelLoadingSkeleton />}><MediaChannelArea showHeader={showHeader} /></Suspense>;
  }

  if (channelType === "tasks") {
    return <Suspense fallback={<ChannelLoadingSkeleton />}><TasksChannelArea showHeader={showHeader} /></Suspense>;
  }

  return (
    <div ref={swipeRef} className="h-full flex flex-col min-w-0 max-w-full overflow-x-hidden bg-layout-members relative">
      {/* Channel header */}
      {showHeader && <ChannelHeader channel={currentChannel} />}

      {/* Pinned message bar — memoised, only re‑renders when its props change */}
      <PinnedMessageBar
        pinnedMessages={pinnedMessages}
        userId={user?.id}
        customEmojiMap={customEmojiMap}
        channelId={currentChannel.id}
        openModal={openModal}
      />

      {/* Messages */}
      <MessageList channelId={currentChannel.id} channelName={channelName} />

      {/* Composer area */}
      <div className="shrink-0">
        {!isGhostMode && (
          <TypingIndicator
            typingUsers={typingUsers}
            reserveSpace
            rightContent={
              slowmodeStatus.enabled ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span>
                    {slowmodeStatus.immune
                      ? "Slowmode Immune"
                      : `Slow mode${slowmodeStatus.blocked ? ` ${formatSlowmodeDuration(slowmodeStatus.remainingSeconds)}` : ""}`}
                  </span>
                </span>
              ) : null
            }
          />
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
