import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useUserCacheStore, bulkSetUsersInCache, fetchAndCacheUser } from "@/stores/userCacheStore";
import { resolveSignedUrls, isSupabaseAttachmentUrl } from "@/lib/signedUrl";
import { fetchUsersPresence } from "@/lib/presenceBatch";
import type { DMConversation, DirectMessage, User, ReactionGroup } from "@/types";

/** Registry of active DM broadcast channels keyed by conversationId */
const activeDMChannels = new Map<string, ReturnType<typeof supabase.channel>>();

export function registerDMChannel(conversationId: string, channel: ReturnType<typeof supabase.channel>) {
  activeDMChannels.set(conversationId, channel);
}

export function unregisterDMChannel(conversationId: string) {
  activeDMChannels.delete(conversationId);
}

function trySendBroadcast(conversationId: string, event: string, payload: Record<string, unknown>): void {
  try {
    const channel = activeDMChannels.get(conversationId);
    if (channel) {
      channel.send({ type: 'broadcast', event, payload }).catch(() => {});
    }
  } catch {}
}

interface DMState {
  conversations: DMConversation[];
  currentConversation: DMConversation | null;
  // Store messages per conversation to persist them
  messagesByConversation: Record<string, DirectMessage[]>;
  historyMetaByConversation: Record<string, DMHistoryMeta>;
  isLoading: boolean;
  fetchingOlderByConversation: Record<string, boolean>;

  // Conversation actions
  fetchConversations: (userId: string) => Promise<void>;
  openConversation: (userId: string, otherUserId: string) => Promise<DMConversation | null>;
  createGroupConversation: (userId: string, participantIds: string[], name?: string) => Promise<DMConversation | null>;
  setCurrentConversation: (conversation: DMConversation | null) => void;
  closeConversation: (conversationId: string, userId: string) => Promise<boolean>;

  // Message actions
  fetchMessages: (conversationId: string, userId: string, limit?: number, before?: string) => Promise<void>;
  prefetchOlderMessages: (conversationId: string, userId: string, limit?: number) => Promise<void>;
  sendMessage: (
    conversationId: string,
    senderId: string,
    content: string,
    replyToId?: string,
  ) => Promise<DirectMessage | null>;
  editMessage: (messageId: string, senderId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string, senderId: string) => Promise<void>;

  // Group actions
  updateGroupName: (conversationId: string, userId: string, newName: string) => Promise<boolean>;
  addGroupMembers: (conversationId: string, userId: string, memberIds: string[]) => Promise<boolean>;
  leaveGroup: (conversationId: string, userId: string) => Promise<boolean>;
  kickGroupMember: (conversationId: string, kickerId: string, targetUserId: string) => Promise<boolean>;

  // Reaction actions
  addReaction: (messageId: string, userId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, userId: string, emoji: string) => Promise<void>;

  // Realtime actions
  addMessage: (conversationId: string, message: DirectMessage) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<DirectMessage>) => void;
  removeMessage: (conversationId: string, messageId: string) => void;
  updateConversation: (conversationId: string, updates: Partial<DMConversation>) => void;

  // Getters
  getMessages: (conversationId: string) => DirectMessage[];
}

interface DMPrefetchedOlderPage {
  beforeId: string;
  messages: DirectMessage[];
  hasMore: boolean;
  oldestLoadedMessageId: string | null;
  prefetchedAt: number;
}

interface DMHistoryMeta {
  hasMore: boolean;
  oldestLoadedMessageId: string | null;
  prefetchedOlder?: DMPrefetchedOlderPage | null;
}

