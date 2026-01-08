import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import type { ReactionGroup } from '@/types';

export const useRealtimeReactions = (channelId: string | null) => {
  // Use refs to avoid recreating subscription when store changes
  const messageStoreRef = useRef(useMessageStore.getState());
  const authStoreRef = useRef(useAuthStore.getState());
  
  useEffect(() => {
    const unsubMessage = useMessageStore.subscribe((state) => {
      messageStoreRef.current = state;
    });
    const unsubAuth = useAuthStore.subscribe((state) => {
      authStoreRef.current = state;
    });
    return () => {
      unsubMessage();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    if (!channelId) return;

    console.log('[Realtime] Setting up reactions subscription for channel:', channelId);

    const channel = supabase
      .channel(`reactions:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reactions',
        },
        (payload) => {
          const newReaction = payload.new as { message_id: string; user_id: string; emoji: string };
          const currentUserId = authStoreRef.current.user?.id;
          
          console.log('[Realtime] Reaction added:', newReaction);
          
          // Update the message in the store optimistically
          const { messagesByChannel } = messageStoreRef.current;
          const channelData = messagesByChannel[channelId];
          if (!channelData) return;
          
          const messageIndex = channelData.messages.findIndex(m => m.id === newReaction.message_id);
          if (messageIndex === -1) return;
          
          const message = channelData.messages[messageIndex];
          const reactions = [...(message.reactions || [])];
          const existingGroup = reactions.find(r => r.emoji === newReaction.emoji);
          
          if (existingGroup) {
            // Check if this user already has this reaction (avoid duplicates)
            if (!existingGroup.users.includes(newReaction.user_id)) {
              existingGroup.count++;
              existingGroup.users.push(newReaction.user_id);
              if (newReaction.user_id === currentUserId) {
                existingGroup.hasReacted = true;
              }
            }
          } else {
            reactions.push({
              emoji: newReaction.emoji,
              count: 1,
              users: [newReaction.user_id],
              hasReacted: newReaction.user_id === currentUserId,
            });
          }
          
          messageStoreRef.current.updateMessage(newReaction.message_id, { reactions, channel_id: channelId } as any);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'reactions',
        },
        (payload) => {
          const oldReaction = payload.old as { message_id?: string; user_id?: string; emoji?: string };
          if (!oldReaction.message_id || !oldReaction.emoji) return;
          
          const currentUserId = authStoreRef.current.user?.id;
          
          console.log('[Realtime] Reaction removed:', oldReaction);
          
          // Update the message in the store
          const { messagesByChannel } = messageStoreRef.current;
          const channelData = messagesByChannel[channelId];
          if (!channelData) return;
          
          const messageIndex = channelData.messages.findIndex(m => m.id === oldReaction.message_id);
          if (messageIndex === -1) return;
          
          const message = channelData.messages[messageIndex];
          const reactions = (message.reactions || [])
            .map(r => {
              if (r.emoji !== oldReaction.emoji) return r;
              return {
                ...r,
                count: r.count - 1,
                users: r.users.filter(u => u !== oldReaction.user_id),
                hasReacted: oldReaction.user_id === currentUserId ? false : r.hasReacted,
              };
            })
            .filter(r => r.count > 0);
          
          messageStoreRef.current.updateMessage(oldReaction.message_id, { reactions, channel_id: channelId } as any);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Reactions subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up reactions subscription for channel:', channelId);
      supabase.removeChannel(channel);
    };
  }, [channelId]);
};
