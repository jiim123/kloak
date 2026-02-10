import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useFriendStore } from '@/stores/friendStore';

interface ChannelUnreadInfo {
  unreadCount: number;
  mentionCount: number;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  firstUnreadMessageId: string | null;
}

interface UnreadState {
  [channelId: string]: ChannelUnreadInfo;
}

interface ServerUnreadInfo {
  hasUnread: boolean;
  totalMentions: number;
}

// OPTIMIZATION: Increased from 15s to 45s - reduced polling frequency
const UNREAD_POLL_INTERVAL_MS = 45000;
const CHANNEL_READ_EVENT = 'kloak:channel-read';

export const useUnread = (serverChannelIds: string[] = []) => {
  const { user } = useAuthStore();
  const [unreadState, setUnreadState] = useState<UnreadState>({});
  const [isLoading, setIsLoading] = useState(false);
  const channelIdsRef = useRef<string[]>([]);
  const fetchSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const channelIdsKey = [...serverChannelIds].sort().join(',');

  // OPTIMIZATION: Use batch RPC instead of N+1 queries
  // This reduces 50+ queries to a single query per polling cycle
  const fetchUnreadCounts = useCallback(async (opts?: { force?: boolean }) => {
    if (!user || serverChannelIds.length === 0) return;

    // Avoid refetching if channel IDs haven't changed
    const idsString = [...serverChannelIds].sort().join(',');
    const prevIdsString = [...channelIdsRef.current].sort().join(',');
    if (!opts?.force && idsString === prevIdsString && Object.keys(unreadState).length > 0) return;
    
    channelIdsRef.current = [...serverChannelIds];
    const seq = ++fetchSeqRef.current;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setIsLoading(true);

    try {
      // Get blocked user IDs for filtering
      const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;

      // OPTIMIZATION: Single RPC call replaces N individual queries
      const { data, error } = await supabase.rpc('get_all_channel_unread_counts', {
        _user_id: user.id,
        _channel_ids: serverChannelIds,
        _blocked_user_ids: blockedUserIds.length > 0 ? blockedUserIds : [],
      });

      if (error) {
        console.error('Error fetching unread counts:', error);
        throw error;
      }

      if (fetchSeqRef.current !== seq) return;

      const newState: UnreadState = {};
      (data || []).forEach((row: {
        channel_id: string;
        unread_count: number;
        mention_count: number;
        last_read_at: string | null;
        last_read_message_id: string | null;
        first_unread_message_id: string | null;
      }) => {
        newState[row.channel_id] = {
          unreadCount: Number(row.unread_count),
          mentionCount: row.mention_count,
          lastReadMessageId: row.last_read_message_id,
          lastReadAt: row.last_read_at,
          firstUnreadMessageId: row.first_unread_message_id,
        };
      });

      // Ensure all requested channels have an entry (even if no unread)
      serverChannelIds.forEach((channelId) => {
        if (!newState[channelId]) {
          newState[channelId] = {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: null,
            lastReadAt: null,
            firstUnreadMessageId: null,
          };
        }
      });

      setUnreadState(newState);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    } finally {
      if (fetchSeqRef.current === seq) {
        setIsLoading(false);
      }
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        fetchUnreadCounts({ force: true });
      }
    }
  }, [user, serverChannelIds, unreadState]);

  // Mark channel as read
  const markAsRead = useCallback(
    async (channelId: string, lastMessageId?: string) => {
      if (!user) return;

      try {
        // If no lastMessageId provided, get the latest message
        let messageId = lastMessageId;
        if (!messageId) {
          const { data: latestMessage } = await supabase
            .from('messages')
            .select('id')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          messageId = latestMessage?.id;
        }

        if (!messageId) return;

        const now = new Date().toISOString();

        // Prefer SECURITY DEFINER RPC (custom auth app)
        const { error: rpcError } = await supabase.rpc('mark_channel_read', {
          _channel_id: channelId,
          _user_id: user.id,
          _last_read_message_id: messageId,
          _last_read_at: now,
        });

        if (rpcError) {
          // RPC not available yet — log warning but don't fallback to direct writes
          // Direct table writes are blocked by RLS for security
          console.warn('mark_channel_read RPC failed:', rpcError.message);
        }

        setUnreadState((prev) => ({
          ...prev,
          [channelId]: {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: messageId!,
            lastReadAt: now,
            firstUnreadMessageId: null,
          },
        }));

        // Broadcast locally so other `useUnread()` instances (ServerSidebar, etc.)
        // update immediately without waiting for realtime/poll.
        window.dispatchEvent(new CustomEvent(CHANNEL_READ_EVENT, { detail: { channelId, at: now } }));
      } catch (error) {
        console.error('Error marking channel as read:', error);
      }
    },
    [user]
  );

  // Get unread info for a specific channel
  const getChannelUnread = useCallback(
    (channelId: string): ChannelUnreadInfo => {
      return (
        unreadState[channelId] || {
          unreadCount: 0,
          mentionCount: 0,
          lastReadMessageId: null,
          lastReadAt: null,
          firstUnreadMessageId: null,
        }
      );
    },
    [unreadState]
  );

  // Check if any channel has unread messages
  const hasAnyUnread = useCallback(() => {
    return Object.values(unreadState).some((s) => s.unreadCount > 0);
  }, [unreadState]);

  // Get total mention count
  const getTotalMentions = useCallback(() => {
    return Object.values(unreadState).reduce((sum, s) => sum + s.mentionCount, 0);
  }, [unreadState]);

  // Get server-level unread info (for sidebar indicators)
  const getServerUnreadInfo = useCallback(
    (channelIds: string[]): ServerUnreadInfo => {
      let hasUnread = false;
      let totalMentions = 0;

      for (const channelId of channelIds) {
        const info = unreadState[channelId];
        if (info) {
          if (info.unreadCount > 0) hasUnread = true;
          totalMentions += info.mentionCount;
        }
      }

      return { hasUnread, totalMentions };
    },
    [unreadState]
  );

  // Mark all channels in a server as read
  const markServerAsRead = useCallback(
    async (channelIds: string[]) => {
      if (!user || channelIds.length === 0) return;
      
      // Mark all channels in parallel
      await Promise.all(channelIds.map(channelId => markAsRead(channelId)));
    },
    [user, markAsRead]
  );

  // Fetch on mount and when channel IDs change
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts, channelIdsKey]);

  // Poll periodically to keep unread indicators consistent even when realtime misses events.
  useEffect(() => {
    if (!user || serverChannelIds.length === 0) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchUnreadCounts();
    }, UNREAD_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, channelIdsKey, fetchUnreadCounts, serverChannelIds.length]);

  // Subscribe to realtime updates for channel_reads
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('channel-reads-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_reads',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refetch on any change to channel_reads
          channelIdsRef.current = []; // Reset to force refetch
          fetchUnreadCounts({ force: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCounts]);

  // Cross-component sync: when any part of the app marks a channel as read,
  // immediately clear that channel locally if it's in our tracked set.
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ channelId?: string; at?: string }>;
      const channelId = ev.detail?.channelId;
      const at = ev.detail?.at;
      if (!channelId) return;
      if (serverChannelIds.length > 0 && !serverChannelIds.includes(channelId)) return;

      setUnreadState((prev) => ({
        ...prev,
        [channelId]: {
          unreadCount: 0,
          mentionCount: 0,
          lastReadMessageId: prev[channelId]?.lastReadMessageId ?? null,
          lastReadAt: at ?? prev[channelId]?.lastReadAt ?? null,
          firstUnreadMessageId: null,
        },
      }));
    };

    window.addEventListener(CHANNEL_READ_EVENT, handler as EventListener);
    return () => window.removeEventListener(CHANNEL_READ_EVENT, handler as EventListener);
  }, [serverChannelIds]);

  // Reconcile on app focus / tab restore (realtime can be lossy during sleep/background)
  // OPTIMIZATION: Only use visibilitychange (not focus) to avoid double-firing
  // when switching tabs. A single event is sufficient and reduces redundant queries.
  useEffect(() => {
    let lastRefetchTime = 0;
    const REFETCH_COOLDOWN_MS = 5000; // Don't refetch more than once per 5 seconds

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      
      const now = Date.now();
      if (now - lastRefetchTime < REFETCH_COOLDOWN_MS) return;
      lastRefetchTime = now;
      
      fetchUnreadCounts({ force: true });
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchUnreadCounts]);

  return {
    unreadState,
    isLoading,
    markAsRead,
    getChannelUnread,
    hasAnyUnread,
    getTotalMentions,
    getServerUnreadInfo,
    refetch: fetchUnreadCounts,
    markServerAsRead,
  };
};
