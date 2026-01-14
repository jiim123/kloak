import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStatus } from './useConnectionStatus';

export const useRealtimeReactions = (channelId: string | null) => {
  const { isConnected, isReconnecting } = useConnectionStatus();
  const isSettingUpRef = useRef(false);

  useEffect(() => {
    if (!channelId) {
      return;
    }

    // Don't set up subscription if connection is down
    if (!isConnected && !isReconnecting) {
      return;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 2; // Reduced retries
    const RETRY_DELAY = 5000; // Longer delay

    const setupSubscription = () => {
      // Prevent duplicate setup
      if (isSettingUpRef.current) {
        return;
      }
      isSettingUpRef.current = true;

      // Clean up existing subscription if any
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      console.log('[Realtime] Setting up reactions subscription for channel:', channelId);

      channel = supabase
        .channel(`reactions:${channelId}`, {
          config: {
            // Don't broadcast presence, just listen to changes
            broadcast: { self: false },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'reactions',
          },
          (payload) => {
            try {
              const newReaction = payload.new as { message_id: string; user_id: string; emoji: string };
              const currentUserId = useAuthStore.getState().user?.id;
              
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
            } catch (error) {
              console.error('[Realtime] Error processing reaction INSERT:', error);
            }
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
            try {
              const oldReaction = payload.old as { message_id?: string; user_id?: string; emoji?: string };
              if (!oldReaction.message_id || !oldReaction.emoji) return;
              
              const currentUserId = useAuthStore.getState().user?.id;
              
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
            } catch (error) {
              console.error('[Realtime] Error processing reaction DELETE:', error);
            }
          }
        )
        .subscribe((status, err) => {
          isSettingUpRef.current = false;
          
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Successfully subscribed to reactions for channel:', channelId);
            retryCount = 0;
          } else if (status === 'CHANNEL_ERROR') {
            // Only retry if connection is available
            if (!isConnected && !isReconnecting) {
              console.warn('[Realtime] Connection down, not retrying reactions subscription');
              return;
            }
            
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              console.log(`[Realtime] Retrying reactions subscription (attempt ${retryCount}/${MAX_RETRIES})...`);
              retryTimeout = setTimeout(() => {
                // Check connection again before retrying
                if (isConnected || isReconnecting) {
                  setupSubscription();
                }
              }, RETRY_DELAY * retryCount);
            } else {
              console.warn('[Realtime] Max retries reached for reactions subscription. Continuing without realtime reactions.');
            }
          } else if (status === 'TIMED_OUT') {
            console.warn('[Realtime] Reactions subscription timed out');
          }
        });
    };

    setupSubscription();

    return () => {
      isSettingUpRef.current = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [channelId, isConnected, isReconnecting]);
};
