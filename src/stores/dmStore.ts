import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useUserCacheStore, bulkSetUsersInCache } from "@/stores/userCacheStore";
import type { DMConversation, DirectMessage, User, ReactionGroup } from "@/types";

interface DMState {
  conversations: DMConversation[];
  currentConversation: DMConversation | null;
  // Store messages per conversation to persist them
  messagesByConversation: Record<string, DirectMessage[]>;
  isLoading: boolean;

  // Conversation actions
  fetchConversations: (userId: string) => Promise<void>;
  openConversation: (userId: string, otherUserId: string) => Promise<DMConversation | null>;
  createGroupConversation: (userId: string, participantIds: string[], name?: string) => Promise<DMConversation | null>;
  setCurrentConversation: (conversation: DMConversation | null) => void;
  closeConversation: (conversationId: string, userId: string) => Promise<boolean>;

  // Message actions
  fetchMessages: (conversationId: string, userId: string, limit?: number, before?: string) => Promise<void>;
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

export const useDMStore = create<DMState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messagesByConversation: {},
  isLoading: false,

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

      set({ conversations, isLoading: false });
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
      const { data: userData } = await supabase.rpc("get_user_by_id", {
        _user_id: otherUserId,
      });

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

    try {
      // Use RPC function to fetch messages
      const { data, error } = await supabase.rpc("get_dm_messages", {
        _conversation_id: conversationId,
        _user_id: userId,
        _limit: limit,
        _before_id: before || null,
      });

      if (error) throw error;

      const dataArray = Array.isArray(data) ? data : [];

      // Fetch reactions separately for each message
      const messageIds = dataArray.map((msg: any) => msg.id);

      let reactions: any[] = [];
      if (messageIds.length > 0) {
        // Only fetch columns we need (optimized query)
        const { data: reactionData } = await supabase
          .from("dm_reactions")
          .select("id, message_id, user_id, emoji")
          .in("message_id", messageIds);
        reactions = reactionData || [];
      }

      // Extract sender data into user cache, then strip from messages
      const uniqueUsers = new Map<string, User>();
      for (const msg of dataArray) {
        if ((msg as any).sender && typeof (msg as any).sender === 'object' && (msg as any).sender.id) {
          uniqueUsers.set((msg as any).sender.id, (msg as any).sender as User);
        }
      }
      if (uniqueUsers.size > 0) {
        bulkSetUsersInCache(Array.from(uniqueUsers.values()));
        useUserCacheStore.getState().upsertUsers(Array.from(uniqueUsers.values()));
      }

      const reversedData = [...dataArray].reverse();

      // Collect reply_to_ids that need fetching
      const replyToIds = reversedData
        .map((msg: any) => msg.reply_to_id)
        .filter((id: string | null): id is string => !!id);

      // Batch-fetch replied-to messages with sender info
      const replyToMap: Record<string, Partial<DirectMessage>> = {};
      if (replyToIds.length > 0) {
        const uniqueReplyIds = [...new Set(replyToIds)];
        // First check if any are in the current batch
        const batchMap = new Map(reversedData.map((m: any) => [m.id, m]));
        const missingIds = uniqueReplyIds.filter((id) => !batchMap.has(id));

        // Map from batch
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

        // Fetch missing ones from guarded RPC
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
          attachments: [],
          reactions: groupReactions(msgReactions, userId),
        };
      });

      set((state) => {
        const currentMessages = state.messagesByConversation[conversationId] || [];

        if (before) {
          // Prepend older messages
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: [...messages, ...currentMessages],
            },
            isLoading: false,
          };
        } else {
          // Replace with fresh messages
          return {
            messagesByConversation: {
              ...state.messagesByConversation,
              [conversationId]: messages,
            },
            isLoading: false,
          };
        }
      });
    } catch (error) {
      console.error("Failed to fetch DM messages:", error);
      set({ isLoading: false });
    }
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
      const senderData =
        localUser?.id === senderId ? localUser : (await supabase.rpc("get_user_by_id", { _user_id: senderId })).data;
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
