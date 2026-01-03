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
  fetchMessages: (conversationId: string, limit?: number, before?: string) => Promise<void>;
  sendMessage: (conversationId: string, senderId: string, content: string, replyToId?: string) => Promise<DirectMessage | null>;

  // Realtime actions
  addMessage: (conversationId: string, message: DirectMessage) => void;
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
      // Fetch conversations where user is a participant
      const { data: participations, error: partError } = await supabase
        .from('dm_participants')
        .select(`
          conversation_id,
          last_read_at,
          conversation:dm_conversations (
            id,
            created_at
          )
        `)
        .eq('user_id', userId);

      if (partError) throw partError;

      const conversationIds = participations?.map((p: any) => p.conversation_id) || [];

      if (conversationIds.length === 0) {
        set({ conversations: [], isLoading: false });
        return;
      }

      // Fetch other participants for each conversation
      const { data: allParticipants, error: allPartError } = await supabase
        .from('dm_participants')
        .select(`
          conversation_id,
          user:users (*)
        `)
        .in('conversation_id', conversationIds)
        .neq('user_id', userId);

      if (allPartError) throw allPartError;

      // Fetch last message for each conversation
      const { data: lastMessages, error: msgError } = await supabase
        .from('direct_messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: false });

      if (msgError) throw msgError;

      // Build conversations with other user and last message
      const conversations: DMConversation[] = participations?.map((p: any) => {
        const otherParticipant = allParticipants?.find(
          (ap: any) => ap.conversation_id === p.conversation_id
        );
        const lastMessage = lastMessages?.find(
          (m: any) => m.conversation_id === p.conversation_id
        );

        return {
          id: p.conversation_id,
          created_at: p.conversation?.created_at,
          other_user: otherParticipant?.user as User,
          last_message: lastMessage as DirectMessage,
        };
      }) || [];

      // Sort by last message time
      conversations.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      set({ conversations, isLoading: false });
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
      set({ isLoading: false });
    }
  },

  openConversation: async (userId: string, otherUserId: string) => {
    try {
      // Check if conversation already exists
      const { data: existingParticipations } = await supabase
        .from('dm_participants')
        .select('conversation_id')
        .eq('user_id', userId);

      const userConversationIds = existingParticipations?.map((p) => p.conversation_id) || [];

      if (userConversationIds.length > 0) {
        const { data: otherParticipation } = await supabase
          .from('dm_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', userConversationIds)
          .single();

        if (otherParticipation) {
          // Conversation exists, fetch it
          const conversation = get().conversations.find(
            (c) => c.id === otherParticipation.conversation_id
          );
          if (conversation) {
            set({ currentConversation: conversation });
            return conversation;
          }
        }
      }

      // Create new conversation
      const { data: newConversation, error: convError } = await supabase
        .from('dm_conversations')
        .insert({})
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      const { error: partError } = await supabase
        .from('dm_participants')
        .insert([
          { conversation_id: newConversation.id, user_id: userId },
          { conversation_id: newConversation.id, user_id: otherUserId },
        ]);

      if (partError) throw partError;

      // Fetch other user details
      const { data: otherUser } = await supabase
        .from('users')
        .select('*')
        .eq('id', otherUserId)
        .single();

      const conversation: DMConversation = {
        id: newConversation.id,
        created_at: newConversation.created_at,
        other_user: otherUser as User,
      };

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

  setCurrentConversation: (conversation) => set({ currentConversation: conversation }),

  fetchMessages: async (conversationId: string, limit = 50, before?: string) => {
    // Check if we already have messages cached for this conversation
    const existingMessages = get().messagesByConversation[conversationId];
    if (existingMessages && existingMessages.length > 0 && !before) {
      // Already have messages, skip loading
      return;
    }

    set({ isLoading: true });

    try {
      let query = supabase
        .from('direct_messages')
        .select(`
          *,
          sender:users (*),
          reply_to:direct_messages!direct_messages_reply_to_id_fkey (
            id,
            content,
            sender:users (*)
          ),
          attachments:dm_attachments (*),
          reactions:dm_reactions (*)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) throw error;

      const messages: DirectMessage[] = (data || []).reverse().map((msg: any) => ({
        ...msg,
        sender: msg.sender,
        reply_to: msg.reply_to,
        attachments: msg.attachments || [],
        reactions: groupReactions(msg.reactions || []),
      }));

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
      const { data, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content,
          reply_to_id: replyToId || null,
        })
        .select(`
          *,
          sender:users (*)
        `)
        .single();

      if (error) throw error;

      const message: DirectMessage = {
        ...data,
        sender: data.sender,
        attachments: [],
        reactions: [],
      };

      return message;
    } catch (error) {
      console.error('Failed to send DM:', error);
      return null;
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
