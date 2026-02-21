import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { bulkSetUsersInCache } from "@/lib/userCache";
import type { Message, MessageReply, ReactionGroup, User } from "@/types";

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

  // Track which channels are currently fetching (for pagination spinners)
  fetchingChannels: Record<string, boolean>;

  replyingTo: Message | null;

  // Computed getter for current channel messages
  getMessages: () => Message[];
  getHasMore: () => boolean;

  // Channel management
  setCurrentChannel: (channelId: string | null) => void;

  // Fetch actions
  fetchMessages: (
    channelId: string,
    limit?: number,
    before?: string,
    force?: boolean,
    silent?: boolean,
  ) => Promise<void>;

  // Message actions
  sendMessage: (channelId: string, userId: string, content: string, replyToId?: string) => Promise<Message | null>;
  sendPoll: (
    channelId: string,
    userId: string,
    question: string,
    options: string[],
    allowMultiple: boolean,
    durationSeconds: number,
    replyToId?: string,
  ) => Promise<Message | null>;
  editMessage: (messageId: string, content: string, userId: string) => Promise<void>;
  deleteMessage: (messageId: string, userId: string) => Promise<void>;
  pinMessage: (messageId: string, isPinned: boolean, userId: string) => Promise<void>;
  setEmbedHidden: (messageId: string, userId: string, hidden: boolean) => Promise<void>;

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