type PresenceSnapshotRow = {
  id: string;
  status: User["status"] | null;
  last_seen: string | null;
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

const MAX_CACHED_DM_CONVERSATIONS = 10;
const MAX_DM_MESSAGES_PER_CONVERSATION = 200;
const DM_PREFETCH_CACHE_EXPIRY_MS = 2 * 60 * 1000;
const inflightDMPrefetches = new Map<string, Promise<void>>();

const pruneDMMessageCache = (
  input: Record<string, DirectMessage[]>,
  keepConversationId?: string | null,
): Record<string, DirectMessage[]> => {
  const result: Record<string, DirectMessage[]> = {};
  for (const [id, msgs] of Object.entries(input)) {
    result[id] = msgs.length > MAX_DM_MESSAGES_PER_CONVERSATION
      ? msgs.slice(msgs.length - MAX_DM_MESSAGES_PER_CONVERSATION)
      : msgs;
  }
  const keys = Object.keys(result);
  if (keys.length <= MAX_CACHED_DM_CONVERSATIONS) return result;
  const keep = new Set<string>();
  if (keepConversationId && result[keepConversationId]) keep.add(keepConversationId);
  // Keep most recently accessed
  for (const key of keys.reverse()) {
    if (keep.size >= MAX_CACHED_DM_CONVERSATIONS) break;
    keep.add(key);
  }
  for (const key of keys) {
    if (!keep.has(key)) delete result[key];
  }
  return result;
};

const hydrateConversationPresence = async (
  conversations: DMConversation[],
  userId: string,
): Promise<DMConversation[]> => {
  const targetUserIds = Array.from(
    new Set(
      conversations.flatMap((conversation) =>
        (conversation.participants || [])
          .map((participant) => participant.user_id)
          .filter((participantUserId): participantUserId is string => !!participantUserId && participantUserId !== userId),
      ),
    ),
  );

  if (targetUserIds.length === 0) {
    return conversations;
  }

  try {
    const presenceByUserId = new Map<string, PresenceSnapshotRow>();
    for (const row of await fetchUsersPresence(userId, targetUserIds)) {
      presenceByUserId.set(row.id, row);
    }

    return conversations.map((conversation) => {
      const otherPresence = conversation.other_user?.id
        ? presenceByUserId.get(conversation.other_user.id)
        : undefined;

      const participants = conversation.participants?.map((participant) => {
        if (!participant.user || participant.user_id === userId) return participant;
        const presence = presenceByUserId.get(participant.user_id);
        if (!presence) return participant;
        return {
          ...participant,
          user: {
            ...participant.user,
            status: (presence.status as User["status"]) || participant.user.status,
            last_seen: presence.last_seen,
          },
        };
      });

      return {
        ...conversation,
        other_user:
          conversation.other_user && otherPresence
            ? {
                ...conversation.other_user,
                status: (otherPresence.status as User["status"]) || conversation.other_user.status,
                last_seen: otherPresence.last_seen,
              }
            : conversation.other_user,
        participants,
      };
    });
  } catch (error) {
    console.warn("Failed to hydrate DM conversation presence:", error);
    return conversations;
  }
};

const loadDMMessagePage = async (
  conversationId: string,
  userId: string,
  limit: number,
  before?: string,
): Promise<{ messages: DirectMessage[]; hasMore: boolean; oldestLoadedMessageId: string | null }> => {
  const { data, error } = await supabase.rpc("get_dm_messages", {
    _conversation_id: conversationId,
    _user_id: userId,
    _limit: limit,
    _before_id: before || null,
  });

  if (error) throw error;

  const dataArray = Array.isArray(data) ? data : [];
  const messageIds = dataArray.map((msg: any) => msg.id);

  let reactions: any[] = [];
  let attachments: any[] = [];
  if (messageIds.length > 0) {
    const [reactionResult, attachmentResult] = await Promise.all([
      supabase
        .from("dm_reactions")
        .select("id, message_id, user_id, emoji")
        .in("message_id", messageIds),
      supabase
        .from("dm_attachments")
        .select("id, message_id, file_url, file_name, file_type, file_size, width, height")
        .in("message_id", messageIds),
    ]);
    reactions = reactionResult.data || [];
    attachments = attachmentResult.data || [];
  }

  const uniqueUsers = new Map<string, User>();
  for (const msg of dataArray) {
    if ((msg as any).sender && typeof (msg as any).sender === "object" && (msg as any).sender.id) {
      uniqueUsers.set((msg as any).sender.id, (msg as any).sender as User);
    }
  }
  if (uniqueUsers.size > 0) {
    bulkSetUsersInCache(Array.from(uniqueUsers.values()));
  }

  const reversedData = [...dataArray].reverse();
  const replyToIds = reversedData
    .map((msg: any) => msg.reply_to_id)
    .filter((id: string | null): id is string => !!id);

  const replyToMap: Record<string, Partial<DirectMessage>> = {};
  if (replyToIds.length > 0) {
    const uniqueReplyIds = [...new Set(replyToIds)];
    const batchMap = new Map(reversedData.map((m: any) => [m.id, m]));
    const missingIds = uniqueReplyIds.filter((id) => !batchMap.has(id));

    for (const id of uniqueReplyIds) {
      const found = batchMap.get(id);
      if (found) {
        replyToMap[id] = {
          id: found.id,
          content: found.content,
          sender_id: found.sender_id,
        };
      }
    }

    if (missingIds.length > 0) {
      const { data: replyData } = await supabase.rpc("get_dm_messages_by_ids_secure", {
        _message_ids: missingIds,
        _user_id: userId,
      });
      if (replyData) {
        for (const r of replyData as any[]) {
          replyToMap[r.id] = {
            id: r.id,
            content: r.content,
            sender_id: r.sender_id,
          };
        }
      }
    }
  }

  const messages: DirectMessage[] = reversedData.map((msg: any) => {
    const msgReactions = reactions.filter((r) => r.message_id === msg.id);
    return {
      id: msg.id,
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      content: msg.content,
      reply_to_id: msg.reply_to_id ?? null,
      edited_at: msg.edited_at ?? null,
      created_at: msg.created_at,
      reply_to: msg.reply_to_id ? (replyToMap[msg.reply_to_id] as DirectMessage) || null : null,
      attachments: attachments.filter((a: any) => a.message_id === msg.id),
      reactions: groupReactions(msgReactions, userId),
    };
  });

  const dmAttachmentUrls = messages
    .flatMap((m) => (m.attachments || []).map((a: any) => a.file_url as string))
    .filter((url): url is string => !!url && isSupabaseAttachmentUrl(url));
  if (dmAttachmentUrls.length > 0) {
    resolveSignedUrls(dmAttachmentUrls).catch(() => {});
  }

  return {
    messages,
    hasMore: messages.length === limit,
    oldestLoadedMessageId: messages[0]?.id ?? null,
  };
};

export const useDMStore = create<DMState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messagesByConversation: {},
  historyMetaByConversation: {},
  isLoading: false,
  fetchingOlderByConversation: {},

  fetchConversations: async (userId: string) => {
    // Only show loading when we have no cached conversations (silent background refresh)
    const hasCached = get().conversations.length > 0;
    if (!hasCached) {
      set({ isLoading: true });
    }

    try {
      // Use RPC function to fetch conversations
      const { data, error } = await supabase.rpc("get_user_dm_conversations", {
        _user_id: userId,
      });

      if (error) throw error;

      const dataArray = Array.isArray(data) ? data : [];
      const conversations: DMConversation[] = dataArray.map((conv: any) => {
        const otherParticipant = conv.participants?.find((p: any) => p.user_id !== userId);

        return {
          id: conv.conversation?.id || conv.id,
          created_at: conv.conversation?.created_at || conv.created_at,
          is_group: conv.conversation?.is_group || conv.is_group || false,
          name: conv.conversation?.name || conv.name || null,
          created_by: conv.conversation?.created_by || null,
          participants: conv.participants,
          other_user: otherParticipant?.user as User,
          last_message: conv.last_message as DirectMessage,
        };
      });

      const hydratedConversations = await hydrateConversationPresence(conversations, userId);

      set({ conversations: hydratedConversations, isLoading: false });
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      set({ isLoading: false });
    }
  },

  openConversation: async (userId: string, otherUserId: string) => {
    try {
      // Use RPC function to open or create conversation
      const { data, error } = await supabase.rpc("open_dm_conversation", {
        _user_id: userId,
        _other_user_id: otherUserId,
      });

      if (error) throw error;

      const convData = data as { id: string; created_at: string };

      // Fetch other user details
      const userData = await fetchAndCacheUser(otherUserId);

      const conversation: DMConversation = {
        id: convData.id,
        created_at: convData.created_at,
        other_user: userData as unknown as User,
      };

      // Check if conversation already exists in state
      const existingConv = get().conversations.find((c) => c.id === conversation.id);

      if (existingConv) {
        set({ currentConversation: existingConv });
        return existingConv;
      }

      set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversation: conversation,
      }));

      return conversation;
    } catch (error) {
      console.error("Failed to open conversation:", error);
      return null;
    }
  },

  createGroupConversation: async (userId: string, participantIds: string[], name?: string) => {
    try {
      const { data, error } = await supabase.rpc("create_group_dm", {
        _creator_id: userId,
        _participant_ids: participantIds,
        _name: name || null,
      });

      if (error) throw error;

      const convData = data as unknown as {
        id: string;
        created_at: string;
        is_group: boolean;
        name: string | null;
        participants: Array<{ user_id: string; user: User }>;
      };

      const conversation: DMConversation = {
        id: convData.id,
        created_at: convData.created_at,
        is_group: convData.is_group,
        name: convData.name,
        participants: convData.participants?.map((p) => ({
          id: p.user_id,
          conversation_id: convData.id,
          user_id: p.user_id,
          last_read_at: null,
          user: p.user,
        })),
      };

      set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversation: conversation,
      }));

      return conversation;
    } catch (error) {
      console.error("Failed to create group conversation:", error);
      return null;
    }
  },

  setCurrentConversation: (conversation) => {
    // Persist current conversation ID for restoration
    if (conversation) {
      localStorage.setItem("kloak-current-dm-id", conversation.id);
    } else {
      localStorage.removeItem("kloak-current-dm-id");
    }
    set({ currentConversation: conversation });
  },

  closeConversation: async (conversationId: string, userId: string) => {
    try {
      const { error } = await supabase.rpc("close_dm_conversation" as any, {
        _conversation_id: conversationId,
        _user_id: userId,
      });

      if (error) throw error;

      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation,
        messagesByConversation: Object.fromEntries(
          Object.entries(state.messagesByConversation).filter(([key]) => key !== conversationId),
        ),
        historyMetaByConversation: Object.fromEntries(
          Object.entries(state.historyMetaByConversation).filter(([key]) => key !== conversationId),
        ),
        fetchingOlderByConversation: Object.fromEntries(
          Object.entries(state.fetchingOlderByConversation).filter(([key]) => key !== conversationId),
        ),
      }));

      return true;
    } catch (error) {
      console.error("Failed to close conversation:", error);
      return false;
    }
  },

  fetchMessages: async (conversationId: string, userId: string, limit = 50, before?: string) => {
    // Only show loading state if we have no cached messages for this conversation
    const hasCached = (get().messagesByConversation[conversationId] || []).length > 0;
    if (!hasCached) {
      set({ isLoading: true });
    }
    if (before) {
      set((state) => ({
        fetchingOlderByConversation: {
          ...state.fetchingOlderByConversation,
          [conversationId]: true,
        },
      }));
    }

    try {
      const historyMeta = get().historyMetaByConversation[conversationId];
      const prefetchedOlder =
        before && historyMeta?.prefetchedOlder?.beforeId === before
          ? historyMeta.prefetchedOlder
          : null;
      const page =
        prefetchedOlder && Date.now() - prefetchedOlder.prefetchedAt < DM_PREFETCH_CACHE_EXPIRY_MS
          ? {
              messages: prefetchedOlder.messages,
              hasMore: prefetchedOlder.hasMore,
              oldestLoadedMessageId: prefetchedOlder.oldestLoadedMessageId,
            }
          : await loadDMMessagePage(conversationId, userId, limit, before);
      const { messages, hasMore, oldestLoadedMessageId } = page;

      set((state) => {
        const currentMessages = state.messagesByConversation[conversationId] || [];
        const { [conversationId]: _, ...restFetchingOlder } = state.fetchingOlderByConversation;

        if (before) {
          // Prepend older messages
          return {
            messagesByConversation: pruneDMMessageCache(
              {
                ...state.messagesByConversation,
                [conversationId]: [...messages, ...currentMessages],
              },
              state.currentConversation?.id,
            ),
            historyMetaByConversation: {
              ...state.historyMetaByConversation,
              [conversationId]: {
                hasMore,
                oldestLoadedMessageId: oldestLoadedMessageId ?? before,
                prefetchedOlder: null,
              },
            },
            fetchingOlderByConversation: restFetchingOlder,
            isLoading: false,
          };
        } else {
          // Replace with fresh messages
          return {
            messagesByConversation: pruneDMMessageCache(
              {
                ...state.messagesByConversation,
                [conversationId]: messages,
              },
              state.currentConversation?.id,
            ),
            historyMetaByConversation: {
              ...state.historyMetaByConversation,
              [conversationId]: {
                hasMore,
                oldestLoadedMessageId,
                prefetchedOlder: null,
              },
            },
            fetchingOlderByConversation: restFetchingOlder,
            isLoading: false,
          };
        }
      });
    } catch (error) {
      console.error("Failed to fetch DM messages:", error);
      set((state) => {
        const { [conversationId]: _, ...restFetchingOlder } = state.fetchingOlderByConversation;
        return { isLoading: false, fetchingOlderByConversation: restFetchingOlder };
      });
    }
  },

  prefetchOlderMessages: async (conversationId: string, userId: string, limit = 50) => {
    const currentMessages = get().messagesByConversation[conversationId] || [];
    const historyMeta = get().historyMetaByConversation[conversationId];
    const beforeId = historyMeta?.oldestLoadedMessageId || currentMessages[0]?.id || null;
    if (!beforeId || historyMeta?.hasMore === false) return;

    const prefetchedOlder = historyMeta?.prefetchedOlder;
    if (
      prefetchedOlder?.beforeId === beforeId &&
      Date.now() - prefetchedOlder.prefetchedAt < DM_PREFETCH_CACHE_EXPIRY_MS
    ) {
      return;
    }

    const inflightKey = `${conversationId}:${beforeId}:${limit}`;
    const existingInflight = inflightDMPrefetches.get(inflightKey);
    if (existingInflight) return existingInflight;

    const p = (async () => {
      try {
        const page = await loadDMMessagePage(conversationId, userId, limit, beforeId);
        set((state) => {
          const currentMeta = state.historyMetaByConversation[conversationId];
          const currentList = state.messagesByConversation[conversationId] || [];
          const currentBeforeId = currentMeta?.oldestLoadedMessageId || currentList[0]?.id || null;
          if (!currentBeforeId || currentBeforeId !== beforeId) return state;

          return {
            historyMetaByConversation: {
              ...state.historyMetaByConversation,
              [conversationId]: {
                ...(currentMeta || { hasMore: true, oldestLoadedMessageId: beforeId }),
                prefetchedOlder: {
                  beforeId,
                  messages: page.messages,
                  hasMore: page.hasMore,
                  oldestLoadedMessageId: page.oldestLoadedMessageId,
                  prefetchedAt: Date.now(),
                },
              },
            },
          };
        });
      } catch (error) {
        console.error("Failed to prefetch older DM messages:", error);
      }
    })().finally(() => {
      const cur = inflightDMPrefetches.get(inflightKey);
      if (cur === p) inflightDMPrefetches.delete(inflightKey);
    });

    inflightDMPrefetches.set(inflightKey, p);
    return p;
  },

  sendMessage: async (conversationId: string, senderId: string, content: string, replyToId?: string) => {
    try {
      // Use RPC function to send message
      const { data, error } = await supabase.rpc("send_dm", {
        _conversation_id: conversationId,
        _sender_id: senderId,
        _content: content,
        _reply_to_id: replyToId || null,
      });

      if (error) throw error;

      const msgData = data as {
        id: string;
        conversation_id: string;
        sender_id: string;
        content: string;
        reply_to_id: string | null;
        edited_at: string | null;
        created_at: string;
      };

      // Cache sender data instead of embedding on message
      const localUser = useAuthStore.getState().user;
      const senderData = localUser?.id === senderId ? localUser : await fetchAndCacheUser(senderId);
      if (senderData) {
        useUserCacheStore.getState().upsertUser(senderData as unknown as User);
      }

      // Look up reply_to from local cache if replyToId is provided
      let reply_to: DirectMessage | null = null;
      if (replyToId) {
        const cachedMessages = get().messagesByConversation[conversationId] || [];
        const replyMsg = cachedMessages.find((m) => m.id === replyToId);
        if (replyMsg) {
          reply_to = replyMsg;
        }
      }

      const message: DirectMessage = {
        id: msgData.id,
        conversation_id: msgData.conversation_id,
        sender_id: msgData.sender_id,
        content: msgData.content,
        reply_to_id: msgData.reply_to_id,
        edited_at: msgData.edited_at,
        created_at: msgData.created_at,
        reply_to,
        attachments: [],
        reactions: [],
      };

      // Add message to local state immediately (optimistic update)
      // This ensures the sender sees their message even if Realtime is delayed
      get().addMessage(conversationId, message);

      // Broadcast to the conversation channel so other participants receive it instantly
      trySendBroadcast(conversationId, 'new_message', {
        op: 'INSERT',
        message: {
          id: msgData.id,
          conversation_id: msgData.conversation_id,
          sender_id: msgData.sender_id,
          content: msgData.content,
          reply_to_id: msgData.reply_to_id,
          edited_at: msgData.edited_at,
          created_at: msgData.created_at,
        },
      });

      return message;
    } catch (error) {
      console.error("Failed to send DM:", error);
      return null;
    }
  },

  editMessage: async (messageId: string, senderId: string, content: string) => {
    try {
      // Use RPC function to edit message
      const { data, error } = await supabase.rpc("edit_dm", {
        _message_id: messageId,
        _sender_id: senderId,
        _content: content,
      });

      if (error) throw error;

      const editedData = data as { content: string; edited_at: string };

      // Find conversationId before updating state
      let foundConversationId: string | null = null;
      const currentMessages = get().messagesByConversation;
      for (const convId in currentMessages) {
        if (currentMessages[convId].some((m) => m.id === messageId)) {
          foundConversationId = convId;
          break;
        }
      }

      // Update local state
      set((state) => {
        const newMessagesByConversation = { ...state.messagesByConversation };
        for (const conversationId in newMessagesByConversation) {
          newMessagesByConversation[conversationId] = newMessagesByConversation[conversationId].map((m) =>
            m.id === messageId ? { ...m, content: editedData.content, edited_at: editedData.edited_at } : m,
          );
        }
        return { messagesByConversation: newMessagesByConversation };
      });

      // Broadcast edit to other participants
      if (foundConversationId) {
        trySendBroadcast(foundConversationId, 'message_updated', {
          op: 'UPDATE',
          message: { id: messageId, conversation_id: foundConversationId, content: editedData.content, edited_at: editedData.edited_at },
        });
      }
    } catch (error) {
      console.error("Failed to edit DM:", error);
    }
  },

  deleteMessage: async (messageId: string, senderId: string) => {
    try {
      // Use RPC function to delete message
      const { error } = await supabase.rpc("delete_dm", {
        _message_id: messageId,
        _sender_id: senderId,
      });

      if (error) throw error;

      // Find conversationId before updating state
      let foundConversationId: string | null = null;
      const currentMessages = get().messagesByConversation;
      for (const convId in currentMessages) {
        if (currentMessages[convId].some((m) => m.id === messageId)) {
          foundConversationId = convId;
          break;
        }
      }

      // Update local state
      set((state) => {
        const newMessagesByConversation = { ...state.messagesByConversation };
        for (const conversationId in newMessagesByConversation) {
          newMessagesByConversation[conversationId] = newMessagesByConversation[conversationId].filter(
            (m) => m.id !== messageId,
          );
        }
        return { messagesByConversation: newMessagesByConversation };
      });

      // Broadcast delete to other participants
      if (foundConversationId) {
        trySendBroadcast(foundConversationId, 'message_deleted', {
          op: 'DELETE',
          message: { id: messageId, conversation_id: foundConversationId },
        });
      }
    } catch (error) {
      console.error("Failed to delete DM:", error);
    }
  },

  addReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      // Use RPC function to add reaction
      const { error } = await supabase.rpc("add_dm_reaction", {
        _message_id: messageId,
        _user_id: userId,
        _emoji: emoji,
      });

      if (error) throw error;

      // Update local state optimistically
      set((state) => {
        const newMessagesByConversation = { ...state.messagesByConversation };
        for (const conversationId in newMessagesByConversation) {
          newMessagesByConversation[conversationId] = newMessagesByConversation[conversationId].map((m) => {
            if (m.id === messageId) {
              const reactions = [...(m.reactions || [])];
              const existingReaction = reactions.find((r) => r.emoji === emoji);
              if (existingReaction) {
                // Idempotency: avoid double-increment if we already have this user's reaction
                // (can happen if a realtime refresh races this local update).
                if (existingReaction.users.includes(userId)) {
                  existingReaction.hasReacted = true;
                  return { ...m, reactions };
                }
                existingReaction.count += 1;
                existingReaction.users.push(userId);
                existingReaction.hasReacted = true;
              } else {
                reactions.push({ emoji, count: 1, users: [userId], hasReacted: true });
              }
              return { ...m, reactions };
            }
            return m;
          });
        }
        return { messagesByConversation: newMessagesByConversation };
      });

      // Broadcast reaction to other participants
      const { messagesByConversation } = get();
      let foundConvId: string | null = null;
      for (const convId in messagesByConversation) {
        if (messagesByConversation[convId].some((m) => m.id === messageId)) {
          foundConvId = convId;
          break;
        }
      }
      if (foundConvId) {
        trySendBroadcast(foundConvId, 'reaction_added', {
          message_id: messageId, conversation_id: foundConvId, user_id: userId, emoji,
        });
      }
    } catch (error) {
      console.error("Failed to add reaction:", error);
    }
  },

  removeReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      // Use RPC function to remove reaction
      const { error } = await supabase.rpc("remove_dm_reaction", {
        _message_id: messageId,
        _user_id: userId,
        _emoji: emoji,
      });

      if (error) throw error;

      // Update local state
      set((state) => {
        const newMessagesByConversation = { ...state.messagesByConversation };
        for (const conversationId in newMessagesByConversation) {
          newMessagesByConversation[conversationId] = newMessagesByConversation[conversationId].map((m) => {
            if (m.id === messageId) {
              const reactions = (m.reactions || [])
                .map((r) => {
                  if (r.emoji === emoji) {
                    // Idempotency: don't decrement if the user isn't present
                    if (!r.users.includes(userId)) return r;
                    return {
                      ...r,
                      count: r.count - 1,
                      users: r.users.filter((u) => u !== userId),
                      hasReacted: false,
                    };
                  }
                  return r;
                })
                .filter((r) => r.count > 0);
              return { ...m, reactions };
            }
            return m;
          });
        }
        return { messagesByConversation: newMessagesByConversation };
      });

      // Broadcast reaction removal to other participants
      const { messagesByConversation } = get();
      let foundConvId: string | null = null;
      for (const convId in messagesByConversation) {
        if (messagesByConversation[convId].some((m) => m.id === messageId)) {
          foundConvId = convId;
          break;
        }
      }
      if (foundConvId) {
        trySendBroadcast(foundConvId, 'reaction_removed', {
          message_id: messageId, conversation_id: foundConvId, user_id: userId, emoji,
        });
      }
    } catch (error) {
      console.error("Failed to remove reaction:", error);
    }
  },

  addMessage: (conversationId: string, message: DirectMessage) => {
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationId] || [];

      // Check for duplicate
      if (currentMessages.some((m) => m.id === message.id)) {
        return state;
      }

      const updated = {
        ...state.messagesByConversation,
        [conversationId]: [...currentMessages, message],
      };

      return {
        messagesByConversation: pruneDMMessageCache(updated, state.currentConversation?.id),
      };
    });
  },

  updateMessage: (conversationId: string, messageId: string, updates: Partial<DirectMessage>) => {
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationId] || [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: currentMessages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
        },
      };
    });
  },

  removeMessage: (conversationId: string, messageId: string) => {
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationId] || [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: currentMessages.filter((m) => m.id !== messageId),
        },
      };
    });
  },

  updateConversation: (conversationId, updates) => {
    set((state) => ({
      conversations: state.conversations.map((c) => (c.id === conversationId ? { ...c, ...updates } : c)),
    }));
  },

  getMessages: (conversationId: string) => {
    return get().messagesByConversation[conversationId] || [];
  },

  updateGroupName: async (conversationId: string, userId: string, newName: string) => {
    try {
      const { error } = await supabase.rpc("update_group_dm_name", {
        _conversation_id: conversationId,
        _user_id: userId,
        _new_name: newName,
      });

      if (error) throw error;

      // Update local state
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, name: newName.trim() || null } : c,
        ),
        currentConversation:
          state.currentConversation?.id === conversationId
            ? { ...state.currentConversation, name: newName.trim() || null }
            : state.currentConversation,
      }));

      return true;
    } catch (error) {
      console.error("Failed to update group name:", error);
      return false;
    }
  },

  addGroupMembers: async (conversationId: string, userId: string, memberIds: string[]) => {
    try {
      const { error } = await supabase.rpc("add_group_dm_members", {
        _conversation_id: conversationId,
        _user_id: userId,
        _new_member_ids: memberIds,
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Failed to add group members:", error);
      return false;
    }
  },

  leaveGroup: async (conversationId: string, userId: string) => {
    try {
      const { error } = await supabase.rpc("leave_group_dm", {
        _conversation_id: conversationId,
        _user_id: userId,
      });

      if (error) throw error;

      // Remove conversation from local state
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        currentConversation: state.currentConversation?.id === conversationId ? null : state.currentConversation,
        messagesByConversation: Object.fromEntries(
          Object.entries(state.messagesByConversation).filter(([key]) => key !== conversationId),
        ),
      }));

      return true;
    } catch (error) {
      console.error("Failed to leave group:", error);
      return false;
    }
  },

  kickGroupMember: async (conversationId: string, kickerId: string, targetUserId: string) => {
    try {
      const { data, error } = await supabase.rpc("kick_group_dm_member" as any, {
        _conversation_id: conversationId,
        _kicker_id: kickerId,
        _target_user_id: targetUserId,
      });

      if (error) throw error;
      return data === true;
    } catch (error) {
      console.error("Failed to kick group member:", error);
      return false;
    }
  },
}));
