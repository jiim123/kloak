import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
import { useFriendStore } from '@/stores/friendStore';
import { useConnectionStatus } from './useConnectionStatus';
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

      console.log('[Realtime] Setting up messages subscription for channel:', channelId);

      channel = supabase
        .channel(`messages:${channelId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `channel_id=eq.${channelId}`,
          },
          async (payload) => {
            try {
              const eventType = payload.eventType;
              
              if (eventType === 'INSERT') {
                const newMsg = payload.new as any;
                
                // Server-side filter should already ensure this, but keep as a guard.
                if (newMsg.channel_id !== channelId) return;
                
                // Mutual block invisibility: don't surface messages from blocked/blocked-by users.
                const blocked = useFriendStore.getState().visibilityBlockedUserIds;
                if (Array.isArray(blocked) && blocked.includes(newMsg.user_id)) return;
                
                // Get current state directly from store
                const store = useMessageStore.getState();
                const existingMessages = store.messagesByChannel[channelId]?.messages || [];
                
                // Skip if this message already exists
                if (existingMessages.some(m => m.id === newMsg.id)) {
                  return;
                }
                
                // Get user from cache or fetch
                const user = await getCachedUser(newMsg.user_id);
                if (!user) {
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
                  is_system_message: newMsg.is_system_message || false,
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
                
                useMessageStore.getState().addMessage(message);
              } else if (eventType === 'UPDATE') {
                const updated = payload.new as any;
                
                // Server-side filter should already ensure this, but keep as a guard.
                if (updated.channel_id !== channelId) return;
                
                useMessageStore.getState().updateMessage(updated.id, {
                  content: updated.content,
                  edited_at: updated.edited_at,
                  is_pinned: updated.is_pinned,
                });
              } else if (eventType === 'DELETE') {
                const oldData = payload.old as { id?: string; channel_id?: string };
                
                if (oldData.id) {
                  useMessageStore.getState().removeMessage(oldData.id);
                }
              }
            } catch (error) {
              console.error('[Realtime] Error processing message event:', error);
            }
          }
        )
        .subscribe((status, err) => {
          isSettingUpRef.current = false;
          
          if (status === 'SUBSCRIBED') {
            console.log('[Realtime] Successfully subscribed to messages for channel:', channelId);
            retryCount = 0;
          } else if (status === 'CHANNEL_ERROR') {
            // Only retry if connection is available
            if (!isConnected && !isReconnecting) {
              console.warn('[Realtime] Connection down, not retrying messages subscription');
              return;
            }
            
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              console.log(`[Realtime] Retrying messages subscription (attempt ${retryCount}/${MAX_RETRIES})...`);
              retryTimeout = setTimeout(() => {
                // Check connection again before retrying
                if (isConnected || isReconnecting) {
                  setupSubscription();
                }
              }, RETRY_DELAY * retryCount);
            } else {
              console.warn('[Realtime] Max retries reached for messages subscription. Continuing without realtime messages.');
            }
          } else if (status === 'TIMED_OUT') {
            console.warn('[Realtime] Messages subscription timed out');
          }
        });
    };

    setupSubscription();

    // Handle visibility changes to ensure subscription stays active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && channel) {
        // When tab becomes visible, check if subscription is still active
        // and re-establish if needed
        try {
          const channelState = (channel as any).state;
          if (channelState === 'closed' || channelState === 'errored' || channelState === 'timed_out') {
            console.log('[Realtime] Re-establishing subscription after visibility change');
            setupSubscription();
          }
        } catch (e) {
          // If we can't check state, try to re-establish anyway
          console.log('[Realtime] Re-establishing subscription after visibility change (state check failed)');
          setupSubscription();
        }
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSettingUpRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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