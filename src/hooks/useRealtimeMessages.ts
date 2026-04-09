import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
import { useFriendStore } from '@/stores/friendStore';
import { useAuthStore } from '@/stores/authStore';
import { useServerStore } from '@/stores/serverStore';
import { useUserCacheStore } from '@/stores/userCacheStore';
import { resolveSignedUrls, isSupabaseAttachmentUrl } from '@/lib/signedUrl';
import type { Message } from '@/types';
import { fetchAndCacheUser, getUserFromCache, getOrFetchUser } from '@/stores/userCacheStore';
import type { User } from '@/types';
import { canRevealGhostIdentityForUser, getGhostPseudonymousUserId } from '@/lib/ghostIdentity';

const CHANNEL_SUBSCRIBE_CATCHUP_MAX_AGE_MS = 5 * 60_000;
const MIN_CATCHUP_FETCH_GAP_MS = 30_000;
const BROADCAST_RESYNC_INTERVAL_MS = 12_000;
const MIN_BROADCAST_RESYNC_GAP_MS = 6_000;

type BroadcastMutationOp = 'INSERT' | 'UPDATE' | 'DELETE';

type MessageBroadcastRow = {
  id: string;
  channel_id: string;
  user_id: string;
  reply_to_id?: string | null;
  content: string;
  is_pinned?: boolean | null;
  is_system_message?: boolean | null;
  edited_at?: string | null;
  created_at: string;
};

type ReactionBroadcastRow = {
  id?: string;
  message_id?: string;
  user_id?: string;
  emoji?: string;
  channel_id?: string;
};

type BroadcastMutationPayload<T> = {
  op?: BroadcastMutationOp;
  new?: T;
  old?: T;
};

