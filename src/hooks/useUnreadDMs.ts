import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

const REFETCH_COOLDOWN_MS = 5000;
const DM_UNREAD_POLL_INTERVAL_MS = 120000;

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
      // Use batched RPC call instead of N+1 queries
      const { data, error } = await supabase.rpc('get_dm_unread_counts', {
        _user_id: userId,
      });

      if (error) {
        console.error('Failed to fetch DM unread counts:', error);
        return;
      }

      const newState: UnreadDMState = {};
      (data || []).forEach((row: { conversation_id: string; unread_count: number; last_read_at: string | null }) => {
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
      const { error } = await supabase.rpc('mark_dm_read', {
        _conversation_id: conversationId,
        _user_id: userId,
      });

      if (error) throw error;

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

  // Subscribe to user-scoped DM participant updates via Broadcast.
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user:${userId}`)
      .on(
        'broadcast',
        { event: 'dm_participants' },
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
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCounts]);

  // Periodic refresh (safety net if events are missed)
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchUnreadCounts();
    }, DM_UNREAD_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
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
