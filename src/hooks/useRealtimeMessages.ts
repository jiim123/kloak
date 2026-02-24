import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
import { useFriendStore } from '@/stores/friendStore';
import { useAuthStore } from '@/stores/authStore';
import type { Message } from '@/types';
import { getOrFetchUser, getUserFromCache } from '@/lib/userCache';
import type { User } from '@/types';

const CHANNEL_SUBSCRIBE_CATCHUP_MAX_AGE_MS = 12_000;

export const useRealtimeMessages = (channelId: string | null) => {
  const isSettingUpRef = useRef(false);
  const lastSubscribeAtRef = useRef<number>(0);
  const lastEventAtRef = useRef<number>(0);

  useEffect(() => {
    if (!channelId) {
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
              lastEventAtRef.current = Date.now();
              
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
                
                // IMPORTANT: Don't block on fetching user data; add message immediately.
                // We'll hydrate the author in the background if needed.
                const localUser = useAuthStore.getState().user;
                const cachedUser = getUserFromCache(newMsg.user_id);
                let user: User | null =
                  localUser?.id === newMsg.user_id ? (localUser as any as User) : cachedUser;

                if (!user) {
                  const nowIso = new Date().toISOString();
                  user = {
                    id: newMsg.user_id,
                    username: 'unknown',
                    display_name: null,
                    avatar_url: null,
                    banner_url: null,
                    avatar_decoration: null,
                    profile_effect: null,
                    banner_color: '#111111',
                    profile_theme_primary: null,
                    profile_theme_accent: null,
                    bio: null,
                    status: 'offline',
                    custom_status: null,
                    created_at: nowIso,
                    last_seen: null,
                  } satisfies User;
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

                // Hydrate author info asynchronously (no UI delay).
                if (!cachedUser && localUser?.id !== newMsg.user_id) {
                  void getOrFetchUser(newMsg.user_id)
                    .then((u) => {
                      if (!u) return;
                      useMessageStore.getState().updateMessage(newMsg.id, { user: u } as any);
                    })
                    .catch(() => undefined);
                }
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
            lastSubscribeAtRef.current = Date.now();
            lastEventAtRef.current = Date.now();

            // Catch up channel state after (re)subscribe if cache is missing/stale.
            const store = useMessageStore.getState();
            const cacheEntry = store.messagesByChannel[channelId];
            const hasCached = (cacheEntry?.messages?.length ?? 0) > 0;
            const isFreshEnough =
              !!cacheEntry && Date.now() - cacheEntry.lastFetched < CHANNEL_SUBSCRIBE_CATCHUP_MAX_AGE_MS;
            if (!hasCached || !isFreshEnough) {
              void store.fetchMessages(channelId, 50, undefined, true, hasCached).catch(() => undefined);
            }
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
            if (err) {
              console.warn('[Realtime] Messages subscribe error:', {
                channelId,
                status,
                message: (err as any)?.message,
                name: (err as any)?.name,
                cause: (err as any)?.cause,
                details: err,
              });
            } else {
              console.warn('[Realtime] Messages subscribe status:', { channelId, status });
            }
            if (retryCount < MAX_RETRIES) {
              retryCount++;
              console.log(`[Realtime] Retrying messages subscription (status=${status}, attempt ${retryCount}/${MAX_RETRIES})...`);
              retryTimeout = setTimeout(() => {
                setupSubscription();
              }, RETRY_DELAY * retryCount);
            } else {
              console.warn('[Realtime] Max retries reached for messages subscription. Continuing without realtime messages.');
            }
          }
        });
    };

    setupSubscription();

    // Handle visibility changes to ensure subscription stays active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && channel) {
        // Browsers may pause/throttle websocket in background. On restore,
        // best-effort re-establish to avoid "stuck" realtime without refresh.
        try {
          const channelState = (channel as any).state;
          if (channelState === 'closed' || channelState === 'errored' || channelState === 'timed_out') {
            console.log('[Realtime] Visibility restored; re-establishing messages subscription');
            setupSubscription();
          }
        } catch {
          // If we can't check state, try to re-establish anyway.
          console.log('[Realtime] Visibility restored; re-establishing messages subscription (state unknown)');
          setupSubscription();
        }

        // MessageList already handles visibility-based catch-up fetches.
        // Keep realtime recovery here limited to subscription health.
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
  }, [channelId]);
};
