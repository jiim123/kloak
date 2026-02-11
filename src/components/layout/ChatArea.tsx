import { useState, useCallback, useEffect, useRef } from "react";
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
import { useRealtimePinnedMessages } from "@/hooks/useRealtimePinnedMessages";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare, Hash, Pin } from "lucide-react";
import { parseTextContent } from "@/components/chat/MessageContent";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const ChatArea = () => {
  const { currentChannel, currentServer } = useServerStore();
  const { user } = useAuthStore();
  const { replyingTo, setReplyingTo } = useMessageStore();
  const { setMobileSidebarOpen, setMemberSidebarOpen, openModal } = useUIStore();
  const isGhostMode = currentChannel?.ghost_mode ?? false;
  const { typingUsers, startTyping, stopTyping } = useTyping(isGhostMode ? null : currentChannel?.id || null);
  const { pinnedMessages } = useRealtimePinnedMessages(currentChannel?.id ?? null);
  const isMobile = useIsMobile();
  
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());

  // Load custom emoji map for pinned message rendering
  useEffect(() => {
    const serverId = currentServer?.id;
    if (!serverId) {
      setCustomEmojiMap(new Map());
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const emojis = await fetchServerEmojis(serverId);
        if (cancelled) return;
        const map = new Map<string, string>();
        emojis.forEach((e) => map.set(e.name, e.url));
        setCustomEmojiMap(map);
      } catch (e) {
        console.error('Failed to load server emojis for pinned message:', e);
        if (!cancelled) setCustomEmojiMap(new Map());
      }
    };

    load();
    return () => { cancelled = true; };
  }, [currentServer?.id]);

  // Swipe gestures for mobile
  const swipeRef = useSwipeGestureRef({
    onSwipeRight: () => setMobileSidebarOpen(true),
    onSwipeLeft: () => setMemberSidebarOpen(true),
    threshold: 50,
    enabled: isMobile,
  });

  if (!currentChannel) {
    return (
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
  }

  if (currentChannel.type === "voice") {
    return null;
  }

  if (currentChannel.type === "forum") {
    return <ForumChannelArea />;
  }

  if (currentChannel.type === "media") {
    return <MediaChannelArea />;
  }

  return (
    <div 
      ref={swipeRef}
      className="h-full flex flex-col min-w-0 max-w-full overflow-x-hidden bg-background relative"
    >
      {/* Channel header */}
      <ChannelHeader channel={currentChannel} />

      {/* Pinned message bar */}
      {pinnedMessages.length > 0 && (() => {
        const latest = pinnedMessages[0];
        const rawContent = (latest.content || "")
          .replace(/```[\s\S]*?```/g, "[code]")
          .replace(/`[^`]+`/g, "[code]")
          .replace(/\n/g, " ")
          .trim();
        const truncatedContent = rawContent.slice(0, 100);
        const parsedSnippet = parseTextContent(truncatedContent, user?.id, undefined, customEmojiMap);
        const hasAttachments = (latest.attachments?.length ?? 0) > 0;
        const isNew = latest.created_at && (Date.now() - new Date(latest.created_at).getTime() < 24 * 60 * 60 * 1000);
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
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/20 text-primary flex-shrink-0">new</span>
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
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full flex-shrink-0 text-xs"
              onClick={() => openModal("pinned-messages", { channelId: currentChannel.id })}
            >
              See All Pins
            </Button>
          </div>
        );
      })()}

      {/* Messages */}
      <MessageList channelId={currentChannel.id} channelName={currentChannel.name} />

      {/* Typing indicator */}
      {!isGhostMode && <TypingIndicator typingUsers={typingUsers} />}

      {/* Message input */}
      <MessageInput
        channelId={currentChannel.id}
        channelName={currentChannel.name}
        onTyping={startTyping}
        onStopTyping={stopTyping}
      />
    </div>
  );
};
