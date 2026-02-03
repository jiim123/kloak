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

const UNREAD_POLL_INTERVAL_MS = 15000; // keep sidebars consistent even if realtime is lossy
const MAX_CONCURRENT_UNREAD_QUERIES = 6;
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

  const promisePool = useCallback(async <T,>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> => {
    const results: T[] = [];
    let idx = 0;

    const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      while (idx < tasks.length) {
        const current = idx++;
        try {
          results[current] = await tasks[current]();
        } catch {
          // leave empty slot; caller can handle missing results
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          results[current] = undefined as any;
        }
      }
    });

    await Promise.all(workers);
    return results;
  }, []);

  // Fetch channel reads for user
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
      // Get channel reads - only fetch columns we need (optimized query)
      const { data: channelReads } = await supabase
        .from('channel_reads')
        .select('channel_id, last_read_at, last_read_message_id, mention_count')
        .eq('user_id', user.id)
        .in('channel_id', serverChannelIds);

      const newState: UnreadState = {};

      const tasks = serverChannelIds.map((channelId) => async () => {
        const channelRead = channelReads?.find((r) => r.channel_id === channelId);
        let unreadCount = 0;
        let firstUnreadMessageId: string | null = null;

        let query = supabase
          .from('messages')
          .select('id', { count: 'exact' })
          .eq('channel_id', channelId)
          .neq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1);

        const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
        const blockedIn = blockedUserIds.length > 0 ? `(${blockedUserIds.map((id) => `"${id}"`).join(',')})` : null;
        if (blockedIn) {
          query = query.not('user_id', 'in', blockedIn);
        }

        if (channelRead?.last_read_at) {
          query = query.gt('created_at', channelRead.last_read_at);
        }

        const { data: unreadMessages, count, error } = await query;
        if (error) {
          // Keep base state even if this channel count fails
          return {
            channelId,
            unreadCount: 0,
            firstUnreadMessageId: null,
            mentionCount: channelRead?.mention_count || 0,
            lastReadMessageId: channelRead?.last_read_message_id || null,
            lastReadAt: channelRead?.last_read_at || null,
          };
        }

        unreadCount = count || 0;
        firstUnreadMessageId = unreadMessages?.[0]?.id || null;

        return {
          channelId,
          unreadCount,
          firstUnreadMessageId,
          mentionCount: channelRead?.mention_count || 0,
          lastReadMessageId: channelRead?.last_read_message_id || null,
          lastReadAt: channelRead?.last_read_at || null,
        };
      });

      const results = await promisePool(tasks, MAX_CONCURRENT_UNREAD_QUERIES);
      if (fetchSeqRef.current !== seq) return;

      results.forEach((r) => {
        if (!r) return;
        newState[r.channelId] = {
          unreadCount: r.unreadCount,
          mentionCount: r.mentionCount,
          lastReadMessageId: r.lastReadMessageId,
          lastReadAt: r.lastReadAt,
          firstUnreadMessageId: r.firstUnreadMessageId,
        };
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
  }, [user, serverChannelIds, unreadState, promisePool]);

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
          // Back-compat fallback (in case migration hasn't been applied yet).
          const { data: existing } = await supabase
            .from('channel_reads')
            .select('id')
            .eq('user_id', user.id)
            .eq('channel_id', channelId)
            .maybeSingle();

          if (existing) {
            await supabase
              .from('channel_reads')
              .update({
                last_read_message_id: messageId,
                last_read_at: now,
                mention_count: 0,
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('channel_reads').insert({
              user_id: user.id,
              channel_id: channelId,
              last_read_message_id: messageId,
              last_read_at: now,
              mention_count: 0,
            });
          }
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
  // immediately clear that channel locally if it’s in our tracked set.
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
  };
};
