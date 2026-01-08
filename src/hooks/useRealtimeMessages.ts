import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';

export const useRealtimeMessages = (channelId: string | null) => {
  // Use refs to avoid recreating the subscription when store functions change
  const storeRef = useRef(useMessageStore.getState());
  
  // Keep the ref updated
  useEffect(() => {
    return useMessageStore.subscribe((state) => {
      storeRef.current = state;
    });
  }, []);

  useEffect(() => {
    if (!channelId) return;

    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch complete message with relations
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              user:users(*),
              reply_to:messages!messages_reply_to_id_fkey(
                id,
                content,
                user:users(id, username, display_name, avatar_url)
              ),
              attachments:message_attachments(*),
              reactions(*)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            storeRef.current.addMessage(data as any);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Fetch updated message with relations
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              user:users(*),
              reply_to:messages!messages_reply_to_id_fkey(
                id,
                content,
                user:users(id, username, display_name, avatar_url)
              ),
              attachments:message_attachments(*),
              reactions(*)
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            storeRef.current.updateMessage(payload.new.id, data as any);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const oldData = payload.old as { id?: string };
          if (oldData.id) {
            storeRef.current.removeMessage(oldData.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelId]);
};
