import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
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
    if (!channelId) {
      console.log('[Realtime] No channelId provided, skipping messages subscription');
      return;
    }

    console.log('[Realtime] Setting up messages subscription for channel:', channelId);

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const eventType = payload.eventType;
          
          console.log('[Realtime] Messages event received:', eventType, payload);
          
          if (eventType === 'INSERT') {
            const newMsg = payload.new as any;
            
            // Filter client-side for this channel
            if (newMsg.channel_id !== channelId) {
              console.log('[Realtime] Message for different channel, skipping');
              return;
            }
            
            console.log('[Realtime] New message received:', newMsg.id, newMsg.content?.substring(0, 50));
            
            // Get current state directly from store
            const store = useMessageStore.getState();
            const existingMessages = store.messagesByChannel[channelId]?.messages || [];
            
            // Skip if this message already exists
            if (existingMessages.some(m => m.id === newMsg.id)) {
              console.log('[Realtime] Message already exists, skipping:', newMsg.id);
              return;
            }
            
            // Get user from cache or fetch
            const user = await getCachedUser(newMsg.user_id);
            if (!user) {
              console.log('[Realtime] Could not fetch user for message:', newMsg.user_id);
              return;
            }
            
            // Build message with minimal data
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
            
            console.log('[Realtime] Adding message to store:', message.id);
            useMessageStore.getState().addMessage(message);
          } else if (eventType === 'UPDATE') {
            const updated = payload.new as any;
            
            // Filter client-side for this channel
            if (updated.channel_id !== channelId) return;
            
            console.log('[Realtime] Message updated:', updated.id);
            
            useMessageStore.getState().updateMessage(updated.id, {
              content: updated.content,
              edited_at: updated.edited_at,
              is_pinned: updated.is_pinned,
            });
          } else if (eventType === 'DELETE') {
            const oldData = payload.old as { id?: string; channel_id?: string };
            
            // For DELETE, we may not have channel_id in old data if REPLICA IDENTITY is not FULL
            // But we already have REPLICA IDENTITY FULL, so it should be there
            console.log('[Realtime] Message deleted:', oldData.id);
            
            if (oldData.id) {
              useMessageStore.getState().removeMessage(oldData.id);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Messages subscription status:', status, err ? `Error: ${err.message}` : '');
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to messages for channel:', channelId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error for messages:', err);
        } else if (status === 'TIMED_OUT') {
          console.error('[Realtime] Subscription timed out for messages');
        }
      });

    return () => {
      console.log('[Realtime] Cleaning up messages subscription for channel:', channelId);
      supabase.removeChannel(channel);
    };
  }, [channelId]);
};