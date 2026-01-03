import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDMStore } from '@/stores/dmStore';
import type { DirectMessage } from '@/types';

interface UseRealtimeDMsOptions {
  userId: string | null;
  currentConversationId: string | null;
  onNewMessage?: (message: DirectMessage, conversationId: string) => void;
}

export const useRealtimeDMs = ({
  userId,
  currentConversationId,
  onNewMessage,
}: UseRealtimeDMsOptions) => {
  const { addMessage, updateConversation, fetchConversations } = useDMStore();

  // Handle incoming message
  const handleNewMessage = useCallback(
    async (payload: any) => {
      const newMessageData = payload.new;

      // Fetch complete message with sender info
      const { data } = await supabase
        .from('direct_messages')
        .select(`
          *,
          sender:users (*)
        `)
        .eq('id', newMessageData.id)
        .single();

      if (!data) return;

      const message: DirectMessage = {
        ...data,
        sender: data.sender,
        attachments: [],
        reactions: [],
      };

      // If this is for the current conversation, add to messages
      if (newMessageData.conversation_id === currentConversationId) {
        addMessage(message);
      }

      // Update conversation's last message
      updateConversation(newMessageData.conversation_id, {
        last_message: message,
      });

      // Notify callback (for unread tracking)
      if (onNewMessage && newMessageData.sender_id !== userId) {
        onNewMessage(message, newMessageData.conversation_id);
      }
    },
    [currentConversationId, addMessage, updateConversation, onNewMessage, userId]
  );

  useEffect(() => {
    if (!userId) return;

    // Subscribe to all direct_messages where user is a participant
    // We'll filter by conversation on the client side for now
    const channel = supabase
      .channel(`all-dms:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        async (payload) => {
          // Check if user is a participant in this conversation
          const { data: participation } = await supabase
            .from('dm_participants')
            .select('id')
            .eq('conversation_id', payload.new.conversation_id)
            .eq('user_id', userId)
            .single();

          if (participation) {
            handleNewMessage(payload);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
        },
        async (payload) => {
          // Handle message edits - refetch if it's in current conversation
          if (payload.new.conversation_id === currentConversationId) {
            // Could implement updateMessage here if needed
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'direct_messages',
        },
        async (payload) => {
          // Handle message deletions if needed
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, currentConversationId, handleNewMessage]);

  // Also listen for new conversations
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dm-participants:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // New conversation created, refetch conversations
          fetchConversations(userId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchConversations]);
};
