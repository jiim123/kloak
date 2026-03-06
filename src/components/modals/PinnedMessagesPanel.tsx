import { format } from 'date-fns';
import { Pin, X, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useMessageUser } from '@/stores/userCacheStore';
import { useRealtimePinnedMessages } from '@/hooks/useRealtimePinnedMessages';
import { useMemberPermissions } from '@/hooks/useMemberPermissions';
import { toast } from 'sonner';
import { PollMessage } from '@/components/chat/PollMessage';
import { MessageContent } from '@/components/chat/MessageContent';
import { getPollIdFromContent } from '@/lib/poll';
import React from 'react';

/** Individual pinned message row — uses reactive useMessageUser hook */
const PinnedMessageRow = React.memo(function PinnedMessageRow({
  message,
  currentUserId,
  isAdmin,
  onUnpin,
}: {
  message: any;
  currentUserId: string | undefined;
  isAdmin: boolean;
  onUnpin: (id: string) => void;
}) {
  const msgUser = useMessageUser(message.user_id);

  return (
    <div
      className="group bg-secondary/50 rounded-lg p-3 hover:bg-secondary transition-colors"
    >
      <div className="flex items-start gap-3">
        <Avatar className="w-8 h-8 flex-shrink-0">
          <AvatarImage src={msgUser?.avatar_url || undefined} />
          <AvatarFallback style={{ backgroundColor: msgUser?.banner_color || '#5865F2' }}>
            {msgUser?.username?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">
              {msgUser?.display_name || msgUser?.username || 'Unknown'}
            </span>
            <span className="text-xs text-muted-foreground">
              {message.created_at && format(new Date(message.created_at), 'MMM d, h:mm a')}
            </span>
          </div>
          {(() => {
            const pollId = getPollIdFromContent(message.content);
            if (pollId) {
              return <PollMessage pollId={pollId} />;
            }
            return (
              <div className="text-sm line-clamp-3">
                <MessageContent
                  content={message.content}
                  currentUserId={currentUserId}
                  messageId={message.id}
                  messageUser={msgUser ? {
                    id: msgUser.id,
                    username: msgUser.username,
                    display_name: msgUser.display_name,
                  } : undefined}
                />
              </div>
            );
          })()}
        </div>
        {isAdmin && (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 h-7 w-7"
            onClick={() => onUnpin(message.id)}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
});

export const PinnedMessagesPanel = () => {
  const { activeModal, closeModal } = useUIStore();
  const { currentChannel, members } = useServerStore();
  const { pinMessage } = useMessageStore();
  const { user } = useAuthStore();
  
  const isOpen = activeModal === 'pinned-messages';
  const { pinnedMessages, isLoading, refetch } = useRealtimePinnedMessages(
    isOpen && currentChannel ? currentChannel.id : null
  );

  // Check if current user can manage messages (pin/unpin)
  const { hasPermission } = useMemberPermissions();
  const isAdmin = hasPermission('manage_messages');

  const handleUnpin = async (messageId: string) => {
    if (!user) return;
    try {
      await pinMessage(messageId, false, user.id);
      refetch();
      toast.success('Message unpinned');
    } catch (error) {
      toast.error('Failed to unpin message');
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <SheetContent className="w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pin className="w-5 h-5" />
            Pinned Messages
          </SheetTitle>
          <SheetDescription>
            {currentChannel ? `#${currentChannel.name}` : 'No channel selected'}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : pinnedMessages.length > 0 ? (
            <div className="space-y-3">
              {pinnedMessages.map((message) => (
                <PinnedMessageRow
                  key={message.id}
                  message={message}
                  currentUserId={user?.id}
                  isAdmin={isAdmin}
                  onUnpin={handleUnpin}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Pin className="w-12 h-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No pinned messages</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pin important messages to find them later
              </p>
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};