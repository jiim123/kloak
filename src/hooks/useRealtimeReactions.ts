import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';

export const useRealtimeReactions = (channelId: string | null) => {
  const { fetchMessages, messages } = useMessageStore();

  const refetchIfNeeded = useCallback(
    async (messageId: string | undefined) => {
      if (!channelId || !messageId) return;

      const messageInChannel = messages.some((m) => m.id === messageId);
      if (messageInChannel) {
        // Refetch messages to get updated reactions
        await fetchMessages(channelId);
      }
    },
    [channelId, messages, fetchMessages]
  );

  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`reactions:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reactions',
        },
        async (payload) => {
          const newData = payload.new as { message_id?: string } | null;
          const oldData = payload.old as { message_id?: string } | null;
          const messageId = newData?.message_id || oldData?.message_id;
          await refetchIfNeeded(messageId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId, refetchIfNeeded]);
};
