import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import type { DirectMessage, ReactionGroup } from '@/types';
import { useRealtimeUserUpdates } from './useRealtimeUserUpdates';
import { getOrFetchUser } from '@/lib/userCache';

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

  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  // Handle incoming message — use payload.new directly + user cache to avoid re-fetch
  const handleNewMessage = useCallback(
    async (payload: any) => {
      const newMsg = payload.new;
      if (!newMsg) return;

      // Avoid redundant self lookups on messages we just sent.
      const localUser = useAuthStore.getState().user;
      const sender =
        localUser?.id === newMsg.sender_id ? localUser : await getOrFetchUser(newMsg.sender_id);
      if (!sender) return;

      // Check local cache for reply-to
      let reply_to: DirectMessage | null = null;
      if (newMsg.reply_to_id) {
        const cachedMessages = useDMStore.getState().messagesByConversation[newMsg.conversation_id] || [];
        const cachedReply = cachedMessages.find((m: any) => m.id === newMsg.reply_to_id);
        if (cachedReply) {
          reply_to = cachedReply;
        } else {
          // Fetch only if not in local state
          const { data: replyData } = await supabase
            .from('direct_messages')
            .select('id, content, sender_id, sender:users!direct_messages_sender_id_fkey(username)')
            .eq('id', newMsg.reply_to_id)
            .single();
          if (replyData) {
            reply_to = {
              id: (replyData as any).id,
              content: (replyData as any).content,
              sender_id: (replyData as any).sender_id,
              sender: (replyData as any).sender ? { username: (replyData as any).sender.username } as any : undefined,
            } as DirectMessage;
          }
        }
      }

      const message: DirectMessage = {
        id: newMsg.id,
        conversation_id: newMsg.conversation_id,
        sender_id: newMsg.sender_id,
        content: newMsg.content,
        created_at: newMsg.created_at,
        edited_at: newMsg.edited_at,
        reply_to_id: newMsg.reply_to_id,
        reply_to,
        sender: {
          id: sender.id,
          username: sender.username,
          display_name: sender.display_name,
          avatar_url: sender.avatar_url,
          banner_url: (sender as any).banner_url ?? null,
          avatar_decoration: (sender as any).avatar_decoration,
          profile_effect: (sender as any).profile_effect ?? null,
          banner_color: (sender as any).banner_color || '#5865F2',
          profile_theme_primary: (sender as any).profile_theme_primary ?? null,
          profile_theme_accent: (sender as any).profile_theme_accent ?? null,
          bio: (sender as any).bio,
          status: sender.status as any,
          custom_status: (sender as any).custom_status,
          created_at: sender.created_at,
          last_seen: (sender as any).last_seen,
          pronouns: (sender as any).pronouns ?? null,
        } as any,
        attachments: [],
        reactions: [], // New messages have no reactions yet
      };

      addMessage(newMsg.conversation_id, message);
      updateConversation(newMsg.conversation_id, { last_message: message });

      if (onNewMessageRef.current && newMsg.sender_id !== userId) {
        onNewMessageRef.current(message, newMsg.conversation_id);
      }
    },
    [addMessage, updateConversation, userId]
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

      // Try to find the conversation_id from local state first (avoid DB query)
      const { messagesByConversation } = useDMStore.getState();
      let conversationId: string | null = null;
      for (const [convId, messages] of Object.entries(messagesByConversation)) {
        if ((messages as any[]).some((m: any) => m.id === messageId)) {
          conversationId = convId;
          break;
        }
      }

      // Only fetch from DB if not found locally
      if (!conversationId) {
        const { data: messageData } = await supabase
          .from('direct_messages')
          .select('conversation_id')
          .eq('id', messageId)
          .single();
        if (!messageData) return;
        conversationId = messageData.conversation_id;
      }

      // Fetch updated reactions for this message
      const { data: reactionsData } = await supabase
        .from('dm_reactions')
        .select('id, message_id, user_id, emoji')
        .eq('message_id', messageId);

      const reactions = groupReactions(reactionsData || [], userId || undefined);
      updateMessage(conversationId!, messageId, { reactions });
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
      .subscribe((status, err) => {
        if (status !== 'SUBSCRIBED') {
          console.log('[Realtime] DM subscription status:', { status, userId, err });
        }
        if (err) {
          console.error('[Realtime] DM subscription error:', err);
        }
      });

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

  // Debounced fetchConversations to batch rapid dm_participants events
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetchConversations = useCallback((uid: string) => {
    if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    fetchDebounceRef.current = setTimeout(() => {
      fetchConversations(uid);
    }, 500);
  }, [fetchConversations]);

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
      (payload) => {
        // Immediately add the new conversation ID to prevent race conditions
        const newConvId = payload.new?.conversation_id;
        if (newConvId) {
          conversationIdsRef.current.add(newConvId);
        }
        // Debounced background refresh for full conversation data
        debouncedFetchConversations(userId);
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
      (payload) => {
        // Immediately remove the conversation ID
        const removedConvId = payload.old?.conversation_id;
        if (removedConvId) {
          conversationIdsRef.current.delete(removedConvId);
        }
        // Debounced background refresh
        debouncedFetchConversations(userId);
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
