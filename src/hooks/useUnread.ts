import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { ChannelRead } from '@/types';

interface UnreadState {
  [channelId: string]: {
    unreadCount: number;
    mentionCount: number;
    lastReadMessageId: string | null;
  };
}

export const useUnread = (serverChannelIds: string[] = []) => {
  const { user } = useAuthStore();
  const [unreadState, setUnreadState] = useState<UnreadState>({});
  const [isLoading, setIsLoading] = useState(false);

  // Fetch channel reads for user
  const fetchUnreadCounts = useCallback(async () => {
    if (!user || serverChannelIds.length === 0) return;

    setIsLoading(true);
    try {
      const { data: channelReads } = await supabase
        .from('channel_reads')
        .select('*')
        .eq('user_id', user.id)
        .in('channel_id', serverChannelIds);

      // Get message counts for each channel since last read
      const newState: UnreadState = {};

      for (const channelId of serverChannelIds) {
        const channelRead = channelReads?.find((r) => r.channel_id === channelId);
        
        let unreadCount = 0;
        if (channelRead?.last_read_message_id) {
          // Get count of messages after last read
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', channelId)
            .gt('created_at', channelRead.last_read_at || '1970-01-01');

          unreadCount = count || 0;
        } else {
          // If no read record, count all messages
          const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel_id', channelId);

          unreadCount = count || 0;
        }

        newState[channelId] = {
          unreadCount,
          mentionCount: channelRead?.mention_count || 0,
          lastReadMessageId: channelRead?.last_read_message_id || null,
        };
      }

      setUnreadState(newState);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, serverChannelIds]);

  // Mark channel as read
  const markAsRead = useCallback(
    async (channelId: string, lastMessageId: string) => {
      if (!user) return;

      try {
        const { data: existing } = await supabase
          .from('channel_reads')
          .select('id')
          .eq('user_id', user.id)
          .eq('channel_id', channelId)
          .single();

        if (existing) {
          await supabase
            .from('channel_reads')
            .update({
              last_read_message_id: lastMessageId,
              last_read_at: new Date().toISOString(),
              mention_count: 0,
            })
            .eq('id', existing.id);
        } else {
          await supabase.from('channel_reads').insert({
            user_id: user.id,
            channel_id: channelId,
            last_read_message_id: lastMessageId,
            last_read_at: new Date().toISOString(),
            mention_count: 0,
          });
        }

        setUnreadState((prev) => ({
          ...prev,
          [channelId]: {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: lastMessageId,
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
    (channelId: string) => {
      return (
        unreadState[channelId] || {
          unreadCount: 0,
          mentionCount: 0,
          lastReadMessageId: null,
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

  // Fetch on mount and when channel IDs change
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts]);

  return {
    unreadState,
    isLoading,
    markAsRead,
    getChannelUnread,
    hasAnyUnread,
    getTotalMentions,
    refetch: fetchUnreadCounts,
  };
};
