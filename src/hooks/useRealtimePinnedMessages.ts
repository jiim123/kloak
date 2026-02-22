import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useFriendStore } from '@/stores/friendStore';
import type { Message } from '@/types';

export const useRealtimePinnedMessages = (channelId: string | null) => {
  const userId = useAuthStore((s) => s.user?.id);
  const [pinnedMessages, setPinnedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPinnedMessages = useCallback(async () => {
    if (!channelId || !userId) {
      setPinnedMessages([]);
      return;
    }

    setIsLoading(true);
    try {
      const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
      const { data, error } = await supabase.rpc('get_pinned_messages_secure', {
        _channel_id: channelId,
        _user_id: userId,
        _blocked_user_ids: blockedUserIds,
      });

      if (error) throw error;
      const messageRows = Array.isArray(data) ? data : [];
      const messages: Message[] = messageRows.map((msg: any) => ({
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
  }, [channelId, userId]);

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
          const previousMessage = payload.old as any;
          if (!updatedMessage) return;

          const pinToggled = previousMessage?.is_pinned !== updatedMessage.is_pinned;
          const pinnedMessageEdited =
            updatedMessage.is_pinned === true &&
            (previousMessage?.content !== updatedMessage.content ||
              previousMessage?.edited_at !== updatedMessage.edited_at);

          if (pinToggled || pinnedMessageEdited) {
            fetchPinnedMessages();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, fetchPinnedMessages]);

  return { pinnedMessages, isLoading, refetch: fetchPinnedMessages };
};
