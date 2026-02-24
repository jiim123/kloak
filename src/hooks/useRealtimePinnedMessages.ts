import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useFriendStore } from '@/stores/friendStore';
import type { Message } from '@/types';

type PinnedCacheEntry = {
  fetchedAt: number;
  items: Message[];
  inFlight?: Promise<Message[]>;
};

const PINNED_CACHE_TTL_MS = 120_000;
const pinnedCache = new Map<string, PinnedCacheEntry>();
const pinnedCacheKey = (channelId: string, userId: string) => `${userId}:${channelId}`;

export const useRealtimePinnedMessages = (channelId: string | null) => {
  const userId = useAuthStore((s) => s.user?.id);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPinnedMessages = useCallback(async (opts?: { force?: boolean }) => {
    if (!channelId || !userId) {
      setPinnedMessages([]);
      setIsLoading(false);
      return;
    }

    const force = opts?.force === true;
    const key = pinnedCacheKey(channelId, userId);
    const existing = pinnedCache.get(key);

    if (!force && existing && Date.now() - existing.fetchedAt < PINNED_CACHE_TTL_MS) {
      setPinnedMessages(existing.items);
      setIsLoading(false);
      return;
    }

    if (existing?.inFlight) {
      if (!existing.items.length) setIsLoading(true);
      try {
        const data = await existing.inFlight;
        setPinnedMessages(data);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (!(existing?.items?.length ?? 0)) {
      setIsLoading(true);
    }

    const inFlight = (async (): Promise<Message[]> => {
      const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
      const { data, error } = await supabase.rpc('get_pinned_messages_secure', {
        _channel_id: channelId,
        _user_id: userId,
        _blocked_user_ids: blockedUserIds,
      });

      if (error) throw error;
      const messageRows = Array.isArray(data) ? data : [];
      return messageRows.map((msg: any) => ({
        ...msg,
        user: msg.user,
        attachments: msg.attachments || [],
      }));
    })();

    pinnedCache.set(key, {
      fetchedAt: existing?.fetchedAt ?? 0,
      items: existing?.items ?? [],
      inFlight,
    });

    try {
      const messages = await inFlight;
      pinnedCache.set(key, {
        fetchedAt: Date.now(),
        items: messages,
      });
      setPinnedMessages(messages);
    } catch (error) {
      console.error('Failed to fetch pinned messages:', error);
    } finally {
      setIsLoading(false);
      const after = pinnedCache.get(key);
      if (after?.inFlight === inFlight) {
        delete after.inFlight;
        pinnedCache.set(key, after);
      }
    }
  }, [channelId, userId]);

  useEffect(() => {
    fetchPinnedMessages();
  }, [fetchPinnedMessages]);

  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`pinned:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const updatedMessage = payload.new as any;
          const previousMessage = payload.old as any;
          if (!updatedMessage) return;

          const pinToggled = previousMessage?.is_pinned !== updatedMessage.is_pinned;
          const pinnedMessageEdited =
            updatedMessage.is_pinned === true &&
            (previousMessage?.content !== updatedMessage.content ||
              previousMessage?.edited_at !== updatedMessage.edited_at);

          if (pinToggled || pinnedMessageEdited) {
            fetchPinnedMessages({ force: true });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, fetchPinnedMessages]);

  const refetch = useCallback(() => fetchPinnedMessages({ force: true }), [fetchPinnedMessages]);

  return { pinnedMessages, isLoading, refetch };
};
