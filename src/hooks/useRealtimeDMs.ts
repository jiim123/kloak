import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import { resolveSignedUrls, isSupabaseAttachmentUrl } from '@/lib/signedUrl';
import type { DirectMessage, ReactionGroup } from '@/types';
import { getOrFetchUser, useUserCacheStore } from '@/stores/userCacheStore';


interface UseRealtimeDMsOptions {
  userId: string | null;
  currentConversationId: string | null;
  onNewMessage?: (message: DirectMessage, conversationId: string) => void;
}

type DirectMessageRealtimeRow = {
  id?: string;
  conversation_id?: string;
  sender_id?: string;
  content?: string | null;
  created_at?: string;
  edited_at?: string | null;
  reply_to_id?: string | null;
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
  const conversations = useDMStore((state) => state.conversations);

  const onNewMessageRef = useRef(onNewMessage);
  onNewMessageRef.current = onNewMessage;

  useEffect(() => {
    const next = new Set<string>();
    conversations.forEach((conversation) => {
      if (conversation.id) {
        next.add(conversation.id);
      }
    });
    if (currentConversationId) {
      next.add(currentConversationId);
    }
    conversationIdsRef.current = next;
  }, [conversations, currentConversationId]);

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

      // Pre-warm signed URL cache for attachment URLs in content
      const urlMatches = (newMsg.content || '').match(/https?:\/\/[^\s<>"]+/g);
      if (urlMatches) {
        const attachmentUrls = urlMatches.filter(isSupabaseAttachmentUrl);
        if (attachmentUrls.length > 0) {
          resolveSignedUrls(attachmentUrls).catch(() => {});
        }
      }

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

  // Subscribe to the active conversation's broadcast channel
  useEffect(() => {
    if (!userId || !currentConversationId) return;

    const channel = supabase.channel(`dm:${currentConversationId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on('broadcast', { event: 'new_message' }, ({ payload }) => {
      if (!payload?.message) return;
      if (payload.message.sender_id === userId) return;
      void handleNewMessage({ new: payload.message });
    });

    channel.on('broadcast', { event: 'message_updated' }, ({ payload }) => {
      if (!payload?.message) return;
      handleMessageUpdate({ new: payload.message });
    });

    channel.on('broadcast', { event: 'message_deleted' }, ({ payload }) => {
      if (!payload?.message) return;
      handleMessageDelete({ old: payload.message });
    });

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[DM] Listening on dm:${currentConversationId}`);
      } else {
        console.warn('[DM] Channel status:', status, err);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, currentConversationId, handleNewMessage, handleMessageUpdate, handleMessageDelete]);

  // Subscribe to background conversations for unread indicators (up to 10 most recent)
  useEffect(() => {
    if (!userId) return;

    const convIds = Array.from(conversationIdsRef.current);
    if (convIds.length === 0) return;

    // Only subscribe to non-active conversations, limit to 10
    const backgroundIds = convIds
      .filter((id) => id !== currentConversationId)
      .slice(0, 10);

    if (backgroundIds.length === 0) return;

    const channels: ReturnType<typeof supabase.channel>[] = [];

    for (const convId of backgroundIds) {
      const ch = supabase.channel(`dm-notify:${convId}`, {
        config: { broadcast: { self: false } },
      });

      ch.on('broadcast', { event: 'new_message' }, ({ payload }) => {
        if (!payload?.message) return;
        if (payload.message.sender_id === userId) return;

        const message: DirectMessage = {
          id: payload.message.id,
          conversation_id: payload.message.conversation_id,
          sender_id: payload.message.sender_id,
          content: payload.message.content,
          created_at: payload.message.created_at,
          edited_at: payload.message.edited_at ?? null,
          reply_to_id: payload.message.reply_to_id ?? null,
          reply_to: null,
          attachments: [],
          reactions: [],
        };

        updateConversation(convId, { last_message: message });

        if (onNewMessageRef.current) {
          onNewMessageRef.current(message, convId);
        }
      });

      ch.subscribe();
      channels.push(ch);
    }

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [userId, currentConversationId, conversations.length, updateConversation]);

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

};
