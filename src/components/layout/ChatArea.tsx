import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useServerStore } from "@/stores/serverStore";
import { useTyping } from "@/hooks/useTyping";

export const ChatArea = () => {
  const { currentChannel } = useServerStore();
  const { typingUsers, startTyping, stopTyping } = useTyping(currentChannel?.id || null);

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
    <div className="h-full flex flex-col min-w-0 bg-background">
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
    </div>
  );
};
