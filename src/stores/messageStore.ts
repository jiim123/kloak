import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { Message, MessageReply, MessageAttachment, ReactionGroup, User } from '@/types';

interface MessageState {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  replyingTo: Message | null;

  // Fetch actions
  fetchMessages: (channelId: string, limit?: number, before?: string) => Promise<void>;

  // Message actions
  sendMessage: (channelId: string, userId: string, content: string, replyToId?: string) => Promise<Message | null>;
  editMessage: (messageId: string, content: string, userId: string) => Promise<void>;
  deleteMessage: (messageId: string, userId: string) => Promise<void>;
  pinMessage: (messageId: string, isPinned: boolean, userId: string) => Promise<void>;

  // Reaction actions
  addReaction: (messageId: string, userId: string, emoji: string) => Promise<void>;
  removeReaction: (messageId: string, userId: string, emoji: string) => Promise<void>;

  // Reply actions
  setReplyingTo: (message: Message | null) => void;

  // Realtime actions
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
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

export const useMessageStore = create<MessageState>((set, get) => ({
  messages: [],
  isLoading: false,
  hasMore: true,
  replyingTo: null,

  fetchMessages: async (channelId: string, limit = 50, before?: string) => {
    set({ isLoading: true });

    try {
      // Fetch messages without self-referential join to avoid PostgREST issues
      let query = supabase
        .from('messages')
        .select(`
          *,
          user:users (*),
          attachments:message_attachments (*),
          reactions (*)
        `)
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Get reply_to_ids that need to be fetched
      const replyToIds = (data || [])
        .filter((msg: any) => msg.reply_to_id)
        .map((msg: any) => msg.reply_to_id);

      // Fetch reply messages separately if there are any
      let replyMap: Record<string, MessageReply> = {};
      if (replyToIds.length > 0) {
        const { data: replyData } = await supabase
          .from('messages')
          .select('id, content, user:users (*)')
          .in('id', replyToIds);

        if (replyData) {
          replyData.forEach((reply: any) => {
            replyMap[reply.id] = {
              id: reply.id,
              content: reply.content,
              user: reply.user as User,
            };
          });
        }
      }

      const messages: Message[] = (data || []).reverse().map((msg: any) => ({
        ...msg,
        user: msg.user,
        reply_to: msg.reply_to_id ? replyMap[msg.reply_to_id] : undefined,
        attachments: msg.attachments || [],
        reactions: groupReactions(msg.reactions || []),
      }));

      const hasMore = messages.length === limit;

      if (before) {
        // Prepend older messages
        set((state) => ({
          messages: [...messages, ...state.messages],
          hasMore,
          isLoading: false,
        }));
      } else {
        set({ messages, hasMore, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set({ isLoading: false });
    }
  },

  sendMessage: async (channelId: string, userId: string, content: string, replyToId?: string) => {
    try {
      // Use RPC function to bypass RLS
      const { data, error } = await supabase.rpc('send_message', {
        _channel_id: channelId,
        _user_id: userId,
        _content: content,
        _reply_to_id: replyToId || null,
      });

      if (error) {
        if (error.message.includes('muted')) {
          throw new Error('You are muted in this server');
        }
        throw error;
      }

      // Get the current user from authStore for the message
      const { data: userData } = await supabase.rpc('get_user_by_id' as any, { _user_id: userId });

      // If there's a reply_to_id, fetch the reply data separately
      let replyData: MessageReply | undefined;
      if (replyToId) {
        const { messages } = get();
        const replyMsg = messages.find(m => m.id === replyToId);
        if (replyMsg) {
          replyData = {
            id: replyMsg.id,
            content: replyMsg.content,
            user: replyMsg.user,
          };
        }
      }

      const msgData = data as any;
      const userDataParsed = userData as unknown as User;
      const message: Message = {
        id: msgData.id,
        channel_id: msgData.channel_id,
        user_id: msgData.user_id,
        reply_to_id: msgData.reply_to_id,
        content: msgData.content,
        is_pinned: msgData.is_pinned || false,
        edited_at: msgData.edited_at,
        created_at: msgData.created_at,
        user: userDataParsed,
        reply_to: replyData,
        attachments: [],
        reactions: [],
      };

      // Add message to local state immediately (optimistic update)
      set((state) => {
        // Avoid duplicates
        if (state.messages.some((m) => m.id === message.id)) {
          return { replyingTo: null };
        }
        return { 
          messages: [...state.messages, message],
          replyingTo: null 
        };
      });

      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      return null;
    }
  },

  editMessage: async (messageId: string, content: string, userId: string) => {
    try {
      // Use RPC function to bypass RLS
      const { error } = await supabase.rpc('edit_message', {
        _message_id: messageId,
        _user_id: userId,
        _content: content,
      });

      if (error) throw error;

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId
            ? { ...m, content, edited_at: new Date().toISOString() }
            : m
        ),
      }));
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  },

  deleteMessage: async (messageId: string, userId: string) => {
    try {
      // Use RPC function to bypass RLS
      const { error } = await supabase.rpc('delete_message', {
        _message_id: messageId,
        _user_id: userId,
      });

      if (error) throw error;

      set((state) => ({
        messages: state.messages.filter((m) => m.id !== messageId),
      }));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  },

  pinMessage: async (messageId: string, isPinned: boolean, userId: string) => {
    try {
      // Use RPC function to bypass RLS
      const { error } = await supabase.rpc('toggle_pin_message', {
        _message_id: messageId,
        _user_id: userId,
      });

      if (error) throw error;

      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === messageId ? { ...m, is_pinned: isPinned } : m
        ),
      }));
    } catch (error) {
      console.error('Failed to pin message:', error);
    }
  },

  addReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      // Use RPC function to bypass RLS
      const { error } = await supabase.rpc('add_reaction', {
        _message_id: messageId,
        _user_id: userId,
        _emoji: emoji,
      });

      if (error) throw error;

      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.id !== messageId) return m;

          const reactions = [...(m.reactions || [])];
          const existingGroup = reactions.find((r) => r.emoji === emoji);

          if (existingGroup) {
            existingGroup.count++;
            existingGroup.users.push(userId);
            existingGroup.hasReacted = true;
          } else {
            reactions.push({
              emoji,
              count: 1,
              users: [userId],
              hasReacted: true,
            });
          }

          return { ...m, reactions };
        }),
      }));
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  },

  removeReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      // Use RPC function to bypass RLS
      const { error } = await supabase.rpc('remove_reaction', {
        _message_id: messageId,
        _user_id: userId,
        _emoji: emoji,
      });

      if (error) throw error;

      set((state) => ({
        messages: state.messages.map((m) => {
          if (m.id !== messageId) return m;

          const reactions = (m.reactions || [])
            .map((r) => {
              if (r.emoji !== emoji) return r;
              return {
                ...r,
                count: r.count - 1,
                users: r.users.filter((u) => u !== userId),
                hasReacted: false,
              };
            })
            .filter((r) => r.count > 0);

          return { ...m, reactions };
        }),
      }));
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),

  addMessage: (message) => {
    set((state) => {
      // Avoid duplicates
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    });
  },

  updateMessage: (messageId, updates) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, ...updates } : m
      ),
    }));
  },

  removeMessage: (messageId) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    }));
  },

  clearMessages: () => set({ messages: [], hasMore: true, replyingTo: null }),
}));