export const useRealtimeMessages = (channelId: string | null) => {
  const isSettingUpRef = useRef(false);
  const lastSubscribeAtRef = useRef<number>(0);
  const lastEventAtRef = useRef<number>(0);
  const lastCatchupFetchAtRef = useRef<number>(0);
  const isSubscribedRef = useRef(false);
  const lastBroadcastResyncAtRef = useRef<number>(0);
  const listenerScopeRef = useRef(`messages-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!channelId) {
      return;
    }

    let isActive = true;
    let isIntentionalClose = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const RETRY_BASE_DELAY_MS = 2000;
    const RETRY_MAX_DELAY_MS = 60000;
    const messageFilter = { event: "messages", scope: listenerScopeRef.current };
    const reactionFilter = { event: "reactions", scope: listenerScopeRef.current };

    const removeScopedBindings = (target: ReturnType<typeof supabase.channel> | null) => {
      if (!target) return;
      const internal = target as unknown as { _off?: (type: string, filter: Record<string, unknown>) => void };
      internal._off?.("broadcast", messageFilter);
      internal._off?.("broadcast", reactionFilter);
    };

    const scheduleRetry = (status: 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT') => {
      if (!isActive) return;
      retryCount += 1;
      const delay = Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * Math.pow(2, retryCount - 1));
      console.log(
        `[Realtime] Retrying messages subscription (status=${status}, attempt ${retryCount}, delay=${delay}ms)...`,
      );
      if (retryTimeout) clearTimeout(retryTimeout);
      retryTimeout = setTimeout(() => {
        if (!isActive) return;
        setupSubscription();
      }, delay);
    };

    const setupSubscription = () => {
      // Prevent duplicate setup
      if (isSettingUpRef.current) {
        return;
      }
      isSettingUpRef.current = true;

      // Clean up existing subscription if any
      if (channel) {
        try {
          // Shared topic: remove only this hook's listeners.
          removeScopedBindings(channel);
        } catch {
          // Ignore cleanup errors
        }
      }

      console.log('[Realtime] Setting up chat broadcast subscription for channel:', channelId);

      channel = supabase
        .channel(`chat:${channelId}`, {
          config: {
            broadcast: { self: false },
          },
        })
        .on(
          'broadcast',
          messageFilter as { event: string },
          async ({ payload }) => {
            try {
              const eventPayload = payload as BroadcastMutationPayload<MessageBroadcastRow>;
              const eventType = eventPayload?.op;
              if (!eventType) return;
              lastEventAtRef.current = Date.now();
               
              if (eventType === 'INSERT') {
                const newMsg = eventPayload.new;
                if (!newMsg?.id || !newMsg.user_id || !newMsg.created_at) return;
                
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
                const serverState = useServerStore.getState();
                const isGhostMode =
                  serverState.currentChannel?.id === channelId && !!serverState.currentChannel?.ghost_mode;
                const revealIdentity = canRevealGhostIdentityForUser({
                  isGhostMode,
                  authorUserId: newMsg.user_id,
                  members: serverState.members,
                  ownerId: serverState.currentServer?.owner_id,
                });
                const ghostUserId = getGhostPseudonymousUserId(newMsg.user_id, channelId);
                const cachedUser = getUserFromCache(newMsg.user_id);
                let userForCache: User | null = null;

                if (!revealIdentity) {
                  // Ghost mode: no user data to cache
                } else {
                  userForCache = localUser?.id === newMsg.user_id ? (localUser as unknown as User) : cachedUser;
                  if (userForCache) {
                    useUserCacheStore.getState().upsertUser(userForCache);
                  }
                }
                
                // Build message WITHOUT user object — components look up from cache
                const message: Message = {
                  id: newMsg.id,
                  channel_id: newMsg.channel_id,
                  user_id: revealIdentity ? newMsg.user_id : ghostUserId,
                  is_own: localUser?.id === newMsg.user_id,
                  reply_to_id: newMsg.reply_to_id,
                  content: newMsg.content,
                  is_pinned: newMsg.is_pinned || false,
                  is_system_message: newMsg.is_system_message || false,
                  edited_at: newMsg.edited_at,
                  created_at: newMsg.created_at,
                  // user data lives in cache, not on message
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
                      user_id: replyMsg.user_id,
                    };
                  }
                }
                
                useMessageStore.getState().addMessage(message);

                // Pre-warm signed URL cache for any attachment URLs embedded in content
                // so MessageContent resolves them from cache instantly.
                const urlMatches = (newMsg.content || '').match(/https?:\/\/[^\s<>"]+/g);
                if (urlMatches) {
                  const attachmentUrls = urlMatches.filter(isSupabaseAttachmentUrl);
                  if (attachmentUrls.length > 0) {
                    resolveSignedUrls(attachmentUrls).catch(() => {});
                  }
                }

                // Hydrate author info into cache asynchronously (no UI delay).
                if (revealIdentity && !cachedUser && localUser?.id !== newMsg.user_id) {
                  void getOrFetchUser(newMsg.user_id)
                    .then((u) => {
                      if (!u) return;
                      useUserCacheStore.getState().upsertUser(u);
                    })
                    .catch(() => undefined);
                }
              } else if (eventType === 'UPDATE') {
                const updated = eventPayload.new;
                if (!updated?.id || !updated.channel_id) return;
                
                // Server-side filter should already ensure this, but keep as a guard.
                if (updated.channel_id !== channelId) return;
                
                useMessageStore.getState().updateMessage(updated.id, {
                  content: updated.content,
                  edited_at: updated.edited_at,
                  is_pinned: updated.is_pinned ?? false,
                });
              } else if (eventType === 'DELETE') {
                const oldData = eventPayload.old as { id?: string; channel_id?: string } | undefined;
                
                if (oldData?.id) {
                  useMessageStore.getState().removeMessage(oldData.id);
                }
              }
            } catch (error) {
              console.error('[Realtime] Error processing message event:', error);
            }
          }
        )
        .on(
          'broadcast',
          reactionFilter as { event: string },
          ({ payload }) => {
            try {
              const eventPayload = payload as BroadcastMutationPayload<ReactionBroadcastRow>;
              const eventType = eventPayload?.op;
              if (!eventType) return;
              lastEventAtRef.current = Date.now();
              const currentUserId = useAuthStore.getState().user?.id;

              if (eventType === 'INSERT' || eventType === 'UPDATE') {
                const newReaction = eventPayload.new;
                if (!newReaction?.message_id || !newReaction?.user_id || !newReaction?.emoji) return;
                if (newReaction.channel_id && newReaction.channel_id !== channelId) return;

                const serverState = useServerStore.getState();
                const isGhostMode =
                  serverState.currentChannel?.id === channelId && !!serverState.currentChannel?.ghost_mode;
                const revealIdentity = canRevealGhostIdentityForUser({
                  isGhostMode,
                  authorUserId: newReaction.user_id,
                  members: serverState.members,
                  ownerId: serverState.currentServer?.owner_id,
                });
                const effectiveReactionUserId = revealIdentity
                  ? newReaction.user_id
                  : getGhostPseudonymousUserId(newReaction.user_id, channelId);

                const { messagesByChannel } = useMessageStore.getState();
                const channelData = messagesByChannel[channelId];
                if (!channelData) return;

                const messageIndex = channelData.messages.findIndex((m) => m.id === newReaction.message_id);
                if (messageIndex === -1) return;

                const message = channelData.messages[messageIndex];
                const reactions = [...(message.reactions || [])];
                const existingGroup = reactions.find((r) => r.emoji === newReaction.emoji);

                if (existingGroup) {
                  if (!existingGroup.users.includes(effectiveReactionUserId)) {
                    existingGroup.count++;
                    existingGroup.users.push(effectiveReactionUserId);
                  }
                  if (newReaction.user_id === currentUserId) {
                    existingGroup.hasReacted = true;
                  }
                } else {
                  reactions.push({
                    emoji: newReaction.emoji,
                    count: 1,
                    users: [effectiveReactionUserId],
                    hasReacted: newReaction.user_id === currentUserId,
                  });
                }

                useMessageStore
                  .getState()
                  .updateMessage(newReaction.message_id, { reactions, channel_id: channelId } as Partial<Message>);
                return;
              }

              if (eventType !== 'DELETE') return;
              const oldReaction = eventPayload.old as ReactionBroadcastRow | undefined;
              if (oldReaction?.channel_id && oldReaction.channel_id !== channelId) return;
              if (!oldReaction) return;

              if (oldReaction.message_id && oldReaction.emoji && oldReaction.user_id) {
                const serverState = useServerStore.getState();
                const isGhostMode =
                  serverState.currentChannel?.id === channelId && !!serverState.currentChannel?.ghost_mode;
                const revealIdentity = canRevealGhostIdentityForUser({
                  isGhostMode,
                  authorUserId: oldReaction.user_id,
                  members: serverState.members,
                  ownerId: serverState.currentServer?.owner_id,
                });
                const effectiveReactionUserId = revealIdentity
                  ? oldReaction.user_id
                  : getGhostPseudonymousUserId(oldReaction.user_id, channelId);

                const { messagesByChannel } = useMessageStore.getState();
                const channelData = messagesByChannel[channelId];
                if (!channelData) return;

                const message = channelData.messages.find((m) => m.id === oldReaction.message_id);
                if (!message) return;

                const reactions = (message.reactions || [])
                  .map((r) => {
                    if (r.emoji !== oldReaction.emoji) return r;
                    if (!r.users.includes(effectiveReactionUserId)) return r;
                    return {
                      ...r,
                      count: Math.max(0, r.count - 1),
                      users: r.users.filter((u) => u !== effectiveReactionUserId),
                      hasReacted: oldReaction.user_id === currentUserId ? false : r.hasReacted,
                    };
                  })
                  .filter((r) => r.count > 0);

                useMessageStore
                  .getState()
                  .updateMessage(oldReaction.message_id, { reactions, channel_id: channelId } as Partial<Message>);
              } else if (oldReaction.id) {
                // Fallback when delete payload is partial.
                const { messagesByChannel } = useMessageStore.getState();
                const channelData = messagesByChannel[channelId];
                if (!channelData) return;

                const messageIds = channelData.messages.filter((m) => (m.reactions?.length ?? 0) > 0).map((m) => m.id);
                if (messageIds.length === 0) return;

                supabase
                  .from('reactions')
                  .select('message_id, user_id, emoji')
                  .in('message_id', messageIds)
                  .then(({ data, error }) => {
                    if (error) {
                      console.error('[Realtime] Failed to refetch reactions:', error);
                      return;
                    }

                    const serverState = useServerStore.getState();
                    const isGhostMode =
                      serverState.currentChannel?.id === channelId && !!serverState.currentChannel?.ghost_mode;
                    const reactionsByMessage = new Map<
                      string,
                      { emoji: string; count: number; users: string[]; hasReacted: boolean }[]
                    >();

                    for (const msgId of messageIds) {
                      reactionsByMessage.set(msgId, []);
                    }

                    for (const row of data || []) {
                      const revealIdentity = canRevealGhostIdentityForUser({
                        isGhostMode,
                        authorUserId: row.user_id,
                        members: serverState.members,
                        ownerId: serverState.currentServer?.owner_id,
                      });
                      const effectiveReactionUserId = revealIdentity
                        ? row.user_id
                        : getGhostPseudonymousUserId(row.user_id, channelId);

                      let msgReactions = reactionsByMessage.get(row.message_id);
                      if (!msgReactions) {
                        msgReactions = [];
                        reactionsByMessage.set(row.message_id, msgReactions);
                      }
                      const existing = msgReactions.find((r) => r.emoji === row.emoji);
                      if (existing) {
                        existing.count++;
                        existing.users.push(effectiveReactionUserId);
                        if (row.user_id === currentUserId) existing.hasReacted = true;
                      } else {
                        msgReactions.push({
                          emoji: row.emoji,
                          count: 1,
                          users: [effectiveReactionUserId],
                          hasReacted: row.user_id === currentUserId,
                        });
                      }
                    }

                    const store = useMessageStore.getState();
                    for (const [msgId, reactions] of reactionsByMessage) {
                      store.updateMessage(msgId, { reactions, channel_id: channelId } as Partial<Message>);
                    }
                  });
              }
            } catch (error) {
              console.error('[Realtime] Error processing reaction event:', error);
            }
          },
        );

      const channelState = (channel as unknown as { state?: string }).state;
      if (channelState && channelState !== 'closed') {
        isSettingUpRef.current = false;
        isSubscribedRef.current = channelState === 'joined';
        return;
      }

      channel.subscribe((status, err) => {
        if (!isActive) return;
        isSettingUpRef.current = false;
        
        if (status === 'SUBSCRIBED') {
          isIntentionalClose = false;
          isSubscribedRef.current = true;
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
          const now = Date.now();
          const canRunCatchup = now - lastCatchupFetchAtRef.current >= MIN_CATCHUP_FETCH_GAP_MS;
          if ((!hasCached || !isFreshEnough) && canRunCatchup) {
            lastCatchupFetchAtRef.current = now;
            void store.fetchMessages(channelId, 50, undefined, true, hasCached, true).catch(() => undefined);
          }
        } else if (status === 'CLOSED') {
          isSubscribedRef.current = false;
          // CLOSED is expected during channel switch/unmount cleanup.
          if (!isIntentionalClose) {
            console.warn('[Realtime] Messages channel closed unexpectedly:', { channelId, status });
            scheduleRetry(status);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          isSubscribedRef.current = false;
          const details = err as { message?: string; name?: string; cause?: unknown } | undefined;
          if (err) {
            console.warn('[Realtime] Messages subscribe error:', {
              channelId,
              status,
              message: details?.message,
              name: details?.name,
              cause: details?.cause,
              details: err,
            });
          } else {
            console.warn('[Realtime] Messages subscribe status:', { channelId, status });
          }
          scheduleRetry(status);
        }
      });
    };

    setupSubscription();

    // Single bounded fallback sync: run only when subscription is unhealthy.
    const broadcastResyncInterval = setInterval(() => {
      if (!isActive) return;
      if (document.visibilityState !== 'visible') return;
      if (isSubscribedRef.current) return;

      const now = Date.now();
      if (now - lastBroadcastResyncAtRef.current < MIN_BROADCAST_RESYNC_GAP_MS) return;
      lastBroadcastResyncAtRef.current = now;

      const store = useMessageStore.getState();
      const hasCached = (store.messagesByChannel[channelId]?.messages?.length ?? 0) > 0;
      void store.fetchMessages(channelId, 20, undefined, true, hasCached, true).catch(() => undefined);
    }, BROADCAST_RESYNC_INTERVAL_MS);

    // Handle visibility changes to ensure subscription stays active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && channel) {
        // Browsers may pause/throttle websocket in background. On restore,
        // best-effort re-establish to avoid "stuck" realtime without refresh.
        try {
          const channelState = (channel as unknown as { state?: string }).state;
          if (channelState === 'closed' || channelState === 'errored' || channelState === 'timed_out') {
            // Silent re-establish on tab return
            setupSubscription();
          }
        } catch {
          // If we can't check state, try to re-establish anyway.
          // Silent re-establish on tab return
          setupSubscription();
        }

        // MessageList already handles visibility-based catch-up fetches.
        // Keep realtime recovery here limited to subscription health.
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isActive = false;
      isIntentionalClose = true;
      isSubscribedRef.current = false;
      isSettingUpRef.current = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      clearInterval(broadcastResyncInterval);
      if (channel) {
        try {
          removeScopedBindings(channel);
          supabase.removeChannel(channel);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    };
  }, [channelId]);
};
