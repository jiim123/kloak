import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useServerStore } from "@/stores/serverStore";
import { useUserCacheStore, bulkSetUsersInCache } from "@/stores/userCacheStore";
import type { Message, MessageReply, ReactionGroup, User } from "@/types";

interface ChannelMessages {
  messages: Message[];
  hasMore: boolean;
  lastFetched: number;
  oldestLoadedAt?: string | null;
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
    skipBootstrap?: boolean,
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
  removeMessagesByUser: (userId: string) => void;
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

const toMessageReply = (raw: any): MessageReply | null => {
  if (!raw || typeof raw !== "object") return null;
  if (!("id" in raw) || !("content" in raw) || !raw.user) return null;
  return {
    id: raw.id as string,
    content: raw.content as string,
    user: raw.user as User,
  };
};

const isMissingRpcError = (error: any) => {
  const message = String(error?.message ?? "");
  return (
    error?.code === "PGRST202" ||
    error?.code === "42883" ||
    message.includes("Could not find the function") ||
    message.includes("does not exist")
  );
};

// Cache expiry time - 5 minutes
const CACHE_EXPIRY_MS = 5 * 60 * 1000;
const REPLY_CACHE_EXPIRY_MS = 5 * 60 * 1000;
const MAX_CACHED_CHANNELS = 5;
const MAX_MESSAGES_PER_CHANNEL = 150;
const MAX_REPLY_CACHE_ITEMS = 800;

// In-flight request coalescing (prevents duplicate message fetches during rapid switching)
const inflightFetches = new Map<string, Promise<void>>();
const replyCache = new Map<string, { data: MessageReply; cachedAt: number }>();

const trimMessages = (messages: Message[], mode: "newest" | "oldest" = "newest") => {
  if (messages.length <= MAX_MESSAGES_PER_CHANNEL) return messages;
  if (mode === "oldest") return messages.slice(0, MAX_MESSAGES_PER_CHANNEL);
  return messages.slice(messages.length - MAX_MESSAGES_PER_CHANNEL);
};

const pruneReplyCache = () => {
  if (replyCache.size <= MAX_REPLY_CACHE_ITEMS) return;
  const sorted = Array.from(replyCache.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
  const toDelete = sorted.slice(0, replyCache.size - MAX_REPLY_CACHE_ITEMS);
  toDelete.forEach(([key]) => replyCache.delete(key));
};

const pruneMessagesByChannel = (
  input: Record<string, ChannelMessages>,
  keepChannelId?: string,
  keepChannelTrimMode: "newest" | "oldest" = "newest",
) => {
  const normalized: Record<string, ChannelMessages> = {};
  for (const [channelId, data] of Object.entries(input)) {
    const trimMode = keepChannelId && channelId === keepChannelId ? keepChannelTrimMode : "newest";
    normalized[channelId] = {
      ...data,
      messages: trimMessages(data.messages || [], trimMode),
    };
  }

  const entries = Object.entries(normalized);
  if (entries.length <= MAX_CACHED_CHANNELS) return normalized;

  const keep = new Set<string>();
  if (keepChannelId && normalized[keepChannelId]) keep.add(keepChannelId);

  const sorted = entries.sort((a, b) => (b[1].lastFetched || 0) - (a[1].lastFetched || 0));
  for (const [channelId] of sorted) {
    if (keep.size >= MAX_CACHED_CHANNELS) break;
    keep.add(channelId);
  }

  const pruned: Record<string, ChannelMessages> = {};
  for (const channelId of keep) {
    if (normalized[channelId]) {
      pruned[channelId] = normalized[channelId];
    }
  }
  return pruned;
};

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

  fetchMessages: async (
    channelId: string,
    limit = 50,
    before?: string,
    force = false,
    silent = false,
    skipBootstrap = false,
  ) => {
    const normalizedBefore = typeof before === "string" && before.trim().length > 0 ? before : undefined;
    const inflightKey = `${channelId}:${normalizedBefore ?? ""}:${force ? 1 : 0}:${limit}:${skipBootstrap ? 1 : 0}`;
    const existingInflight = inflightFetches.get(inflightKey);
    if (existingInflight) return existingInflight;

    const p = (async () => {
      const { messagesByChannel } = get();
      const cached = messagesByChannel[channelId];

      // If we have cached messages and they're fresh, don't refetch (unless paginating)
      if (!normalizedBefore && !force && cached && cached.messages.length > 0) {
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
      if (normalizedBefore) {
        set((state) => ({
          fetchingChannels: { ...state.fetchingChannels, [channelId]: true },
        }));
      }

      try {
        const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
        const requestUserId = useAuthStore.getState().user?.id;
        if (!requestUserId) throw new Error("Not authenticated");

        let messageRows: any[] = [];
        let usedBootstrap = false;

        if (!normalizedBefore && !skipBootstrap) {
          const { data: bootstrapData, error: bootstrapError } = await (supabase.rpc as any)(
            "get_channel_bootstrap_secure",
            {
              _channel_id: channelId,
              _user_id: requestUserId,
              _limit: limit,
              _blocked_user_ids: blockedUserIds,
            },
          );

          if (bootstrapError) {
            if (!isMissingRpcError(bootstrapError)) {
              throw bootstrapError;
            }
          } else {
            let payload = bootstrapData;
            if (typeof payload === "string") {
              try {
                payload = JSON.parse(payload);
              } catch {
                payload = null;
              }
            }

            if (payload && typeof payload === "object" && !Array.isArray(payload)) {
              const bootstrap = payload as Record<string, any>;
              messageRows = Array.isArray(bootstrap.messages) ? bootstrap.messages : [];
              const channelPermissions = Array.isArray(bootstrap.channel_permissions)
                ? bootstrap.channel_permissions
                : [];
              useServerStore.getState().hydrateChannelPermissions(channelId, channelPermissions);
              usedBootstrap = true;
            }
          }
        }

        if (!usedBootstrap) {
          const { data, error } = await supabase.rpc("get_channel_messages_secure", {
            _channel_id: channelId,
            _user_id: requestUserId,
            _limit: limit,
            _before: normalizedBefore || null,
            _blocked_user_ids: blockedUserIds,
          });
          if (error) throw error;
          messageRows = Array.isArray(data) ? data : [];

          // Bootstrap RPC may be unavailable while migrations roll out.
          // Ensure channel overrides are still loaded via legacy path.
          if (!normalizedBefore) {
            void useServerStore
              .getState()
              .fetchChannelPermissions(channelId)
              .catch(() => undefined);
          }
        }

        const replyMap: Record<string, MessageReply> = {};
        const missingReplyIds: string[] = [];
        // Prefer inline `reply_to` from get_channel_messages_secure to avoid an extra RPC.
        // Fall back to reply cache / get_message_replies_secure only for legacy payloads.
        messageRows.forEach((msg: any) => {
          if (!msg?.reply_to_id) return;
          const replyId = String(msg.reply_to_id);

          const inlineReply = toMessageReply(msg.reply_to);
          if (inlineReply) {
            replyMap[replyId] = inlineReply;
            replyCache.set(replyId, { data: inlineReply, cachedAt: Date.now() });
            pruneReplyCache();
            return;
          }

          const cachedReply = replyCache.get(replyId);
          if (cachedReply && Date.now() - cachedReply.cachedAt < REPLY_CACHE_EXPIRY_MS) {
            replyMap[replyId] = cachedReply.data;
            return;
          }

          // If the row includes `reply_to` (even null), the server already resolved visibility.
          const hasInlineField = Object.prototype.hasOwnProperty.call(msg, "reply_to");
          if (!hasInlineField) {
            missingReplyIds.push(replyId);
          }
        });

        const dedupedMissingReplyIds = Array.from(new Set(missingReplyIds));

        if (dedupedMissingReplyIds.length > 0) {
          const { data: replyData } = await supabase.rpc("get_message_replies_secure", {
            _message_ids: dedupedMissingReplyIds,
            _user_id: requestUserId,
            _blocked_user_ids: blockedUserIds,
          });

          if (replyData) {
            (replyData as any[]).forEach((reply: any) => {
              const normalizedReply = toMessageReply(reply);
              if (!normalizedReply) return;
              replyMap[normalizedReply.id] = normalizedReply;
              replyCache.set(normalizedReply.id, {
                data: normalizedReply,
                cachedAt: Date.now(),
              });
              pruneReplyCache();
            });
          }
        }

        const currentUserId = useAuthStore.getState().user?.id;

        // Phase 1: Extract user objects into the centralized cache, then strip from messages
        const uniqueUsers = new Map<string, User>();
        for (const msg of messageRows) {
          if (msg.user && typeof msg.user === 'object' && msg.user.id) {
            uniqueUsers.set(msg.user.id, msg.user as User);
          }
          // Also extract reply user data
          if (msg.reply_to?.user && typeof msg.reply_to.user === 'object' && msg.reply_to.user.id) {
            uniqueUsers.set(msg.reply_to.user.id, msg.reply_to.user as User);
          }
        }
        if (uniqueUsers.size > 0) {
          const usersArray = Array.from(uniqueUsers.values());
          bulkSetUsersInCache(usersArray);
          useUserCacheStore.getState().upsertUsers(usersArray);
        }

        const messages: Message[] = messageRows.reverse().map((msg: any) => ({
          ...msg,
          // Strip the user object — components look up from useUserCacheStore instead
          user: undefined,
          reply_to: msg.reply_to_id ? toMessageReply(msg.reply_to) || replyMap[msg.reply_to_id] : undefined,
          attachments: msg.attachments || [],
          reactions: groupReactions(
            blockedUserIds.length > 0
              ? (msg.reactions || []).filter((r: any) => !blockedUserIds.includes(r.user_id))
              : msg.reactions || [],
            currentUserId,
          ),
        }));

        const hasMore = messages.length === limit;
        const oldestFetchedAt = messages[0]?.created_at ?? null;

        set((state) => {
          const existingCache = state.messagesByChannel[channelId];

          // Clear per-channel fetching flag
          const { [channelId]: _, ...restFetching } = state.fetchingChannels;

          if (normalizedBefore && existingCache) {
            // Prepend older messages to existing cache
            const nextByChannel = pruneMessagesByChannel(
              {
                ...state.messagesByChannel,
                [channelId]: {
                  messages: [...messages, ...existingCache.messages],
                  hasMore,
                  lastFetched: existingCache.lastFetched,
                  oldestLoadedAt: oldestFetchedAt ?? existingCache.oldestLoadedAt ?? normalizedBefore,
                },
              },
              channelId,
              "oldest",
            );
            return {
              messagesByChannel: nextByChannel,
              isLoading: false,
              fetchingChannels: restFetching,
            };
          } else if (force && existingCache && existingCache.messages.length > 0) {
            // Force refetch reconcile:
            // - apply edits to existing messages
            // - remove deleted messages from the fetched "latest window"
            // - append truly new messages
            if (messages.length === 0) {
              const nextByChannel = pruneMessagesByChannel(
                {
                  ...state.messagesByChannel,
                  [channelId]: {
                    messages: [],
                    hasMore,
                    lastFetched: Date.now(),
                    oldestLoadedAt: null,
                  },
                },
                channelId,
              );
              return {
                messagesByChannel: nextByChannel,
                isLoading: false,
                fetchingChannels: restFetching,
              };
            }

            const fetchedIds = new Set(messages.map((m) => m.id));
            const oldestFetchedTs = new Date(messages[0].created_at).getTime();

            // Keep older paginated history outside the refreshed top window.
            const preservedOlder = existingCache.messages.filter((m) => {
              const ts = new Date(m.created_at).getTime();
              return ts < oldestFetchedTs && !fetchedIds.has(m.id);
            });

            const reconciled = [...preservedOlder, ...messages].sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
            );

            const nextByChannel = pruneMessagesByChannel(
              {
                ...state.messagesByChannel,
                [channelId]: {
                  messages: reconciled,
                  hasMore,
                  lastFetched: Date.now(),
                  oldestLoadedAt: reconciled[0]?.created_at ?? null,
                },
              },
              channelId,
            );

            return {
              messagesByChannel: nextByChannel,
              isLoading: false,
              fetchingChannels: restFetching,
            };
          } else {
            // Fresh fetch - replace cache
            const nextByChannel = pruneMessagesByChannel(
              {
                ...state.messagesByChannel,
                [channelId]: {
                  messages,
                  hasMore,
                  lastFetched: Date.now(),
                  oldestLoadedAt: oldestFetchedAt,
                },
              },
              channelId,
            );
            return {
              messagesByChannel: nextByChannel,
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

      // Cache the user but don't embed on the message
      if (currentUser) {
        useUserCacheStore.getState().upsertUser(currentUser as unknown as User);
      }

      // 3. Map RPC response to Message type (user stripped — looked up from cache)
      const message: Message = {
        ...data,
        is_own: true,
        user: undefined,
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
          messagesByChannel: pruneMessagesByChannel(
            {
              ...state.messagesByChannel,
              [channelId]: {
                ...existingCache,
                messages: [...existingCache.messages, message],
              },
            },
            channelId,
          ),
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

      // Cache the user data
      const userDataParsed = userData as unknown as User;
      if (userDataParsed) {
        useUserCacheStore.getState().upsertUser(userDataParsed);
      }

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
      const message: Message = {
        id: msgData.id,
        channel_id: msgData.channel_id,
        user_id: msgData.user_id,
        is_own: true,
        reply_to_id: msgData.reply_to_id,
        content: msgData.content,
        is_pinned: msgData.is_pinned || false,
        edited_at: msgData.edited_at,
        created_at: msgData.created_at,
        user: undefined,
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
          messagesByChannel: pruneMessagesByChannel(
            {
              ...state.messagesByChannel,
              [channelId]: {
                ...existingCache,
                messages: [...existingCache.messages, message],
              },
            },
            channelId,
          ),
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
          messagesByChannel: pruneMessagesByChannel(
            {
              ...state.messagesByChannel,
              [channelId]: {
                messages: [message],
                hasMore: true,
                lastFetched: Date.now(),
                oldestLoadedAt: message.created_at,
              },
            },
            channelId,
          ),
        };
      }

      if (existingCache.messages.some((m) => m.id === message.id)) {
        return state;
      }

      return {
        messagesByChannel: pruneMessagesByChannel(
          {
            ...state.messagesByChannel,
            [channelId]: {
              ...existingCache,
              messages: [...existingCache.messages, message],
            },
          },
          channelId,
        ),
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

  removeMessagesByUser: (userId: string) => {
    set((state) => {
      const newMessagesByChannel: Record<string, ChannelMessages> = {};
      for (const [chId, cache] of Object.entries(state.messagesByChannel)) {
        const filtered = cache.messages.filter((m) => m.user_id !== userId);
        if (filtered.length !== cache.messages.length) {
          newMessagesByChannel[chId] = { ...cache, messages: filtered };
        } else {
          newMessagesByChannel[chId] = cache;
        }
      }
      return { messagesByChannel: newMessagesByChannel };
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
