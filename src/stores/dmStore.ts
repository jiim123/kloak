import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { DMConversation, DirectMessage, User, ReactionGroup } from '@/types';

interface DMState {
  conversations: DMConversation[];
  currentConversation: DMConversation | null;
  // Store messages per conversation to persist them
  messagesByConversation: Record<string, DirectMessage[]>;
  isLoading: boolean;

  // Conversation actions
  fetchConversations: (userId: string) => Promise<void>;
  openConversation: (userId: string, otherUserId: string) => Promise<DMConversation | null>;
  setCurrentConversation: (conversation: DMConversation | null) => void;

  // Message actions
  fetchMessages: (conversationId: string, userId: string, limit?: number, before?: string) => Promise<void>;
  sendMessage: (conversationId: string, senderId: string, content: string, replyToId?: string) => Promise<DirectMessage | null>;
  editMessage: (messageId: string, senderId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string, senderId: string) => Promise<void>;

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

export const useDMStore = create<DMState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messagesByConversation: {},
  isLoading: false,

  fetchConversations: async (userId: string) => {
    set({ isLoading: true });

    try {
      // Use RPC function to fetch conversations
      const { data, error } = await supabase.rpc('get_user_dm_conversations', {
        _user_id: userId,
      });

      if (error) throw error;

      const dataArray = Array.isArray(data) ? data : [];
      const conversations: DMConversation[] = dataArray.map((conv: any) => {
        const otherParticipant = conv.participants?.find(
          (p: any) => p.user_id !== userId
        );

        return {
          id: conv.id,
          created_at: conv.created_at,
          other_user: otherParticipant?.user as User,
          last_message: conv.last_message as DirectMessage,
        };
      });

      set({ conversations, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      set({ isLoading: false });
    }
  },

  openConversation: async (userId: string, otherUserId: string) => {
    try {
      // Use RPC function to open or create conversation
      const { data, error } = await supabase.rpc('open_dm_conversation', {
        _user_id: userId,
        _other_user_id: otherUserId,
      });

      if (error) throw error;

      const convData = data as { id: string; created_at: string };

      // Fetch other user details
      const { data: userData } = await supabase.rpc('get_user_by_id', {
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
      console.error('Failed to open conversation:', error);
      return null;
    }
  },

  setCurrentConversation: (conversation) => {
    // Persist current conversation ID for restoration
    if (conversation) {
      localStorage.setItem('kloak-current-dm-id', conversation.id);
    } else {
      localStorage.removeItem('kloak-current-dm-id');
    }
    set({ currentConversation: conversation });
  },

  fetchMessages: async (conversationId: string, userId: string, limit = 50, before?: string) => {
    set({ isLoading: true });

    try {
      // Use RPC function to fetch messages
      const { data, error } = await supabase.rpc('get_dm_messages', {
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
        const { data: reactionData } = await supabase
          .from('dm_reactions')
          .select('*')
          .in('message_id', messageIds);
        reactions = reactionData || [];
      }

      const messages: DirectMessage[] = [...dataArray].reverse().map((msg: any) => {
        const msgReactions = reactions.filter((r) => r.message_id === msg.id);
        return {
          ...msg,
          reply_to: null,
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
      console.error('Failed to fetch DM messages:', error);
      set({ isLoading: false });
    }
  },

  sendMessage: async (conversationId: string, senderId: string, content: string, replyToId?: string) => {
    try {
      // Use RPC function to send message
      const { data, error } = await supabase.rpc('send_dm', {
        _conversation_id: conversationId,
        _sender_id: senderId,
        _content: content,
        _reply_to_id: replyToId || null,
      });

      if (error) throw error;

      const msgData = data as { id: string; conversation_id: string; sender_id: string; content: string; reply_to_id: string | null; edited_at: string | null; created_at: string };

      // Fetch sender details
      const { data: userData } = await supabase.rpc('get_user_by_id', {
        _user_id: senderId,
      });

      const message: DirectMessage = {
        ...msgData,
        sender: userData as unknown as User,
        attachments: [],
        reactions: [],
      };

      return message;
    } catch (error) {
      console.error('Failed to send DM:', error);
      return null;
    }
  },

  editMessage: async (messageId: string, senderId: string, content: string) => {
    try {
      // Use RPC function to edit message
      const { data, error } = await supabase.rpc('edit_dm', {
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
            m.id === messageId ? { ...m, content: editedData.content, edited_at: editedData.edited_at } : m
          );
        }
        return { messagesByConversation: newMessagesByConversation };
      });
    } catch (error) {
      console.error('Failed to edit DM:', error);
    }
  },

  deleteMessage: async (messageId: string, senderId: string) => {
    try {
      // Use RPC function to delete message
      const { error } = await supabase.rpc('delete_dm', {
        _message_id: messageId,
        _sender_id: senderId,
      });

      if (error) throw error;

      // Update local state
      set((state) => {
        const newMessagesByConversation = { ...state.messagesByConversation };
        for (const conversationId in newMessagesByConversation) {
          newMessagesByConversation[conversationId] = newMessagesByConversation[conversationId].filter(
            (m) => m.id !== messageId
          );
        }
        return { messagesByConversation: newMessagesByConversation };
      });
    } catch (error) {
      console.error('Failed to delete DM:', error);
    }
  },

  addReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      // Use RPC function to add reaction
      const { error } = await supabase.rpc('add_dm_reaction', {
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
                existingReaction.count++;
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
      console.error('Failed to add reaction:', error);
    }
  },

  removeReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      // Use RPC function to remove reaction
      const { error } = await supabase.rpc('remove_dm_reaction', {
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
      console.error('Failed to remove reaction:', error);
    }
  },

  addMessage: (conversationId: string, message: DirectMessage) => {
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationId] || [];
      
      // Check for duplicate
      if (currentMessages.some((m) => m.id === message.id)) {
        return state;
      }
      
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: [...currentMessages, message],
        },
      };
    });
  },

  updateMessage: (conversationId: string, messageId: string, updates: Partial<DirectMessage>) => {
    set((state) => {
      const currentMessages = state.messagesByConversation[conversationId] || [];
      return {
        messagesByConversation: {
          ...state.messagesByConversation,
          [conversationId]: currentMessages.map((m) =>
            m.id === messageId ? { ...m, ...updates } : m
          ),
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
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, ...updates } : c
      ),
    }));
  },

  getMessages: (conversationId: string) => {
    return get().messagesByConversation[conversationId] || [];
  },
}));
