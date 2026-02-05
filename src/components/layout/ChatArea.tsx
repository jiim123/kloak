import { useState, useCallback, useEffect, useRef } from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ForumChannelArea } from "@/components/forum/ForumChannelArea";
import { AnnouncementChannelArea } from "@/components/announcement/AnnouncementChannelArea";
import { MediaChannelArea } from "@/components/media/MediaChannelArea";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useUIStore } from "@/stores/uiStore";
import { useTyping } from "@/hooks/useTyping";
import { useRealtimePinnedMessages } from "@/hooks/useRealtimePinnedMessages";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { MessageSquare, Hash, ImageIcon, Pin } from "lucide-react";
import { parseTextContent } from "@/components/chat/MessageContent";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, handleError } from "@/lib/errorHandler";

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB

export const ChatArea = () => {
  const { currentChannel, currentServer } = useServerStore();
  const { user } = useAuthStore();
  const { sendMessage, replyingTo, setReplyingTo } = useMessageStore();
  const { setMobileSidebarOpen, setMemberSidebarOpen, openModal } = useUIStore();
  const { typingUsers, startTyping, stopTyping } = useTyping(currentChannel?.id || null);
  const { pinnedMessages } = useRealtimePinnedMessages(currentChannel?.id ?? null);
  const isMobile = useIsMobile();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const isProcessingPasteRef = useRef(false);
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

  const uploadImage = useCallback(async (file: File) => {
    if (!user || !currentChannel) return;
    
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      handleError(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
      return;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      handleError(new Error('File size must be less than 1MB'));
      return;
    }

    setIsUploading(true);
    try {
      const replyToId = replyingTo?.id;
      const timestamp = Date.now();
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `${user.id}/${timestamp}-${crypto.randomUUID()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('attachments')
        .getPublicUrl(data.path);

      await sendMessage(currentChannel.id, user.id, urlData.publicUrl, replyToId);

      // Clear reply (only if still replying to the same message)
      if (replyToId && useMessageStore.getState().replyingTo?.id === replyToId) {
        setReplyingTo(null);
      }

      showSuccess('Image uploaded successfully');
    } catch (error) {
      handleError(error, 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  }, [user, currentChannel, sendMessage, replyingTo?.id, setReplyingTo]);

  // Reset paste processing ref when upload completes
  useEffect(() => {
    if (!isUploading) {
      // Reset after a short delay to prevent race conditions
      const timeoutId = setTimeout(() => {
        isProcessingPasteRef.current = false;
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isUploading]);

  // Paste handler for clipboard images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Prevent duplicate processing
      if (!currentChannel || !user || isUploading || isProcessingPasteRef.current) return;

      // If the user is actively pasting into a textarea/contenteditable (e.g. MessageInput),
      // let that component handle the paste so it can include any typed text/reply state.
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl) {
        const tag = activeEl.tagName?.toLowerCase();
        if (tag === 'textarea' || tag === 'input' || activeEl.isContentEditable) {
          return;
        }
      }
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          const file = item.getAsFile();
          if (file) {
            isProcessingPasteRef.current = true;
            uploadImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste, true); // Use capture phase
    return () => document.removeEventListener('paste', handlePaste, true);
  }, [currentChannel, user, uploadImage, isUploading]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => ALLOWED_IMAGE_TYPES.includes(file.type));

    if (imageFile) {
      uploadImage(imageFile);
    }
  }, [uploadImage]);

  if (!currentChannel) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4 bg-background relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

        {/* Animated icon container */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative mb-6"
        >
          {/* Outer glow ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 blur-xl" />

          {/* Icon container */}
          <div className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10 flex items-center justify-center shadow-lg">
            <MessageSquare className="w-10 h-10 text-primary/70" />
          </div>
        </motion.div>

        {/* Content */}
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

        {/* Optional: Quick action hint */}
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
    // Voice UI is rendered by `VoicePersistentHost` so the connection can persist while navigating.
    return null;
  }

  if (currentChannel.type === "forum") {
    // Forum channels use a different UI
    return <ForumChannelArea />;
  }

  if (currentChannel.type === "announcement") {
    // Announcement channels use a different UI
    return <AnnouncementChannelArea />;
  }

  if (currentChannel.type === "media") {
    // Media channels use a gallery-style UI
    return <MediaChannelArea />;
  }

  return (
    <div 
      ref={swipeRef}
      className="h-full flex flex-col min-w-0 bg-background relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Channel header */}
      <ChannelHeader channel={currentChannel} />

      {/* Pinned message bar - most recent pin in one line with See All Pins */}
      {pinnedMessages.length > 0 && (() => {
        const latest = pinnedMessages[0];
       // Parse content with custom emojis but strip formatting for snippet
       const rawContent = (latest.content || "")
         .replace(/```[\s\S]*?```/g, "[code]") // Replace code blocks
         .replace(/`[^`]+`/g, "[code]") // Replace inline code
         .replace(/\n/g, " ") // Replace newlines with spaces
         .trim();
       // Truncate before parsing to avoid processing huge messages
       const truncatedContent = rawContent.slice(0, 100);
       // Parse with custom emojis to render :emoji: as images
       const parsedSnippet = parseTextContent(truncatedContent, user?.id, undefined, customEmojiMap);
        const hasAttachments = (latest.attachments?.length ?? 0) > 0;
        const isNew = latest.created_at && (Date.now() - new Date(latest.created_at).getTime() < 24 * 60 * 60 * 1000);
        return (
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 border-b border-border/50 flex-shrink-0 min-w-0">
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
             dangerouslySetInnerHTML={{ 
               __html: parsedSnippet || "Pinned message" 
             }}
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
      <TypingIndicator typingUsers={typingUsers} />

      {/* Message input */}
      <MessageInput
        channelId={currentChannel.id}
        channelName={currentChannel.name}
        onTyping={startTyping}
        onStopTyping={stopTyping}
      />

      {/* Drag overlay */}
      <AnimatePresence>
        {(isDragging || isUploading) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg pointer-events-none"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">
                  {isUploading ? 'Uploading...' : 'Drop image to upload'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Images are deleted after 14 days
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
