import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useDMStore, registerDMChannel, unregisterDMChannel } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import type { DirectMessage, DMAttachment, DMConversation } from '@/types';
import { getOrFetchUser, useUserCacheStore } from '@/stores/userCacheStore';
import { acquireChannel, releaseChannel, subscribeChannel } from '@/lib/sharedChannel';


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

type DMAttachmentRealtimeRow = {
  id?: string;
  message_id?: string;
  file_name?: string;
  file_url?: string;
  file_type?: string | null;
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
};

type DMConversationSummaryPayload = {
  conversation?: {
    id?: string;
    created_at?: string;
    is_group?: boolean;
    name?: string | null;
    created_by?: string | null;
  };
  participants?: any[];
  last_message?: DirectMessage | null;
};

type BroadcastMutationPayload<T> = {
  op?: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T;
  old?: T;
  conversation_id?: string;
  conversation?: DMConversationSummaryPayload | null;
  removed?: boolean;
};


export const useRealtimeDMs = ({
  userId,
  currentConversationId,
  onNewMessage,
}: UseRealtimeDMsOptions) => {
  const { addMessage, updateMessage, removeMessage, updateConversation, fetchMessages } =
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

  const applyConversationSummary = useCallback((summary?: DMConversationSummaryPayload | null, removed?: boolean) => {
    const conversationId = summary?.conversation?.id;
    if (!conversationId) return false;

    if (removed) {
      useDMStore.setState((state) => ({
        conversations: state.conversations.filter((conversation) => conversation.id !== conversationId),
        currentConversation:
          state.currentConversation?.id === conversationId ? null : state.currentConversation,
      }));
      conversationIdsRef.current.delete(conversationId);
      return true;
    }

    const participants = Array.isArray(summary.participants) ? summary.participants : [];
    const otherParticipant = participants.find((participant: any) => participant.user_id !== userId);
    const nextConversation: DMConversation = {
      id: conversationId,
      created_at: summary.conversation?.created_at ?? '',
      is_group: summary.conversation?.is_group ?? false,
      name: summary.conversation?.name ?? null,
      created_by: summary.conversation?.created_by ?? null,
      participants,
      other_user: otherParticipant?.user,
      last_message: summary.last_message ?? undefined,
    };

    const users = [nextConversation.other_user, ...participants.map((participant: any) => participant.user)].filter(
      (entry: any) => !!entry?.id,
    );
    for (const cachedUser of users) {
      useUserCacheStore.getState().upsertUser(cachedUser);
    }

    useDMStore.setState((state) => {
      const exists = state.conversations.some((conversation) => conversation.id === conversationId);
      const conversations = exists
        ? state.conversations.map((conversation) =>
            conversation.id === conversationId ? { ...conversation, ...nextConversation } : conversation,
          )
        : [nextConversation, ...state.conversations];

      conversations.sort((a, b) => {
        const aTime = new Date(a.last_message?.created_at ?? a.created_at ?? 0).getTime();
        const bTime = new Date(b.last_message?.created_at ?? b.created_at ?? 0).getTime();
        return bTime - aTime;
      });

      return {
        conversations,
        currentConversation:
          state.currentConversation?.id === conversationId
            ? { ...state.currentConversation, ...nextConversation }
            : state.currentConversation,
      };
    });

    conversationIdsRef.current.add(conversationId);
    return true;
  }, [userId]);

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

  const mergeAttachmentIntoConversation = useCallback(
    (attachmentRow: DMAttachmentRealtimeRow) => {
      if (!attachmentRow.id || !attachmentRow.message_id) return;
      const { messagesByConversation } = useDMStore.getState();

      for (const [conversationId, messages] of Object.entries(messagesByConversation)) {
        const message = messages.find((entry) => entry.id === attachmentRow.message_id);
        if (!message) continue;

        const nextAttachment: DMAttachment = {
          id: attachmentRow.id,
          message_id: attachmentRow.message_id,
          file_name: attachmentRow.file_name || 'attachment',
          file_url: attachmentRow.file_url || '',
          file_type: attachmentRow.file_type ?? null,
          file_size: attachmentRow.file_size ?? null,
          width: attachmentRow.width ?? null,
          height: attachmentRow.height ?? null,
        };

        const attachments = message.attachments || [];
        if (attachments.some((entry) => entry.id === nextAttachment.id)) return;

        updateMessage(conversationId, message.id, {
          attachments: [...attachments, nextAttachment],
        });
        return;
      }
    },
    [updateMessage],
  );

  // Subscribe to the active conversation's broadcast channel
  useEffect(() => {
    if (!userId || !currentConversationId) return;

    const channel = supabase.channel(`dm:${currentConversationId}`, {
      config: { broadcast: { self: false } },
    });
    registerDMChannel(currentConversationId, channel);

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

    channel.on('broadcast', { event: 'reaction_added' }, ({ payload }) => {
      if (!payload?.message_id || !payload?.conversation_id) return;
      if (payload.user_id === userId) return;
      // Add reaction to local state
      const { messagesByConversation } = useDMStore.getState();
      const messages = messagesByConversation[payload.conversation_id] || [];
      const msg = messages.find((m: any) => m.id === payload.message_id);
      if (!msg) return;
      const reactions = [...(msg.reactions || [])];
      const existing = reactions.find((r: any) => r.emoji === payload.emoji);
      if (existing) {
        if (!existing.users.includes(payload.user_id)) {
          existing.count += 1;
          existing.users.push(payload.user_id);
        }
      } else {
        reactions.push({ emoji: payload.emoji, count: 1, users: [payload.user_id], hasReacted: false });
      }
      updateMessage(payload.conversation_id, payload.message_id, { reactions });
    });

    channel.on('broadcast', { event: 'reaction_removed' }, ({ payload }) => {
      if (!payload?.message_id || !payload?.conversation_id) return;
      if (payload.user_id === userId) return;
      const { messagesByConversation } = useDMStore.getState();
      const messages = messagesByConversation[payload.conversation_id] || [];
      const msg = messages.find((m: any) => m.id === payload.message_id);
      if (!msg) return;
      const reactions = (msg.reactions || [])
        .map((r: any) => {
          if (r.emoji === payload.emoji) {
            return {
              ...r,
              count: r.count - 1,
              users: r.users.filter((u: string) => u !== payload.user_id),
            };
          }
          return r;
        })
        .filter((r: any) => r.count > 0);
      updateMessage(payload.conversation_id, payload.message_id, { reactions });
    });

    channel.on('broadcast', { event: 'dm_attachments' }, ({ payload }) => {
      try {
        const eventPayload = payload as BroadcastMutationPayload<DMAttachmentRealtimeRow>;
        if (eventPayload?.op !== 'DELETE') {
          mergeAttachmentIntoConversation(eventPayload.new ?? {});
        }
      } catch (error) {
        console.error('[DM] Error processing attachment event:', error);
      }
    });

    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[DM] Listening on dm:${currentConversationId}`);
      } else {
        console.warn('[DM] Channel status:', status, err);
      }
    });

    return () => {
      unregisterDMChannel(currentConversationId);
      supabase.removeChannel(channel);
    };
  }, [userId, currentConversationId, handleNewMessage, handleMessageUpdate, handleMessageDelete, mergeAttachmentIntoConversation]);

  // Subscribe to user-scoped DM updates from database Broadcast triggers.
  useEffect(() => {
    if (!userId) return;

    const topic = `user:${userId}`;
    const channel = acquireChannel(topic);

    channel.on(
      'broadcast',
      { event: 'direct_messages' },
      ({ payload }) => {
        const eventPayload = payload as BroadcastMutationPayload<DirectMessageRealtimeRow>;
        const op = eventPayload?.op;
        const row = op === 'DELETE' ? eventPayload.old : eventPayload.new;
        if (!op || !row?.conversation_id) return;

        const isKnownConversation = conversationIdsRef.current.has(row.conversation_id);
        const lastMessage = useDMStore
          .getState()
          .conversations.find((conversation) => conversation.id === row.conversation_id)?.last_message;

        if (op === 'INSERT') {
          void handleNewMessage({ new: row });
        } else if (op === 'UPDATE') {
          handleMessageUpdate({ new: row });
          if (lastMessage?.id === row.id) {
            updateConversation(row.conversation_id, {
              last_message: {
                ...lastMessage,
                content: row.content ?? lastMessage.content,
                edited_at: row.edited_at ?? lastMessage.edited_at,
              },
            });
          }
        } else if (op === 'DELETE') {
          handleMessageDelete({ old: row });
        }

        if (!isKnownConversation || (op === 'DELETE' && lastMessage?.id === row.id) || eventPayload.conversation) {
          applyConversationSummary(eventPayload.conversation, eventPayload.removed);
        }
      },
    );

    channel.on('broadcast', { event: 'dm_attachments' }, ({ payload }) => {
      try {
        const eventPayload = payload as BroadcastMutationPayload<DMAttachmentRealtimeRow>;
        if (eventPayload?.op !== 'DELETE') {
          mergeAttachmentIntoConversation(eventPayload.new ?? {});
        }
      } catch (error) {
        console.error('[DM] Error processing user-scoped attachment event:', error);
      }
    });

    channel.on(
      'broadcast',
      { event: 'dm_participants' },
      ({ payload }) => {
        const eventPayload = payload as BroadcastMutationPayload<{ conversation_id?: string }>;
        const changedConvId =
          eventPayload?.op === 'DELETE' ? eventPayload.old?.conversation_id : eventPayload.new?.conversation_id;

        if (eventPayload.conversation) {
          applyConversationSummary(eventPayload.conversation, eventPayload.removed);
          return;
        }

        if (changedConvId) {
          if (eventPayload?.op === 'DELETE') {
            conversationIdsRef.current.delete(changedConvId);
          } else {
            conversationIdsRef.current.add(changedConvId);
          }
        }
      },
    );

    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [
    userId,
    handleNewMessage,
    handleMessageUpdate,
    handleMessageDelete,
    mergeAttachmentIntoConversation,
    applyConversationSummary,
  ]);

};
