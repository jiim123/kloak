import { useEffect, useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Message } from '@/types';

export const PinnedMessagesPanel = () => {
  const { activeModal, closeModal } = useUIStore();
  const { currentChannel, members } = useServerStore();
  const { pinMessage } = useMessageStore();
  
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isOpen = activeModal === 'pinned-messages';

  // Check if current user is admin
  const isAdmin = members.some(m => 
    m.role === 'owner' || m.role === 'admin' || m.role === 'moderator'
  );

  useEffect(() => {
    if (!isOpen || !currentChannel) return;

    const fetchPinnedMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            user:users(id, username, display_name, avatar_url, banner_color, bio, status, custom_status, created_at, last_seen)
          `)
          .eq('channel_id', currentChannel.id)
          .eq('is_pinned', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        setPinnedMessages(data.map(msg => ({
          id: msg.id,
          channel_id: msg.channel_id,
          user_id: msg.user_id,
          content: msg.content,
          is_pinned: msg.is_pinned ?? false,
          reply_to_id: msg.reply_to_id,
          edited_at: msg.edited_at,
          created_at: msg.created_at ?? new Date().toISOString(),
          user: msg.user,
          reactions: [],
          attachments: [],
        })));
      } catch (error) {
        console.error('Failed to fetch pinned messages:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPinnedMessages();
  }, [isOpen, currentChannel]);

  const handleUnpin = async (messageId: string) => {
    try {
      await pinMessage(messageId, false);
      setPinnedMessages(prev => prev.filter(m => m.id !== messageId));
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
                <div 
                  key={message.id}
                  className="group bg-secondary/50 rounded-lg p-3 hover:bg-secondary transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8 flex-shrink-0">
                      <AvatarImage src={message.user?.avatar_url || undefined} />
                      <AvatarFallback style={{ backgroundColor: message.user?.banner_color || '#5865F2' }}>
                        {message.user?.username?.[0]?.toUpperCase() || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {message.user?.display_name || message.user?.username}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {message.created_at && format(new Date(message.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                      <p className="text-sm line-clamp-3">{message.content}</p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 h-7 w-7"
                        onClick={() => handleUnpin(message.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
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