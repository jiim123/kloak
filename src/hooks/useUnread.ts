import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';

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

export const useUnread = (serverChannelIds: string[] = []) => {
  const { user } = useAuthStore();
  const [unreadState, setUnreadState] = useState<UnreadState>({});
  const [isLoading, setIsLoading] = useState(false);
  const channelIdsRef = useRef<string[]>([]);

  // Fetch channel reads for user
  const fetchUnreadCounts = useCallback(async () => {
    if (!user || serverChannelIds.length === 0) return;

    // Avoid refetching if channel IDs haven't changed
    const idsString = serverChannelIds.sort().join(',');
    const prevIdsString = channelIdsRef.current.sort().join(',');
    if (idsString === prevIdsString && Object.keys(unreadState).length > 0) return;
    
    channelIdsRef.current = serverChannelIds;
    setIsLoading(true);

    try {
      // Get channel reads
      const { data: channelReads } = await supabase
        .from('channel_reads')
        .select('*')
        .eq('user_id', user.id)
        .in('channel_id', serverChannelIds);

      const newState: UnreadState = {};

      for (const channelId of serverChannelIds) {
        const channelRead = channelReads?.find((r) => r.channel_id === channelId);
        
        let unreadCount = 0;
        let firstUnreadMessageId: string | null = null;

        if (channelRead?.last_read_at) {
          // Get count of messages after last read
          const { data: unreadMessages, count } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .eq('channel_id', channelId)
            .gt('created_at', channelRead.last_read_at)
            .neq('user_id', user.id) // Don't count own messages as unread
            .order('created_at', { ascending: true })
            .limit(1);

          unreadCount = count || 0;
          firstUnreadMessageId = unreadMessages?.[0]?.id || null;
        } else {
          // If no read record, count all messages not by user
          const { data: unreadMessages, count } = await supabase
            .from('messages')
            .select('id', { count: 'exact' })
            .eq('channel_id', channelId)
            .neq('user_id', user.id)
            .order('created_at', { ascending: true })
            .limit(1);

          unreadCount = count || 0;
          firstUnreadMessageId = unreadMessages?.[0]?.id || null;
        }

        newState[channelId] = {
          unreadCount,
          mentionCount: channelRead?.mention_count || 0,
          lastReadMessageId: channelRead?.last_read_message_id || null,
          lastReadAt: channelRead?.last_read_at || null,
          firstUnreadMessageId,
        };
      }

      setUnreadState(newState);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    } finally {
      setIsLoading(false);
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
  }, [serverChannelIds.length]); // Only re-run when count changes

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
          fetchUnreadCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchUnreadCounts]);

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
