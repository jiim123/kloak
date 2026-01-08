import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useMessageStore } from '@/stores/messageStore';
import type { Message, ReactionGroup, User } from '@/types';

// Group reactions like in messageStore
const groupReactions = (reactions: any[], currentUserId?: string): ReactionGroup[] => {
  const groups: Record<string, ReactionGroup> = {};

  reactions.forEach((reaction) => {
    if (!groups[reaction.emoji]) {
      groups[reaction.emoji] = {
        emoji: reaction.emoji,
        count: 0,
        users: [],
        hasReacted: false,
      };
    }
    groups[reaction.emoji].count++;
    groups[reaction.emoji].users.push(reaction.user_id);
    if (reaction.user_id === currentUserId) {
      groups[reaction.emoji].hasReacted = true;
    }
  });

  return Object.values(groups);
};

// Transform raw message data to Message type
const transformMessage = (data: any): Message => {
  return {
    id: data.id,
    channel_id: data.channel_id,
    user_id: data.user_id,
    reply_to_id: data.reply_to_id,
    content: data.content,
    is_pinned: data.is_pinned || false,
    edited_at: data.edited_at,
    created_at: data.created_at,
    user: data.user as User,
    reply_to: data.reply_to ? {
      id: data.reply_to.id,
      content: data.reply_to.content,
      user: data.reply_to.user as User,
    } : undefined,
    attachments: data.attachments || [],
    reactions: groupReactions(data.reactions || []),
  };
};

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

    console.log('[Realtime] Setting up messages subscription for channel:', channelId);

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
          console.log('[Realtime] New message received:', payload.new.id);
          
          // Fetch complete message with relations
          const { data, error } = await supabase
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

          if (error) {
            console.error('[Realtime] Error fetching message details:', error);
            return;
          }

          if (data) {
            const message = transformMessage(data);
            console.log('[Realtime] Adding message to store:', message.id);
            storeRef.current.addMessage(message);
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
          console.log('[Realtime] Message updated:', payload.new.id);
          
          // Fetch updated message with relations
          const { data, error } = await supabase
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

          if (error) {
            console.error('[Realtime] Error fetching updated message:', error);
            return;
          }

          if (data) {
            const message = transformMessage(data);
            storeRef.current.updateMessage(payload.new.id, message);
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
          console.log('[Realtime] Message deleted:', payload.old);
          const oldData = payload.old as { id?: string };
          if (oldData.id) {
            storeRef.current.removeMessage(oldData.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up subscription for channel:', channelId);
      supabase.removeChannel(channel);
    };
  }, [channelId]);
};
