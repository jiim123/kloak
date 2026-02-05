import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDMStore } from '@/stores/dmStore';
import type { DirectMessage, ReactionGroup } from '@/types';
import { useRealtimeUserUpdates } from './useRealtimeUserUpdates';

interface UseRealtimeDMsOptions {
  userId: string | null;
  currentConversationId: string | null;
  onNewMessage?: (message: DirectMessage, conversationId: string) => void;
}

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

export const useRealtimeDMs = ({
  userId,
  currentConversationId,
  onNewMessage,
}: UseRealtimeDMsOptions) => {
  const { addMessage, updateMessage, removeMessage, updateConversation, fetchConversations } = useDMStore();
  const conversationIdsRef = useRef<Set<string>>(new Set());

  // Handle incoming message
  const handleNewMessage = useCallback(
    async (payload: any) => {
      const newMessageData = payload.new;

      // Fetch complete message with sender info
      const { data } = await supabase
        .from('direct_messages')
        .select(`
          *,
          sender:users (*),
          reactions:dm_reactions (*)
        `)
        .eq('id', newMessageData.id)
        .single();

      if (!data) return;

      const message: DirectMessage = {
        ...data,
        sender: data.sender ? {
          id: data.sender.id,
          username: data.sender.username,
          display_name: data.sender.display_name,
          avatar_url: data.sender.avatar_url,
          banner_url: data.sender.banner_url ?? null,
          avatar_decoration: data.sender.avatar_decoration,
          profile_effect: data.sender.profile_effect ?? null,
          banner_color: data.sender.banner_color || '#5865F2',
          profile_theme_primary: data.sender.profile_theme_primary ?? null,
          profile_theme_accent: data.sender.profile_theme_accent ?? null,
          bio: data.sender.bio,
          status: data.sender.status as any,
          custom_status: data.sender.custom_status,
          created_at: data.sender.created_at,
          last_seen: data.sender.last_seen,
         pronouns: (data.sender as any).pronouns ?? null,
        } : undefined,
        attachments: [],
        reactions: groupReactions(data.reactions || [], userId || undefined),
      };

      // Add message to the conversation's cache
      addMessage(newMessageData.conversation_id, message);

      // Update conversation's last message
      updateConversation(newMessageData.conversation_id, {
        last_message: message,
      });

      // Notify callback (for unread tracking)
      // Get the current conversation from store to check if we're viewing it
      const currentConvId = useDMStore.getState().currentConversation?.id;
      if (onNewMessage && newMessageData.sender_id !== userId) {
        onNewMessage(message, newMessageData.conversation_id);
      }
    },
    [addMessage, updateConversation, onNewMessage, userId]
  );

  // Handle message updates (edits)
  const handleMessageUpdate = useCallback(
    (payload: any) => {
      const updatedData = payload.new;
      if (updatedData.conversation_id) {
        updateMessage(updatedData.conversation_id, updatedData.id, {
          content: updatedData.content,
          edited_at: updatedData.edited_at,
        });
      }
    },
    [updateMessage]
  );

  // Handle message deletes
  const handleMessageDelete = useCallback(
    (payload: any) => {
      const deletedData = payload.old;
      if (deletedData.conversation_id) {
        removeMessage(deletedData.conversation_id, deletedData.id);
      }
    },
    [removeMessage]
  );

  // Handle reaction changes
  const handleReactionChange = useCallback(
    async (payload: any) => {
      const messageId = payload.new?.message_id || payload.old?.message_id;
      if (!messageId) return;

      // Fetch the message to get its conversation_id and updated reactions
      const { data: messageData } = await supabase
        .from('direct_messages')
        .select('conversation_id')
        .eq('id', messageId)
        .single();

      if (!messageData) return;

      // Fetch updated reactions for this message - only columns we need
      const { data: reactionsData } = await supabase
        .from('dm_reactions')
        .select('id, message_id, user_id, emoji')
        .eq('message_id', messageId);

      const reactions = groupReactions(reactionsData || [], userId || undefined);

      // Update the message in store
      updateMessage(messageData.conversation_id, messageId, { reactions });
    },
    [userId, updateMessage]
  );

  useEffect(() => {
    if (!userId) return;

    // Prime a local set of conversation IDs for this user to avoid
    // doing a DB lookup for every global direct_messages event.
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('dm_participants')
        .select('conversation_id')
        .eq('user_id', userId);
      if (cancelled) return;
      conversationIdsRef.current = new Set((data || []).map((r: any) => r.conversation_id));
    })();

    // Subscribe to all direct_messages where user is a participant
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
          const convId = payload.new?.conversation_id as string | undefined;
          if (!convId) return;
          if (!conversationIdsRef.current.has(convId)) return;
          handleNewMessage(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
        },
        handleMessageUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'direct_messages',
        },
        handleMessageDelete
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, handleNewMessage, handleMessageUpdate, handleMessageDelete]);

  // Subscribe to DM reactions
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`dm-reactions:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_reactions',
        },
        handleReactionChange
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'dm_reactions',
        },
        handleReactionChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, handleReactionChange]);

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
          // New conversation created, refetch conversations and update cache
          fetchConversations(userId).then(() => {
            const ids = useDMStore.getState().conversations.map((c) => c.id);
            conversationIdsRef.current = new Set(ids);
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'dm_participants',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchConversations(userId).then(() => {
            const ids = useDMStore.getState().conversations.map((c) => c.id);
            conversationIdsRef.current = new Set(ids);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchConversations]);

  // Subscribe to user updates for all DM conversation participants
  const conversations = useDMStore((state) => state.conversations);
  const currentConversation = useDMStore((state) => state.currentConversation);
  
  // Collect all unique user IDs from conversations (other_user for 1:1, participants for groups)
  const participantUserIds = (() => {
    const ids = new Set<string>();
    conversations.forEach((conv) => {
      if (conv.other_user?.id) {
        ids.add(conv.other_user.id);
      }
      if (conv.participants) {
        conv.participants.forEach((p) => {
          if (p.user_id && p.user_id !== userId) {
            ids.add(p.user_id);
          }
        });
      }
    });
    // Also include current conversation participants
    if (currentConversation?.participants) {
      currentConversation.participants.forEach((p) => {
        if (p.user_id && p.user_id !== userId) {
          ids.add(p.user_id);
        }
      });
    }
    return Array.from(ids);
  })();

  // Subscribe to user updates for DM participants
  useRealtimeUserUpdates(
    participantUserIds,
    `dm-participant-users:${userId || 'none'}`,
  );
};
