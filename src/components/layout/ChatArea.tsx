import { useState, useCallback, useEffect } from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useTyping } from "@/hooks/useTyping";
import { useOptimisticMessage } from "@/hooks/useOptimisticMessage";
import { MessageSquare, Hash, ImageIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, handleError } from "@/lib/errorHandler";

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const ChatArea = () => {
  const { currentChannel } = useServerStore();
  const { user } = useAuthStore();
  const { typingUsers, startTyping, stopTyping } = useTyping(currentChannel?.id || null);
  const { sendOptimistic } = useOptimisticMessage();
  
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const uploadImage = useCallback(async (file: File) => {
    if (!user || !currentChannel) return;
    
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      handleError(new Error('Only JPEG, PNG, GIF, and WebP images are allowed'));
      return;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      handleError(new Error('File size must be less than 10MB'));
      return;
    }

    setIsUploading(true);
    try {
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

      await sendOptimistic({
        channelId: currentChannel.id,
        content: urlData.publicUrl,
      });

      showSuccess('Image uploaded successfully');
    } catch (error) {
      handleError(error, 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  }, [user, currentChannel, sendOptimistic]);

  // Paste handler for clipboard images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!currentChannel || !user) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            uploadImage(file);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [currentChannel, user, uploadImage]);

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

  return (
    <div 
      className="h-full flex flex-col min-w-0 bg-background relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Channel header */}
      <ChannelHeader channel={currentChannel} />

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
