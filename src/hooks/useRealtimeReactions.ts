import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';

export const useRealtimeReactions = (channelId: string | null) => {
  useEffect(() => {
    if (!channelId) {
      console.log('[Realtime] No channelId provided, skipping reactions subscription');
      return;
    }

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
          const currentUserId = useAuthStore.getState().user?.id;
          
          console.log('[Realtime] Reaction added:', newReaction);
          
          // Get current state directly from store
          const { messagesByChannel } = useMessageStore.getState();
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
          
          useMessageStore.getState().updateMessage(newReaction.message_id, { reactions, channel_id: channelId } as any);
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
          
          const currentUserId = useAuthStore.getState().user?.id;
          
          console.log('[Realtime] Reaction removed:', oldReaction);
          
          // Get current state directly from store
          const { messagesByChannel } = useMessageStore.getState();
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
          
          useMessageStore.getState().updateMessage(oldReaction.message_id, { reactions, channel_id: channelId } as any);
        }
      )
      .subscribe((status, err) => {
        console.log('[Realtime] Reactions subscription status:', status, err ? `Error: ${err.message}` : '');
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to reactions for channel:', channelId);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error for reactions:', err);
        }
      });

    return () => {
      console.log('[Realtime] Cleaning up reactions subscription for channel:', channelId);
      supabase.removeChannel(channel);
    };
  }, [channelId]);
};
