import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';

export const useRealtimeReactions = (channelId: string | null) => {
  // Use refs to avoid recreating subscription when store changes
  const storeRef = useRef(useMessageStore.getState());
  
  useEffect(() => {
    return useMessageStore.subscribe((state) => {
      storeRef.current = state;
    });
  }, []);

  const refetchIfNeeded = useCallback(
    async (messageId: string | undefined) => {
      if (!channelId || !messageId) return;

      const messages = storeRef.current.getMessages();
      const messageInChannel = messages.some((m) => m.id === messageId);
      if (messageInChannel) {
        // Refetch messages to get updated reactions
        await storeRef.current.fetchMessages(channelId);
      }
    },
    [channelId]
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
