import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFriendStore } from '@/stores/friendStore';
import type { Message } from '@/types';

export const useRealtimePinnedMessages = (channelId: string | null) => {
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPinnedMessages = useCallback(async () => {
    if (!channelId) {
      setPinnedMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
      const blockedIn = blockedUserIds.length > 0 ? `(${blockedUserIds.map((id) => `"${id}"`).join(',')})` : null;

      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          user:users (*),
          attachments:message_attachments (*)
        `)
        .eq('channel_id', channelId)
        .eq('is_pinned', true)
        .not('user_id', 'in', blockedIn || '("00000000-0000-0000-0000-000000000000")')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const messages: Message[] = (data || []).map((msg: any) => ({
        ...msg,
        user: msg.user,
        attachments: msg.attachments || [],
      }));

      setPinnedMessages(messages);
    } catch (error) {
      console.error('Failed to fetch pinned messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [channelId]);

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
          // Refetch if is_pinned changed
          fetchPinnedMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, fetchPinnedMessages]);

  return { pinnedMessages, isLoading, refetch: fetchPinnedMessages };
};
