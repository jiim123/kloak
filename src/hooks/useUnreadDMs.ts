import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DMUnreadInfo {
  conversationId: string;
  unreadCount: number;
  lastReadAt: string | null;
}

interface UnreadDMState {
  [conversationId: string]: DMUnreadInfo;
}

export const useUnreadDMs = (userId: string | null) => {
  const [unreadState, setUnreadState] = useState<UnreadDMState>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchUnreadCounts = useCallback(async () => {
    if (!userId) {
      setUnreadState({});
      setIsLoading(false);
      return;
    }

    try {
      // Get all conversations where user is a participant
      const { data: participations, error: partError } = await supabase
        .from('dm_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId);

      if (partError) throw partError;
      if (!participations || participations.length === 0) {
        setUnreadState({});
        setIsLoading(false);
        return;
      }

      // Build unread counts for each conversation
      const newState: UnreadDMState = {};

      for (const participation of participations) {
        const { conversation_id, last_read_at } = participation;

        // Count messages newer than last_read_at
        let query = supabase
          .from('direct_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conversation_id)
          .neq('sender_id', userId); // Don't count own messages

        if (last_read_at) {
          query = query.gt('created_at', last_read_at);
        }

        const { count, error } = await query;

        if (!error) {
          newState[conversation_id] = {
            conversationId: conversation_id,
            unreadCount: count || 0,
            lastReadAt: last_read_at,
          };
        }
      }

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

      // Update local state
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
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  // Reconcile on app focus / tab restore (realtime can be lossy during sleep/background)
  useEffect(() => {
    const handleFocus = () => fetchUnreadCounts();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnreadCounts();
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchUnreadCounts]);

  // Subscribe to dm_participants changes for real-time sync
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dm-unreads:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dm_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Refetch when last_read_at changes
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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
