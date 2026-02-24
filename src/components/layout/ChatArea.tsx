import React, { useState, useCallback, useEffect, useMemo } from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ForumChannelArea } from "@/components/forum/ForumChannelArea";
import { MediaChannelArea } from "@/components/media/MediaChannelArea";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useUIStore } from "@/stores/uiStore";
import { useTyping } from "@/hooks/useTyping";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare, Hash, Pin } from "lucide-react";
import { parseTextContent } from "@/components/chat/MessageContent";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import type { Message } from "@/types";

// ── Granular Zustand selectors (stable references, minimal re-renders) ──

const selectCurrentChannel = (s: ReturnType<typeof useServerStore.getState>) => s.currentChannel;
const selectCurrentServer = (s: ReturnType<typeof useServerStore.getState>) => s.currentServer;
const selectFetchMembers = (s: ReturnType<typeof useServerStore.getState>) => s.fetchMembers;
const selectMembersServerId = (s: ReturnType<typeof useServerStore.getState>) => s.membersServerId;
const selectUser = (s: ReturnType<typeof useAuthStore.getState>) => s.user;
const selectSetMobileSidebarOpen = (s: ReturnType<typeof useUIStore.getState>) => s.setMobileSidebarOpen;
const selectSetMemberSidebarOpen = (s: ReturnType<typeof useUIStore.getState>) => s.setMemberSidebarOpen;
const selectOpenModal = (s: ReturnType<typeof useUIStore.getState>) => s.openModal;
const EMPTY_MESSAGES: Message[] = [];

// ── Empty‑channel placeholder (static, extracted to avoid re‑creation) ──

const NoChannelPlaceholder = () => (
  <div className="h-full flex flex-col items-center justify-center text-center px-4 bg-background relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative mb-6"
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 blur-xl" />
      <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center shadow-lg">
        <MessageSquare className="w-10 h-10 text-primary/70" />
      </div>
    </motion.div>

    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="space-y-3"
    >
      <h2 className="text-2xl font-bold text-foreground">No Channel Selected</h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
        Choose a channel from the sidebar to start conversations with your community
      </p>
    </motion.div>

    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mt-8 flex items-center gap-2 text-xs text-muted-foreground/60"
    >
      <Hash className="w-3.5 h-3.5" />
      <span>Select any channel to get started</span>
    </motion.div>
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

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border/50 flex-shrink-0 min-w-0 overflow-hidden">
      <Pin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <Avatar className="w-5 h-5 flex-shrink-0">
        <AvatarImage src={latest.user?.avatar_url} />
        <AvatarFallback style={{ backgroundColor: latest.user?.banner_color || "#5865F2" }} className="text-[10px]">
          {latest.user?.username?.[0]?.toUpperCase() || "?"}
        </AvatarFallback>
      </Avatar>
      {isNew && (
        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">
          new
        </span>
      )}
      <span
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

export const ChatArea = () => {
  // Granular selectors — component only re‑renders when these specific values change
  const currentChannel = useServerStore(selectCurrentChannel);
  const currentServer = useServerStore(selectCurrentServer);
  const fetchMembers = useServerStore(selectFetchMembers);
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
  const channelMessages = useMessageStore((s) => {
    if (!channelId) return EMPTY_MESSAGES;
    return s.messagesByChannel[channelId]?.messages ?? EMPTY_MESSAGES;
  });

  // Ensure member data exists for the active server (role colors, nicknames, moderation checks).
  // This should be server-scoped only; channel switches must not trigger member refetches.
  useEffect(() => {
    if (!serverId) return;
    // If the currently loaded members are for a different server (or not loaded yet), load them.
    if (membersServerId !== serverId) {
      fetchMembers(serverId);
    }
  }, [serverId, membersServerId, fetchMembers]);

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

  if (channelType === "forum") {
    return <ForumChannelArea />;
  }

  if (channelType === "media") {
    return <MediaChannelArea />;
  }

  return (
    <div ref={swipeRef} className="h-full flex flex-col min-w-0 max-w-full overflow-x-hidden bg-background relative">
      {/* Channel header */}
      <ChannelHeader channel={currentChannel} />

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

      {/* Typing indicator */}
      {!isGhostMode && <TypingIndicator typingUsers={typingUsers} />}

      {/* Message input */}
      <MessageInput
        channelId={currentChannel.id}
        channelName={channelName}
        onTyping={startTyping}
        onStopTyping={stopTyping}
      />
    </div>
  );
};
