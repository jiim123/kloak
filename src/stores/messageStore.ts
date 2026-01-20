import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import type { Message, MessageReply, ReactionGroup, User } from '@/types';

interface ChannelMessages {
  messages: Message[];
  hasMore: boolean;
  lastFetched: number;
}

interface MessageState {
  // Cache messages by channel ID
  messagesByChannel: Record<string, ChannelMessages>;
  currentChannelId: string | null;
  isLoading: boolean;
  replyingTo: Message | null;

  // Computed getter for current channel messages
  getMessages: () => Message[];
  getHasMore: () => boolean;

  // Channel management
  setCurrentChannel: (channelId: string | null) => void;

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

  // Realtime actions (need channelId for cache)
  addMessage: (message: Message) => void;
  updateMessage: (messageId: string, updates: Partial<Message>) => void;
  removeMessage: (messageId: string) => void;
  clearMessages: () => void;
  clearChannelCache: (channelId: string) => void;
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

// Cache expiry time - 5 minutes
const CACHE_EXPIRY_MS = 5 * 60 * 1000;

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByChannel: {},
  currentChannelId: null,
  isLoading: false,
  replyingTo: null,

  getMessages: () => {
    const { currentChannelId, messagesByChannel } = get();
    if (!currentChannelId) return [];
    return messagesByChannel[currentChannelId]?.messages || [];
  },

  getHasMore: () => {
    const { currentChannelId, messagesByChannel } = get();
    if (!currentChannelId) return true;
    return messagesByChannel[currentChannelId]?.hasMore ?? true;
  },

  setCurrentChannel: (channelId) => {
    set({ currentChannelId: channelId, replyingTo: null });
  },

  fetchMessages: async (channelId: string, limit = 50, before?: string) => {
    const { messagesByChannel } = get();
    const cached = messagesByChannel[channelId];
    
    // If we have cached messages and they're fresh, don't refetch (unless paginating)
    if (!before && cached && cached.messages.length > 0) {
      const isFresh = Date.now() - cached.lastFetched < CACHE_EXPIRY_MS;
      if (isFresh) {
        return;
      }
    }

    set({ isLoading: true });

    try {
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

      set((state) => {
        const existingCache = state.messagesByChannel[channelId];
        
        if (before && existingCache) {
          // Prepend older messages to existing cache
          return {
            messagesByChannel: {
              ...state.messagesByChannel,
              [channelId]: {
                messages: [...messages, ...existingCache.messages],
                hasMore,
                lastFetched: existingCache.lastFetched,
              },
            },
            isLoading: false,
          };
        } else {
          // Fresh fetch - replace cache
          return {
            messagesByChannel: {
              ...state.messagesByChannel,
              [channelId]: {
                messages,
                hasMore,
                lastFetched: Date.now(),
              },
            },
            isLoading: false,
          };
        }
      });
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      set({ isLoading: false });
    }
  },

  sendMessage: async (channelId: string, userId: string, content: string, replyToId?: string) => {
    try {
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

      // Prefer local auth user for immediate UI (includes latest avatar_decoration without waiting for RPC)
      const localUser = useAuthStore.getState().user;
      const { data: userData } = localUser?.id === userId
        ? { data: localUser }
        : await supabase.rpc('get_user_by_id' as any, { _user_id: userId });

      // If there's a reply_to_id, fetch the reply data separately
      let replyData: MessageReply | undefined;
      if (replyToId) {
        const messages = get().getMessages();
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

      // Add message to channel cache
      set((state) => {
        const existingCache = state.messagesByChannel[channelId];
        if (!existingCache) return { replyingTo: null };
        
        // Avoid duplicates
        if (existingCache.messages.some((m) => m.id === message.id)) {
          return { replyingTo: null };
        }
        
        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [channelId]: {
              ...existingCache,
              messages: [...existingCache.messages, message],
            },
          },
          replyingTo: null,
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
      const { error } = await supabase.rpc('edit_message', {
        _message_id: messageId,
        _user_id: userId,
        _content: content,
      });

      if (error) throw error;

      const { currentChannelId } = get();
      if (!currentChannelId) return;

      set((state) => {
        const existingCache = state.messagesByChannel[currentChannelId];
        if (!existingCache) return state;

        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [currentChannelId]: {
              ...existingCache,
              messages: existingCache.messages.map((m) =>
                m.id === messageId
                  ? { ...m, content, edited_at: new Date().toISOString() }
                  : m
              ),
            },
          },
        };
      });
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  },

  deleteMessage: async (messageId: string, userId: string) => {
    try {
      const { error } = await supabase.rpc('delete_message', {
        _message_id: messageId,
        _user_id: userId,
      });

      if (error) throw error;

      const { currentChannelId } = get();
      if (!currentChannelId) return;

      set((state) => {
        const existingCache = state.messagesByChannel[currentChannelId];
        if (!existingCache) return state;

        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [currentChannelId]: {
              ...existingCache,
              messages: existingCache.messages.filter((m) => m.id !== messageId),
            },
          },
        };
      });
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  },

