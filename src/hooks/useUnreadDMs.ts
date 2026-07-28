import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';
import { isKloakSocketEnabled, kloakSocket } from '@/lib/kloakSocket';

interface DMUnreadInfo {
  conversationId: string;
  unreadCount: number;
  lastReadAt: string | null;
}

interface UnreadDMState {
  [conversationId: string]: DMUnreadInfo;
}

type BroadcastMutationOp = "INSERT" | "UPDATE" | "DELETE";

type DmParticipantBroadcastRow = {
  id?: string;
  user_id?: string;
  conversation_id?: string;
  last_read_at?: string | null;
};

type BroadcastMutationPayload<T> = {
  op?: BroadcastMutationOp;
  new?: T;
  old?: T;
};

type DmUnreadSocketPayload = {
  conversation_id?: string;
  sender_id?: string;
  unread_count_delta?: number;
};

const REFETCH_COOLDOWN_MS = 5000;

export const useUnreadDMs = (userId: string | null) => {
  const [unreadState, setUnreadState] = useState<UnreadDMState>({});
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const queuedRef = useRef(false);

  const fetchUnreadCounts = useCallback(async ({ force = false } = {}) => {
    if (!userId) {
      setUnreadState({});
      setIsLoading(false);
      return;
    }

    // Cooldown to prevent burst queries
    const now = Date.now();
    if (!force && now - lastFetchRef.current < REFETCH_COOLDOWN_MS) {
      return;
    }
    lastFetchRef.current = now;

    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }

    const p = (async () => {
    try {
      let data: unknown;
      let error: unknown = null;
      if (isKloakSocketEnabled()) {
        try {
          data = await kloakSocket.getDmUnreadCounts();
        } catch {
          ({ data, error } = await supabase.rpc('get_dm_unread_counts', {
            _user_id: userId,
          }));
        }
      } else {
        ({ data, error } = await supabase.rpc('get_dm_unread_counts', {
          _user_id: userId,
        }));
      }

      if (error) {
        console.error('Failed to fetch DM unread counts:', error);
        return;
      }

      const newState: UnreadDMState = {};
      (Array.isArray(data) ? data : []).forEach((row: { conversation_id: string; unread_count: number; last_read_at: string | null }) => {
        newState[row.conversation_id] = {
          conversationId: row.conversation_id,
          unreadCount: Number(row.unread_count),
          lastReadAt: row.last_read_at,
        };
      });

      setUnreadState(newState);
    } catch (error) {
      console.error('Failed to fetch DM unread counts:', error);
    } finally {
      setIsLoading(false);
    }
    })();

    inFlightRef.current = p;
    try {
      await p;
    } finally {
      if (inFlightRef.current === p) inFlightRef.current = null;
      if (queuedRef.current) {
        queuedRef.current = false;
        fetchUnreadCounts({ force: true });
      }
    }
  }, [userId]);

  // Mark a conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!userId) return;

    try {
      if (isKloakSocketEnabled()) {
        await kloakSocket.markDmRead(conversationId);
      } else {
        const { error } = await supabase.rpc('mark_dm_read', {
          _conversation_id: conversationId,
          _user_id: userId,
        });

        if (error) throw error;
      }

      // Update local state optimistically
      setUnreadState((prev) => ({
        ...prev,
        [conversationId]: {
          ...prev[conversationId],
          conversationId,
          unreadCount: 0,
          lastReadAt: new Date().toISOString(),
        },
      }));
    } catch (error) {
      console.error('Failed to mark DM as read:', error);
    }
  }, [userId]);

  // Increment unread count for a conversation (called on new message)
  const incrementUnread = useCallback((conversationId: string) => {
    setUnreadState((prev) => ({
      ...prev,
      [conversationId]: {
        ...prev[conversationId],
        conversationId,
        unreadCount: (prev[conversationId]?.unreadCount || 0) + 1,
        lastReadAt: prev[conversationId]?.lastReadAt || null,
      },
    }));
  }, []);

  // Get unread count for a specific conversation
  const getUnreadCount = useCallback((conversationId: string): number => {
    return unreadState[conversationId]?.unreadCount || 0;
  }, [unreadState]);

  // Get total unread DMs across all conversations
  const totalUnread = useMemo(() => {
    return Object.values(unreadState).reduce((sum, info) => sum + info.unreadCount, 0);
  }, [unreadState]);

  // Has any unread DMs
  const hasUnread = useMemo(() => {
    return totalUnread > 0;
  }, [totalUnread]);

  // Fetch on mount and when userId changes
  useEffect(() => {
    fetchUnreadCounts({ force: true });
  }, [fetchUnreadCounts]);

  // Reconcile on visibility change only (removed duplicate focus listener)
  useEffect(() => {
    let hiddenAt: number | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }

      if (document.visibilityState !== 'visible') return;
      if (hiddenAt) {
        const hiddenFor = Date.now() - hiddenAt;
        hiddenAt = null;
        if (hiddenFor > 0 && hiddenFor < 15000) return;
      }

      fetchUnreadCounts();
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchUnreadCounts]);

  useEffect(() => {
    if (!userId || !isKloakSocketEnabled()) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void kloakSocket
      .subscribe(`user:${userId}`, (event) => {
        if (event.event === "dm.read") {
          const payload = event.payload as { conversation_id?: string };
          const conversationId = payload?.conversation_id;
          if (!conversationId) return;
          setUnreadState((prev) => ({
            ...prev,
            [conversationId]: {
              conversationId,
              unreadCount: 0,
              lastReadAt: new Date().toISOString(),
            },
          }));
          return;
        }

        if (event.event !== "dm.unread") return;
        const payload = event.payload as DmUnreadSocketPayload;
        const conversationId = payload?.conversation_id;
        if (!conversationId || payload.sender_id === userId) return;
        const unreadDelta = Math.max(1, Number(payload.unread_count_delta ?? 1));

        setUnreadState((prev) => ({
          ...prev,
          [conversationId]: {
            ...prev[conversationId],
            conversationId,
            unreadCount: (prev[conversationId]?.unreadCount || 0) + unreadDelta,
            lastReadAt: prev[conversationId]?.lastReadAt || null,
          },
        }));

      })
      .then((off) => {
        if (cancelled) off();
        else unsubscribe = off;
      })
      .catch((error) => {
        console.warn("[KloakWS] Failed to subscribe to DM unread fanout", error);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId]);
  // Subscribe to user-scoped DM participant updates via Broadcast.
  // Goes through sharedChannel so we co-own `user:${userId}` with useUnread et al.
  useEffect(() => {
    if (!userId || isKloakSocketEnabled()) return;

    const topic = `user:${userId}`;
    const channel = acquireChannel(topic);
    channel.on(
      "broadcast",
      { event: "dm_participants" },
      ({ payload }) => {
        const eventPayload = payload as BroadcastMutationPayload<DmParticipantBroadcastRow>;
        const op = eventPayload?.op;
        if (!op) return;

        if (op === "INSERT") {
          fetchUnreadCounts({ force: true });
          return;
        }

        const row = op === "DELETE" ? eventPayload.old : eventPayload.new;
        const conversationId = row?.conversation_id;
        if (!conversationId) {
          fetchUnreadCounts({ force: true });
          return;
        }

        if (op === "DELETE") {
          setUnreadState((prev) => {
            const { [conversationId]: _, ...rest } = prev;
            return rest;
          });
          return;
        }

        // last_read_at updates should clear local unread count for that conversation.
        setUnreadState((prev) => ({
          ...prev,
          [conversationId]: {
            conversationId,
            unreadCount: 0,
            lastReadAt: row?.last_read_at ?? prev[conversationId]?.lastReadAt ?? null,
          },
        }));
      },
    );
    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [userId, fetchUnreadCounts]);

  return {
    unreadState,
    isLoading,
    markAsRead,
    incrementUnread,
    getUnreadCount,
    totalUnread,
    hasUnread,
    refetch: fetchUnreadCounts,
  };
};


