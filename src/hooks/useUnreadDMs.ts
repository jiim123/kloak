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

const REFETCH_COOLDOWN_MS = 5000;

export const useUnreadDMs = (userId: string | null) => {
  const [unreadState, setUnreadState] = useState<UnreadDMState>({});
  const [isLoading, setIsLoading] = useState(true);
  const lastFetchRef = useRef(0);

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
  }, [userId]);

  // Mark a conversation as read
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!userId) return;

    try {
      // Prefer SECURITY DEFINER RPC (this app uses custom auth, not Supabase Auth)
      const { error: rpcError } = await supabase.rpc('mark_dm_read', {
        _conversation_id: conversationId,
        _user_id: userId,
      });

      if (rpcError) {
        // Back-compat fallback (in case migration hasn't been applied yet).
        const { error } = await supabase
          .from('dm_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('user_id', userId);
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
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCounts();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchUnreadCounts]);

  // Subscribe to dm_participants INSERT only (not updates to avoid self-trigger loop)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dm-unreads:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT', // Only new participants, not updates (avoids self-trigger on markAsRead)
          schema: 'public',
          table: 'dm_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // New conversation created, refetch
          fetchUnreadCounts({ force: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCounts]);

  // Periodic refresh (cheap with RPC, avoids stuck counts when realtime is missed)
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchUnreadCounts();
    }, 60000);
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