  pinMessage: async (messageId: string, isPinned: boolean, userId: string) => {
    try {
      const { error } = await supabase.rpc('toggle_pin_message', {
        _message_id: messageId,
        _user_id: userId,
      });

      if (error) throw error;

      const { currentChannelId } = get();
      if (!currentChannelId) return;

      set((state) => {
        const existingCache = state.messagesByChannel[currentChannelId];
        if (!existingCache) return state;

        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [currentChannelId]: {
              ...existingCache,
              messages: existingCache.messages.map((m) =>
                m.id === messageId ? { ...m, is_pinned: isPinned } : m
              ),
            },
          },
        };
      });
    } catch (error) {
      console.error('Failed to pin message:', error);
    }
  },

  addReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      const { error } = await supabase.rpc('add_reaction', {
        _message_id: messageId,
        _user_id: userId,
        _emoji: emoji,
      });

      if (error) throw error;

      const { currentChannelId } = get();
      if (!currentChannelId) return;

      set((state) => {
        const existingCache = state.messagesByChannel[currentChannelId];
        if (!existingCache) return state;

        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [currentChannelId]: {
              ...existingCache,
              messages: existingCache.messages.map((m) => {
                if (m.id !== messageId) return m;

                const reactions = [...(m.reactions || [])];
                const existingGroup = reactions.find((r) => r.emoji === emoji);

                if (existingGroup) {
                  // Idempotency: if we already have this user's reaction (e.g. realtime update raced),
                  // don't double-increment.
                  if (existingGroup.users.includes(userId)) {
                    existingGroup.hasReacted = true;
                    return { ...m, reactions };
                  }
                  existingGroup.count += 1;
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
            },
          },
        };
      });
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  },

  removeReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      const { error } = await supabase.rpc('remove_reaction', {
        _message_id: messageId,
        _user_id: userId,
        _emoji: emoji,
      });

      if (error) throw error;

      const { currentChannelId } = get();
      if (!currentChannelId) return;

      set((state) => {
        const existingCache = state.messagesByChannel[currentChannelId];
        if (!existingCache) return state;

        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [currentChannelId]: {
              ...existingCache,
              messages: existingCache.messages.map((m) => {
                if (m.id !== messageId) return m;

                const reactions = (m.reactions || [])
                  .map((r) => {
                    if (r.emoji !== emoji) return r;
                    // Idempotency: if we don't have this user's reaction, don't decrement.
                    if (!r.users.includes(userId)) return r;
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
            },
          },
        };
      });
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),

  addMessage: (message) => {
    const channelId = message.channel_id;
    if (!channelId) return;

    set((state) => {
      const existingCache = state.messagesByChannel[channelId];
      if (!existingCache) {
        // Create new cache for this channel
        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [channelId]: {
              messages: [message],
              hasMore: true,
              lastFetched: Date.now(),
            },
          },
        };
      }

      // Avoid duplicates
      if (existingCache.messages.some((m) => m.id === message.id)) {
        return state;
      }

      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [channelId]: {
            ...existingCache,
            messages: [...existingCache.messages, message],
          },
        },
      };
    });
  },

  updateMessage: (messageId, updates) => {
    // Get channel_id from the updates if provided, otherwise search all channels
    const channelId = (updates as any).channel_id;
    
    set((state) => {
      // If we have a channel_id, update that specific channel
      if (channelId && state.messagesByChannel[channelId]) {
        const existingCache = state.messagesByChannel[channelId];
        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [channelId]: {
              ...existingCache,
              messages: existingCache.messages.map((m) =>
                m.id === messageId ? { ...m, ...updates } : m
              ),
            },
          },
        };
      }
      
      // Otherwise, search all channels for this message
      const newMessagesByChannel = { ...state.messagesByChannel };
      for (const [chId, cache] of Object.entries(newMessagesByChannel)) {
        const msgIndex = cache.messages.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          newMessagesByChannel[chId] = {
            ...cache,
            messages: cache.messages.map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          };
          break;
        }
      }
      return { messagesByChannel: newMessagesByChannel };
    });
  },

  removeMessage: (messageId) => {
    set((state) => {
      // Search all channels for this message
      const newMessagesByChannel = { ...state.messagesByChannel };
      for (const [chId, cache] of Object.entries(newMessagesByChannel)) {
        const msgIndex = cache.messages.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          newMessagesByChannel[chId] = {
            ...cache,
            messages: cache.messages.filter((m) => m.id !== messageId),
          };
          break;
        }
      }
      return { messagesByChannel: newMessagesByChannel };
    });
  },

  clearMessages: () => set({ messagesByChannel: {}, replyingTo: null }),
  
  clearChannelCache: (channelId: string) => {
    set((state) => {
      const { [channelId]: _, ...rest } = state.messagesByChannel;
      return { messagesByChannel: rest };
    });
  },
}));

// Legacy compatibility - expose messages as a computed value
// Components should migrate to using getMessages() instead
Object.defineProperty(useMessageStore.getState(), 'messages', {
  get() {
    return this.getMessages();
  },
});

Object.defineProperty(useMessageStore.getState(), 'hasMore', {
  get() {
    return this.getHasMore();
  },
});
