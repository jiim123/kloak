import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import type { Message, User } from '@/types';

// User cache to avoid refetching
const userCache = new Map<string, { user: User; timestamp: number }>();
const USER_CACHE_TTL = 60000; // 1 minute

const getCachedUser = async (userId: string): Promise<User | null> => {
  const cached = userCache.get(userId);
  if (cached && Date.now() - cached.timestamp < USER_CACHE_TTL) {
    return cached.user;
  }
  
  const { data } = await supabase.rpc('get_user_by_id', { _user_id: userId });
  if (data) {
    const user = data as unknown as User;
    userCache.set(userId, { user, timestamp: Date.now() });
    return user;
  }
  return null;
};

export const useRealtimeMessages = (channelId: string | null) => {
  useEffect(() => {
    if (!channelId) return;

    console.log('[Realtime] Setting up messages subscription for channel:', channelId);

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          console.log('[Realtime] New message received:', newMsg.id);
          
          // Get current state directly from store (not from stale ref)
          const store = useMessageStore.getState();
          const existingMessages = store.messagesByChannel[channelId]?.messages || [];
          
          // Skip if this message already exists
          if (existingMessages.some(m => m.id === newMsg.id)) {
            console.log('[Realtime] Message already exists, skipping:', newMsg.id);
            return;
          }
          
          // Get user from cache or fetch
          const user = await getCachedUser(newMsg.user_id);
          if (!user) return;
          
          // Build message with minimal data - no extra fetch needed
          const message: Message = {
            id: newMsg.id,
            channel_id: newMsg.channel_id,
            user_id: newMsg.user_id,
            reply_to_id: newMsg.reply_to_id,
            content: newMsg.content,
            is_pinned: newMsg.is_pinned || false,
            edited_at: newMsg.edited_at,
            created_at: newMsg.created_at,
            user,
            reply_to: undefined,
            attachments: [],
            reactions: [],
          };
          
          // If there's a reply, try to get it from existing messages
          if (newMsg.reply_to_id) {
            // Get fresh state again since time may have passed
            const freshStore = useMessageStore.getState();
            const freshMessages = freshStore.messagesByChannel[channelId]?.messages || [];
            const replyMsg = freshMessages.find(m => m.id === newMsg.reply_to_id);
            if (replyMsg) {
              message.reply_to = {
                id: replyMsg.id,
                content: replyMsg.content,
                user: replyMsg.user,
              };
            }
          }
          
          // Add message using the store action
          useMessageStore.getState().addMessage(message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          console.log('[Realtime] Message updated:', updated.id);
          
          // Use payload data directly for updates
          useMessageStore.getState().updateMessage(updated.id, {
            content: updated.content,
            edited_at: updated.edited_at,
            is_pinned: updated.is_pinned,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const oldData = payload.old as { id?: string };
          console.log('[Realtime] Message deleted:', oldData.id);
          if (oldData.id) {
            useMessageStore.getState().removeMessage(oldData.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up subscription for channel:', channelId);
      supabase.removeChannel(channel);
    };
  }, [channelId]);
};
