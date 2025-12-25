import { ChannelHeader } from '@/components/chat/ChannelHeader';
import { MessageList } from '@/components/chat/MessageList';
import { MessageInput } from '@/components/chat/MessageInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useServerStore } from '@/stores/serverStore';
import { useTyping } from '@/hooks/useTyping';

export const ChatArea = () => {
  const { currentChannel } = useServerStore();
  const { typingUsers, startTyping, stopTyping } = useTyping(currentChannel?.id || null);

  if (!currentChannel) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4 bg-background">
        <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
          <span className="text-4xl">💬</span>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          No channel selected
        </h2>
        <p className="text-muted-foreground max-w-md">
          Select a channel from the sidebar to start chatting
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-w-0 bg-background">
      {/* Channel header */}
      <ChannelHeader channel={currentChannel} />

      {/* Messages */}
      <MessageList 
        channelId={currentChannel.id} 
        channelName={currentChannel.name} 
      />

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
