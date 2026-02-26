import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useFriendStore } from '@/stores/friendStore';
import type { Message } from '@/types';

type PinnedCacheEntry = {
  fetchedAt: number;
  items: Message[];
  inFlight?: Promise<Message[]>;
};

type PinnedMessageRow = Omit<Message, "attachments"> & {
  attachments?: Message["attachments"];
};

const PINNED_CACHE_TTL_MS = 120_000;
const pinnedCache = new Map<string, PinnedCacheEntry>();
const pinnedCacheKey = (channelId: string, userId: string) => `${userId}:${channelId}`;

type BroadcastMutationOp = 'INSERT' | 'UPDATE' | 'DELETE';

type MessageBroadcastRow = {
  id: string;
  channel_id: string;
  is_pinned?: boolean | null;
};

type BroadcastMutationPayload<T> = {
  op?: BroadcastMutationOp;
  new?: T;
  old?: T;
};

export const useRealtimePinnedMessages = (channelId: string | null) => {
  const userId = useAuthStore((s) => s.user?.id);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const pinnedIdsRef = useRef<Set<string>>(new Set());
  const listenerScopeRef = useRef(`pinned-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    pinnedIdsRef.current = new Set(pinnedMessages.map((m) => m.id));
  }, [pinnedMessages]);

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
      const messageRows = Array.isArray(data) ? (data as unknown as PinnedMessageRow[]) : [];
      return messageRows.map((msg) => ({
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

    const topic = `chat:${channelId}`;
    const filter = { event: "messages", scope: listenerScopeRef.current };
    const channel = supabase.channel(topic).on(
      "broadcast",
      filter as { event: string },
      ({ payload }) => {
        const eventPayload = payload as BroadcastMutationPayload<MessageBroadcastRow>;
        const op = eventPayload?.op;
        if (!op) return;

        if (op === "INSERT") {
          if (eventPayload.new?.is_pinned) {
            fetchPinnedMessages({ force: true });
          }
          return;
        }

        if (op === "UPDATE") {
          const updatedMessage = eventPayload.new;
          if (!updatedMessage?.id) return;
          if (updatedMessage.is_pinned || pinnedIdsRef.current.has(updatedMessage.id)) {
            fetchPinnedMessages({ force: true });
          }
          return;
        }

        if (op === "DELETE") {
          const oldId = eventPayload.old?.id;
          if (oldId && pinnedIdsRef.current.has(oldId)) {
            fetchPinnedMessages({ force: true });
          }
        }
      },
    );
    // NOTE: `chat:${channelId}` is shared and subscribed by `useRealtimeMessages`.
    // Do not call `.subscribe()` or `removeChannel()` here to avoid channel ownership conflicts.

    return () => {
      (channel as unknown as { _off?: (type: string, filter: Record<string, unknown>) => void })._off?.(
        "broadcast",
        filter,
      );
    };
  }, [channelId, fetchPinnedMessages]);

  const refetch = useCallback(() => fetchPinnedMessages({ force: true }), [fetchPinnedMessages]);

  return { pinnedMessages, isLoading, refetch };
};
