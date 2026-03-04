import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import type { DirectMessage, ReactionGroup } from '@/types';
import { useRealtimeUserUpdates } from './useRealtimeUserUpdates';
import { getOrFetchUser, useUserCacheStore } from '@/stores/userCacheStore';

interface UseRealtimeDMsOptions {
  userId: string | null;
  currentConversationId: string | null;
  onNewMessage?: (message: DirectMessage, conversationId: string) => void;
}

type BroadcastMutationOp = 'INSERT' | 'UPDATE' | 'DELETE';

type DirectMessageRealtimeRow = {
  id?: string;
  conversation_id?: string;
  sender_id?: string;
  content?: string | null;
  created_at?: string;
  edited_at?: string | null;
  reply_to_id?: string | null;
};

type BroadcastMutationPayload<T> = {
  op?: BroadcastMutationOp;
  new?: T;
  old?: T;
};

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
  const { addMessage, updateMessage, removeMessage, updateConversation, fetchConversations, fetchMessages } =
    useDMStore();
  const conversationIdsRef = useRef<Set<string>>(new Set());

  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  const hydrateMessageRow = useCallback(
    async (row: DirectMessageRealtimeRow): Promise<DirectMessageRealtimeRow> => {
      if (!userId || !row?.id) return row;

      const needsHydration =
        typeof row.content !== 'string' || row.reply_to_id === undefined || row.edited_at === undefined;
      if (!needsHydration) return row;

      try {
        const { data } = await supabase.rpc('get_dm_messages_by_ids_secure', {
          _message_ids: [row.id],
          _user_id: userId,
        });
        const hydrated = Array.isArray(data) ? (data[0] as DirectMessageRealtimeRow | undefined) : undefined;
        if (!hydrated) return row;
        return {
          ...row,
          ...hydrated,
          id: hydrated.id ?? row.id,
        };
      } catch {
        return row;
      }
    },
    [userId],
  );

  // Handle incoming message. Hydrate sparse payloads before adding to the store.
  const handleNewMessage = useCallback(
    async (payload: any) => {
      if (!userId) return;
      const incoming = payload?.new as DirectMessageRealtimeRow | undefined;
      if (!incoming?.id) return;

      const newMsg = await hydrateMessageRow(incoming);
      if (!newMsg.conversation_id || !newMsg.sender_id || !newMsg.created_at) return;

      // Legacy publication payload can omit content. Fallback to a full conversation refresh.
      if (typeof newMsg.content !== 'string') {
        void fetchMessages(newMsg.conversation_id, userId);
        return;
      }

      // Cache the sender in the user cache store (don't embed on message)
      const localUser = useAuthStore.getState().user;
      const sender = localUser?.id === newMsg.sender_id ? localUser : await getOrFetchUser(newMsg.sender_id);
      if (sender) {
        useUserCacheStore.getState().upsertUser(sender as any);
      }

      // Check local cache for reply-to.
      let reply_to: DirectMessage | null = null;
      if (newMsg.reply_to_id) {
        const cachedMessages = useDMStore.getState().messagesByConversation[newMsg.conversation_id] || [];
        const cachedReply = cachedMessages.find((m: any) => m.id === newMsg.reply_to_id);
        if (cachedReply) {
          reply_to = cachedReply;
        } else {
          const { data: replyRows } = await supabase.rpc('get_dm_messages_by_ids_secure', {
            _message_ids: [newMsg.reply_to_id],
            _user_id: userId,
          });
          const replyData = Array.isArray(replyRows) ? (replyRows[0] as any) : null;
          if (replyData) {
            reply_to = {
              id: replyData.id,
              content: replyData.content,
              sender_id: replyData.sender_id,
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
        edited_at: newMsg.edited_at ?? null,
        reply_to_id: newMsg.reply_to_id ?? null,
        reply_to,
        attachments: [],
        reactions: [],
      };

      addMessage(newMsg.conversation_id, message);
      updateConversation(newMsg.conversation_id, { last_message: message });

      if (onNewMessageRef.current && newMsg.sender_id !== userId) {
        onNewMessageRef.current(message, newMsg.conversation_id);
      }
    },
    [addMessage, updateConversation, userId, fetchMessages, hydrateMessageRow],
  );

  // Handle message updates (edits)
  const handleMessageUpdate = useCallback(
    (payload: any) => {
      const updatedData = payload.new as DirectMessageRealtimeRow | undefined;
      if (updatedData?.conversation_id && updatedData.id) {
        updateMessage(updatedData.conversation_id, updatedData.id, {
          content: updatedData.content,
          edited_at: updatedData.edited_at,
        });
      }
    },
    [updateMessage],
  );

  // Handle message deletes
  const handleMessageDelete = useCallback(
    (payload: any) => {
      const deletedData = payload.old as DirectMessageRealtimeRow | undefined;
      if (deletedData?.conversation_id && deletedData.id) {
        removeMessage(deletedData.conversation_id, deletedData.id);
      }
    },
    [removeMessage],
  );

  // Preferred path: broadcast events on user-scoped topic.
  useEffect(() => {
    if (!userId) return;

    const filter = { event: 'direct_messages', scope: `dms-${userId}` };
    const channel = supabase.channel(`user:${userId}`).on(
      'broadcast',
      filter as { event: string },
      ({ payload }) => {
        const eventPayload = payload as BroadcastMutationPayload<DirectMessageRealtimeRow>;
        const op = eventPayload?.op;
        if (!op) return;

        if (op === 'INSERT' && eventPayload.new) {
          void handleNewMessage({ new: eventPayload.new });
          return;
        }
        if (op === 'UPDATE' && eventPayload.new) {
          handleMessageUpdate({ new: eventPayload.new });
          return;
        }
        if (op === 'DELETE' && eventPayload.old) {
          handleMessageDelete({ old: eventPayload.old });
        }
      },
    );

    // user:<id> is owned/subscribed by useUnread. Only attach scoped listener here.
    return () => {
      (channel as unknown as { _off?: (type: string, filter: Record<string, unknown>) => void })._off?.(
        'broadcast',
        filter,
      );
    };
  }, [userId, handleNewMessage, handleMessageUpdate, handleMessageDelete]);

  // Fallback path: Postgres Changes for compatibility until broadcast trigger is deployed.
  useEffect(() => {
    if (!userId) return;

    // Prime a local set of conversation IDs for this user to avoid
    // doing a DB lookup for every global direct_messages event.
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('get_user_dm_conversation_ids_secure', {
        _user_id: userId,
      });
      if (cancelled) return;
      conversationIdsRef.current = new Set((Array.isArray(data) ? data : []) as string[]);
    })();

    const channel = supabase
      .channel(`all-dms:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          const convId = payload.new?.conversation_id as string | undefined;
          if (!convId) return;
          if (conversationIdsRef.current.size > 0 && !conversationIdsRef.current.has(convId)) return;
          void handleNewMessage(payload);
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'direct_messages',
        },
        handleMessageUpdate,
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'direct_messages',
        },
        handleMessageDelete,
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
  }, [userId, handleNewMessage, handleMessageUpdate, handleMessageDelete, currentConversationId]);

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
        const { data: resolvedConversationId } = await supabase.rpc('get_dm_message_conversation_secure', {
          _message_id: messageId,
          _user_id: userId,
        });
        if (!resolvedConversationId) return;
        conversationId = resolvedConversationId;
      }

      // Fetch updated reactions for this message
      const { data: reactionsData } = await supabase
        .from('dm_reactions')
        .select('id, message_id, user_id, emoji')
        .eq('message_id', messageId);

      const reactions = groupReactions(reactionsData || [], userId || undefined);
      updateMessage(conversationId!, messageId, { reactions });
    },
    [userId, updateMessage],
  );

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
        handleReactionChange,
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'dm_reactions',
        },
        handleReactionChange,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, handleReactionChange]);

  // Debounced fetchConversations to batch rapid dm_participants events
  const fetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedFetchConversations = useCallback(
    (uid: string) => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      fetchDebounceRef.current = setTimeout(() => {
        fetchConversations(uid);
      }, 500);
    },
    [fetchConversations],
  );

  useEffect(() => {
    return () => {
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
    };
  }, []);

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
          const newConvId = payload.new?.conversation_id;
          if (newConvId) {
            conversationIdsRef.current.add(newConvId);
          }
          debouncedFetchConversations(userId);
        },
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
          const removedConvId = payload.old?.conversation_id;
          if (removedConvId) {
            conversationIdsRef.current.delete(removedConvId);
          }
          debouncedFetchConversations(userId);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, debouncedFetchConversations]);

  // Subscribe to user updates for all DM conversation participants
  const conversations = useDMStore((state) => state.conversations);
  const currentConversation = useDMStore((state) => state.currentConversation);

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

    if (currentConversation?.participants) {
      currentConversation.participants.forEach((p) => {
        if (p.user_id && p.user_id !== userId) {
          ids.add(p.user_id);
        }
      });
    }

    return Array.from(ids);
  })();

  useRealtimeUserUpdates(participantUserIds, `dm-participant-users:${userId || 'none'}`);
};