// In-flight request coalescing (prevents duplicate message fetches during rapid switching)
const inflightFetches = new Map<string, Promise<void>>();

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByChannel: {},
  currentChannelId: null,
  isLoading: false,
  fetchingChannels: {},
  replyingTo: null,

  getMessages: () => {
    const { currentChannelId, messagesByChannel } = get();
    if (!currentChannelId) return [];
    const msgs = messagesByChannel[currentChannelId]?.messages || [];
    const blocked = useFriendStore.getState().visibilityBlockedUserIds;
    if (!blocked || blocked.length === 0) return msgs;
    const blockedSet = new Set(blocked);
    return msgs.filter((m) => !blockedSet.has(m.user_id));
  },

  getHasMore: () => {
    const { currentChannelId, messagesByChannel } = get();
    if (!currentChannelId) return true;
    return messagesByChannel[currentChannelId]?.hasMore ?? true;
  },

  setCurrentChannel: (channelId) => {
    set({ currentChannelId: channelId, replyingTo: null });
  },

  fetchMessages: async (channelId: string, limit = 50, before?: string, force = false, silent = false) => {
    const inflightKey = `${channelId}:${before ?? ""}:${force ? 1 : 0}:${limit}`;
    const existingInflight = inflightFetches.get(inflightKey);
    if (existingInflight) return existingInflight;

    const p = (async () => {
      const { messagesByChannel } = get();
      const cached = messagesByChannel[channelId];

      // If we have cached messages and they're fresh, don't refetch (unless paginating)
      if (!before && !force && cached && cached.messages.length > 0) {
        const isFresh = Date.now() - cached.lastFetched < CACHE_EXPIRY_MS;
        if (isFresh) {
          return;
        }
      }

      // ─── KEY CHANGE: stale-while-revalidate ───
      // Only show the full-screen skeleton if we have ZERO cached messages for this channel.
      // If we have stale cached messages, show them immediately and fetch silently in background.
      const hasCachedMessages = cached && cached.messages.length > 0;

      if (!hasCachedMessages && !silent) {
        // First-ever visit to this channel — show skeleton
        set({ isLoading: true });
      }

      // Track per-channel fetching (used for pagination spinner only)
      if (before) {
        set((state) => ({
          fetchingChannels: { ...state.fetchingChannels, [channelId]: true },
        }));
      }

      try {
        const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
        const blockedIn = blockedUserIds.length > 0 ? `(${blockedUserIds.map((id) => `"${id}"`).join(",")})` : null;

        let query = supabase
          .from("messages")
          .select(
            `
          *,
          user:users (*),
          attachments:message_attachments (*),
          reactions (*)
        `,
          )
          .eq("channel_id", channelId)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (blockedIn) {
          query = query.not("user_id", "in", blockedIn);
        }

        if (before) {
          query = query.lt("created_at", before);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Get reply_to_ids that need to be fetched
        const replyToIds = (data || []).filter((msg: any) => msg.reply_to_id).map((msg: any) => msg.reply_to_id);

        // Fetch reply messages separately if there are any
        let replyMap: Record<string, MessageReply> = {};
        if (replyToIds.length > 0) {
          let replyQuery = supabase.from("messages").select("id, content, user:users (*)").in("id", replyToIds);

          if (blockedIn) {
            replyQuery = replyQuery.not("user_id", "in", blockedIn);
          }

          const { data: replyData } = await replyQuery;

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

        const currentUserId = useAuthStore.getState().user?.id;
        const messages: Message[] = (data || []).reverse().map((msg: any) => ({
          ...msg,
          user: msg.user,
          reply_to: msg.reply_to_id ? replyMap[msg.reply_to_id] : undefined,
          attachments: msg.attachments || [],
          reactions: groupReactions(
            blockedUserIds.length > 0
              ? (msg.reactions || []).filter((r: any) => !blockedUserIds.includes(r.user_id))
              : msg.reactions || [],
            currentUserId,
          ),
        }));

        // Populate user cache with message authors
        const uniqueUsers = new Map<string, User>();
        messages.forEach((m) => {
          if (m.user) uniqueUsers.set(m.user.id, m.user);
        });
        if (uniqueUsers.size > 0) bulkSetUsersInCache(Array.from(uniqueUsers.values()));

        const hasMore = messages.length === limit;

        set((state) => {
          const existingCache = state.messagesByChannel[channelId];

          // Clear per-channel fetching flag
          const { [channelId]: _, ...restFetching } = state.fetchingChannels;

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
              fetchingChannels: restFetching,
            };
          } else if (force && existingCache && existingCache.messages.length > 0) {
            // Force refetch (e.g., on visibility change) - merge new messages intelligently
            const existingIds = new Set(existingCache.messages.map((m) => m.id));
            const newMessages = messages.filter((m) => !existingIds.has(m.id));

            if (newMessages.length > 0) {
              const merged = [...existingCache.messages, ...newMessages];
              const uniqueById = new Map<string, Message>();
              merged.forEach((msg) => {
                const existing = uniqueById.get(msg.id);
                if (!existing || new Date(msg.created_at).getTime() > new Date(existing.created_at).getTime()) {
                  uniqueById.set(msg.id, msg);
                }
              });
              const sorted = Array.from(uniqueById.values()).sort(
                (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
              );

              return {
                messagesByChannel: {
                  ...state.messagesByChannel,
                  [channelId]: {
                    messages: sorted,
                    hasMore,
                    lastFetched: Date.now(),
                  },
                },
                isLoading: false,
                fetchingChannels: restFetching,
              };
            } else {
              // No new messages, just update timestamp
              return {
                messagesByChannel: {
                  ...state.messagesByChannel,
                  [channelId]: {
                    ...existingCache,
                    lastFetched: Date.now(),
                  },
                },
                isLoading: false,
                fetchingChannels: restFetching,
              };
            }
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
              fetchingChannels: restFetching,
            };
          }
        });
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        set((state) => {
          const { [channelId]: _, ...restFetching } = state.fetchingChannels;
          return { isLoading: false, fetchingChannels: restFetching };
        });
      }
    })().finally(() => {
      const cur = inflightFetches.get(inflightKey);
      if (cur === p) inflightFetches.delete(inflightKey);
    });

    inflightFetches.set(inflightKey, p);
    return p;
  },

  sendMessage: async (channelId: string, userId: string, content: string, replyToId?: string) => {
    try {
      // Use hardened RPC path; direct table INSERT may be intentionally blocked for anon clients.
      const { data, error } = await supabase.rpc("send_message" as any, {
        _channel_id: channelId,
        _user_id: userId,
        _content: content,
        _reply_to_id: replyToId || null,
      });

      if (error) {
        if (error.message.includes("muted")) {
          throw new Error("You are muted in this server");
        }
        throw error;
      }

      // 2. Resolve reply data from local cache for immediate display
      let replyData: MessageReply | undefined;
      if (replyToId) {
        const messages = get().getMessages();
        const replyMsg = messages.find((m) => m.id === replyToId);
        if (replyMsg) {
          replyData = {
            id: replyMsg.id,
            content: replyMsg.content,
            user: replyMsg.user,
          };
        }
      }

      const currentUser = useAuthStore.getState().user;

      // 3. Map RPC response to Message type
      const message: Message = {
        ...data,
        user: currentUser && currentUser.id === userId ? currentUser : undefined,
        reply_to: replyData,
        attachments: [],
        reactions: [], // New messages always start with 0 reactions
      };

      // 4. Update the local state
      set((state) => {
        const existingCache = state.messagesByChannel[channelId];
        if (!existingCache) return { replyingTo: null };

        // Check for duplicates to prevent issues with Realtime subscriptions
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
      console.error("Failed to send message:", error);
      return null;
    }
  },

  sendPoll: async (
    channelId: string,
    userId: string,
    question: string,
    options: string[],
    allowMultiple: boolean,
    durationSeconds: number,
    replyToId?: string,
  ) => {
    try {
      const { data, error } = await supabase.rpc("send_poll" as any, {
        _channel_id: channelId,
        _user_id: userId,
        _question: question,
        _options: options,
        _allow_multiple: allowMultiple,
        _duration_seconds: durationSeconds,
        _reply_to_id: replyToId || null,
      });

      if (error) {
        if (error.message.includes("muted")) {
          throw new Error("You are muted in this server");
        }
        throw error;
      }

      const localUser = useAuthStore.getState().user;
      const { data: userData } =
        localUser?.id === userId
          ? { data: localUser }
          : await supabase.rpc("get_user_by_id" as any, { _user_id: userId });

      let replyData: MessageReply | undefined;
      if (replyToId) {
        const messages = get().getMessages();
        const replyMsg = messages.find((m) => m.id === replyToId);
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

      set((state) => {
        const existingCache = state.messagesByChannel[channelId];
        if (!existingCache) return { replyingTo: null };

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
      console.error("Failed to send poll:", error);
      return null;
    }
  },

  editMessage: async (messageId: string, content: string, userId: string) => {
    try {
      const { error } = await supabase.rpc("edit_message", {
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
                m.id === messageId ? { ...m, content, edited_at: new Date().toISOString() } : m,
              ),
            },
          },
        };
      });
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
  },

  deleteMessage: async (messageId: string, userId: string) => {
    try {
      const { error } = await supabase.rpc("delete_message", {
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
      console.error("Failed to delete message:", error);
    }
  },

  pinMessage: async (messageId: string, isPinned: boolean, userId: string) => {
    try {
      const { error } = await supabase.rpc("pin_message", {
        _message_id: messageId,
        _user_id: userId,
        _pinned: isPinned,
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
              messages: existingCache.messages.map((m) => (m.id === messageId ? { ...m, is_pinned: isPinned } : m)),
            },
          },
        };
      });
    } catch (error) {
      console.error("Failed to pin message:", error);
    }
  },

  setEmbedHidden: async (messageId: string, userId: string, hidden: boolean) => {
    try {
      const { data, error } = await supabase.rpc("set_message_embed_hidden", {
        _message_id: messageId,
        _user_id: userId,
        _hidden: hidden,
      });

      if (error) throw error;
      if (!data) {
        console.error("Failed to set embed hidden: not authorized or message not found");
        return;
      }

      set((state) => {
        const updatedCaches = { ...state.messagesByChannel };

        for (const channelId in updatedCaches) {
          const cache = updatedCaches[channelId];
          if (!cache) continue;

          const messageIndex = cache.messages.findIndex((m) => m.id === messageId);
          if (messageIndex !== -1) {
            updatedCaches[channelId] = {
              ...cache,
              messages: cache.messages.map((m) => (m.id === messageId ? { ...m, embed_hidden: hidden } : m)),
            };
            break;
          }
        }

        return { messagesByChannel: updatedCaches };
      });
    } catch (error) {
      console.error("Failed to set embed hidden:", error);
    }
  },

  addReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      const { error } = await supabase.rpc("add_reaction", {
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
      console.error("Failed to add reaction:", error);
    }
  },

  removeReaction: async (messageId: string, userId: string, emoji: string) => {
    try {
      const { error } = await supabase.rpc("remove_reaction", {
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
      console.error("Failed to remove reaction:", error);
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),

  addMessage: (message) => {
    const channelId = message.channel_id;
    if (!channelId) return;

    set((state) => {
      const existingCache = state.messagesByChannel[channelId];
      if (!existingCache) {
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
    const channelId = (updates as any).channel_id;

    set((state) => {
      if (channelId && state.messagesByChannel[channelId]) {
        const existingCache = state.messagesByChannel[channelId];
        return {
          messagesByChannel: {
            ...state.messagesByChannel,
            [channelId]: {
              ...existingCache,
              messages: existingCache.messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
            },
          },
        };
      }

      const newMessagesByChannel = { ...state.messagesByChannel };
      for (const [chId, cache] of Object.entries(newMessagesByChannel)) {
        const msgIndex = cache.messages.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          newMessagesByChannel[chId] = {
            ...cache,
            messages: cache.messages.map((m) => (m.id === messageId ? { ...m, ...updates } : m)),
          };
          break;
        }
      }
      return { messagesByChannel: newMessagesByChannel };
    });
  },

  removeMessage: (messageId) => {
    set((state) => {
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
Object.defineProperty(useMessageStore.getState(), "messages", {
  get() {
    return this.getMessages();
  },
});

Object.defineProperty(useMessageStore.getState(), "hasMore", {
  get() {
    return this.getHasMore();
  },
});
