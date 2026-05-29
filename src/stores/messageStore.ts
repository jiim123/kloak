import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useFriendStore } from "@/stores/friendStore";
import { useServerStore } from "@/stores/serverStore";
import { useSyncStore } from "@/stores/syncStore";
import { useUserCacheStore, bulkSetUsersInCache, fetchAndCacheUser } from "@/stores/userCacheStore";
import { resolveSignedUrls, isSupabaseAttachmentUrl } from "@/lib/signedUrl";
import { afterNextPaint, beginChatPerf, endChatPerf, markChatPerf } from "@/lib/chatPerf";
import { canRevealGhostIdentityForUser, getGhostPseudonymousUserId } from "@/lib/ghostIdentity";
import { toast } from "sonner";
import type { Message, MessageAttachment, MessageReply, ReactionGroup, User } from "@/types";

interface ChannelMessages {
  messages: Message[];
  hasMore: boolean;
  lastFetched: number;
  oldestLoadedAt?: string | null;
  prefetchedOlder?: PrefetchedOlderPage | null;
}

interface PrefetchedOlderPage {
  beforeCursor: string;
  messages: Message[];
  hasMore: boolean;
  oldestLoadedAt: string | null;
  prefetchedAt: number;
}

interface PrefetchedBootstrapPage {
  limit: number;
  messages: Message[];
  hasMore: boolean;
  oldestLoadedAt: string | null;
  deferredReplyIds: string[];
  prefetchedAt: number;
}

type LoadedChannelMessagePage = {
  messages: Message[];
  hasMore: boolean;
  oldestLoadedAt: string | null;
  deferredReplyIds: string[];
};

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
  prefetchChannelBootstrap: (channelId: string, limit?: number) => Promise<void>;
  prefetchOlderMessages: (channelId: string, limit?: number) => Promise<void>;

  // Message actions
  sendMessage: (
    channelId: string,
    userId: string,
    content: string,
    replyToId?: string,
    options?: SendMessageOptions,
  ) => Promise<Message | null>;
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

interface SendMessageOptions {
  optimisticAttachments?: Message["attachments"];
}

const isTemporaryAttachment = (attachment: MessageAttachment) =>
  attachment.id.startsWith("temp-att-") || attachment.file_url.startsWith("blob:");

const sanitizePersistedMessage = (message: Message): { message: Message; mutated: boolean } => {
  const attachments = message.attachments || [];
  if (attachments.length === 0) return { message, mutated: false };

  const sanitizedAttachments = attachments.filter((attachment) => !isTemporaryAttachment(attachment));
  if (sanitizedAttachments.length === attachments.length) {
    return { message, mutated: false };
  }

  return {
    message: {
      ...message,
      attachments: sanitizedAttachments,
    },
    mutated: true,
  };
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

const toMessageReply = (raw: any): MessageReply | null => {
  if (!raw || typeof raw !== "object") return null;
  if (!("id" in raw) || !("content" in raw)) return null;
  // Extract user into cache if present, but don't store on reply
  if (raw.user?.id) {
    useUserCacheStore.getState().upsertUser(raw.user as User);
  }
  return {
    id: raw.id as string,
    content: raw.content as string,
    user_id: raw.user_id || raw.user?.id,
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

const isNewAccountMessagingRestrictionError = (error: any) => {
  const message = String(error?.message ?? "").toLowerCase();
  return message.includes("messaging is temporarily restricted for new accounts");
};

// Cache expiry time - 5 minutes
const CACHE_EXPIRY_MS = 5 * 60 * 1000;
const REPLY_CACHE_EXPIRY_MS = 5 * 60 * 1000;
const PREFETCH_CACHE_EXPIRY_MS = 2 * 60 * 1000;
const MAX_CACHED_CHANNELS = 5;
const MAX_MESSAGES_PER_CHANNEL = 150;
const MAX_REPLY_CACHE_ITEMS = 800;
const MESSAGE_CACHE_STORAGE_KEY = "kloak:message-cache:v1";

// In-flight request coalescing (prevents duplicate message fetches during rapid switching)
const inflightFetches = new Map<string, Promise<void>>();
const inflightPrefetches = new Map<string, Promise<void>>();
const inflightBootstrapPageLoads = new Map<string, Promise<LoadedChannelMessagePage>>();
const replyCache = new Map<string, { data: MessageReply; cachedAt: number }>();
const bootstrapPrefetchCache = new Map<string, PrefetchedBootstrapPage>();

const trimMessages = (messages: Message[], mode: "newest" | "oldest" = "newest") => {
  if (messages.length <= MAX_MESSAGES_PER_CHANNEL) return messages;
  if (mode === "oldest") return messages.slice(0, MAX_MESSAGES_PER_CHANNEL);
  return messages.slice(messages.length - MAX_MESSAGES_PER_CHANNEL);
};

const getPrefetchedBootstrapPage = (channelId: string, limit: number) => {
  const prefetched = bootstrapPrefetchCache.get(channelId);
  if (!prefetched) return null;
  if (prefetched.limit !== limit) return null;
  if (Date.now() - prefetched.prefetchedAt >= PREFETCH_CACHE_EXPIRY_MS) {
    bootstrapPrefetchCache.delete(channelId);
    return null;
  }
  return prefetched;
};

const createOptimisticMessageId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const resolveReplyPreview = (
  messagesByChannel: Record<string, ChannelMessages>,
  channelId: string,
  replyToId?: string,
): MessageReply | undefined => {
  if (!replyToId) return undefined;
  const replyMessage = messagesByChannel[channelId]?.messages.find((m) => m.id === replyToId);
  if (!replyMessage) return undefined;
  return {
    id: replyMessage.id,
    content: replyMessage.content,
    user_id: replyMessage.user_id,
  };
};

const updateMessageInCaches = (
  messagesByChannel: Record<string, ChannelMessages>,
  messageId: string,
  updater: (message: Message) => Message | null,
) => {
  let changed = false;
  const nextByChannel: Record<string, ChannelMessages> = {};

  for (const [channelId, cache] of Object.entries(messagesByChannel)) {
    const index = cache.messages.findIndex((message) => message.id === messageId);
    if (index === -1) {
      nextByChannel[channelId] = cache;
      continue;
    }

    const updated = updater(cache.messages[index]);
    changed = true;
    nextByChannel[channelId] = {
      ...cache,
      messages:
        updated === null
          ? cache.messages.filter((message) => message.id !== messageId)
          : cache.messages.map((message, messageIndex) => (messageIndex === index ? updated : message)),
    };
  }

  return changed ? nextByChannel : messagesByChannel;
};

const getReactionDisplayUserId = (channelId: string, userId: string) => {
  const serverState = useServerStore.getState();
  const channel =
    serverState.currentChannel?.id === channelId
      ? serverState.currentChannel
      : serverState.channels.find((entry) => entry.id === channelId);

  const isGhostMode = !!channel?.ghost_mode;
  const revealIdentity = canRevealGhostIdentityForUser({
    isGhostMode,
    authorUserId: userId,
    members: serverState.members,
    ownerId: serverState.currentServer?.owner_id,
  });

  return revealIdentity ? userId : getGhostPseudonymousUserId(userId, channelId);
};

const addReactionToMessage = (message: Message, userId: string, emoji: string): Message => {
  const displayUserId = getReactionDisplayUserId(message.channel_id, userId);
  const userAliases = new Set([userId, displayUserId]);
  const reactions = (message.reactions || []).map((reaction) => ({
    ...reaction,
    users: Array.from(new Set(reaction.users.map((entry) => (userAliases.has(entry) ? displayUserId : entry)))),
  }));
  const existingGroup = reactions.find((reaction) => reaction.emoji === emoji);

  if (existingGroup) {
    if (!existingGroup.users.includes(displayUserId)) {
      existingGroup.count += 1;
      existingGroup.users.push(displayUserId);
    }
    existingGroup.count = existingGroup.users.length;
    existingGroup.hasReacted = true;
  } else {
    reactions.push({
      emoji,
      count: 1,
      users: [displayUserId],
      hasReacted: true,
    });
  }

  return { ...message, reactions };
};

const removeReactionFromMessage = (message: Message, userId: string, emoji: string): Message => {
  const displayUserId = getReactionDisplayUserId(message.channel_id, userId);
  const userAliases = new Set([userId, displayUserId]);
  const reactions = (message.reactions || [])
    .map((reaction) => {
      if (reaction.emoji !== emoji) return reaction;
      if (!reaction.users.some((entry) => userAliases.has(entry))) return reaction;
      const users = reaction.users.filter((entry) => !userAliases.has(entry));
      return {
        ...reaction,
        count: users.length,
        users,
        hasReacted: false,
      };
    })
    .filter((reaction) => reaction.count > 0);

  return { ...message, reactions };
};

const mergeMessageIntoChannelCache = (
  messagesByChannel: Record<string, ChannelMessages>,
  channelId: string,
  message: Message,
  tempId?: string,
) => {
  const existingCache = messagesByChannel[channelId];
  const existingMessages = existingCache?.messages ?? [];
  const tempMessage = tempId ? existingMessages.find((m) => m.id === tempId) : undefined;
  const withoutTemp = tempId ? existingMessages.filter((m) => m.id !== tempId) : existingMessages;
  const mergedMessage =
    tempMessage && (!message.attachments || message.attachments.length === 0)
      ? { ...message, attachments: tempMessage.attachments }
      : message;

  if (withoutTemp.some((m) => m.id === mergedMessage.id)) {
    const nextMessages = withoutTemp.map((m) => (m.id === mergedMessage.id ? { ...m, ...mergedMessage } : m));
    return pruneMessagesByChannel(
      {
        ...messagesByChannel,
        [channelId]: {
          messages: nextMessages,
          hasMore: existingCache?.hasMore ?? true,
          lastFetched: Date.now(),
          oldestLoadedAt: existingCache?.oldestLoadedAt ?? nextMessages[0]?.created_at ?? mergedMessage.created_at,
          prefetchedOlder: existingCache?.prefetchedOlder ?? null,
        },
      },
      channelId,
    );
  }

  const nextMessages = [...withoutTemp, mergedMessage].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return pruneMessagesByChannel(
    {
      ...messagesByChannel,
        [channelId]: {
          messages: nextMessages,
          hasMore: existingCache?.hasMore ?? true,
          lastFetched: Date.now(),
          oldestLoadedAt: existingCache?.oldestLoadedAt ?? nextMessages[0]?.created_at ?? mergedMessage.created_at,
          prefetchedOlder: existingCache?.prefetchedOlder ?? null,
        },
      },
      channelId,
  );
};

const hydrateMissingRepliesInBackground = async (
  channelId: string,
  replyIds: string[],
  requestUserId: string,
  blockedUserIds: string[],
) => {
  const dedupedReplyIds = Array.from(new Set(replyIds));
  if (dedupedReplyIds.length === 0) return;

  try {
    const { data: replyData } = await supabase.rpc("get_message_replies_secure", {
      _message_ids: dedupedReplyIds,
      _user_id: requestUserId,
      _blocked_user_ids: blockedUserIds,
    });

    if (!Array.isArray(replyData) || replyData.length === 0) return;

    const replyMap = new Map<string, MessageReply>();
    for (const reply of replyData as any[]) {
      const normalizedReply = toMessageReply(reply);
      if (!normalizedReply) continue;
      replyMap.set(normalizedReply.id, normalizedReply);
      replyCache.set(normalizedReply.id, {
        data: normalizedReply,
        cachedAt: Date.now(),
      });
      pruneReplyCache();
    }

    if (replyMap.size === 0) return;

    const cacheEntry = useMessageStore.getState().messagesByChannel[channelId];
    if (!cacheEntry) return;

    for (const message of cacheEntry.messages) {
      if (!message.reply_to_id || message.reply_to) continue;
      const replyPreview = replyMap.get(message.reply_to_id);
      if (!replyPreview) continue;
      useMessageStore.getState().updateMessage(message.id, {
        channel_id: channelId,
        reply_to: replyPreview,
      });
    }
  } catch (error) {
    console.error("Failed to hydrate missing replies in background:", error);
  }
};

const pruneReplyCache = () => {
  if (replyCache.size <= MAX_REPLY_CACHE_ITEMS) return;
  const sorted = Array.from(replyCache.entries()).sort((a, b) => a[1].cachedAt - b[1].cachedAt);
  const toDelete = sorted.slice(0, replyCache.size - MAX_REPLY_CACHE_ITEMS);
  toDelete.forEach(([key]) => replyCache.delete(key));
};

const readPersistedMessagesByChannel = (): Record<string, ChannelMessages> => {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(MESSAGE_CACHE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ChannelMessages>;
    const now = Date.now();
    const next: Record<string, ChannelMessages> = {};

    for (const [channelId, cache] of Object.entries(parsed || {})) {
      if (!cache || !Array.isArray(cache.messages)) continue;
      const sanitizedMessages = (cache.messages as Message[]).map(sanitizePersistedMessage);
      const didSanitize = sanitizedMessages.some((entry) => entry.mutated);
      if (now - Number(cache.lastFetched ?? 0) >= CACHE_EXPIRY_MS && !didSanitize) continue;
      next[channelId] = {
        messages: trimMessages(sanitizedMessages.map((entry) => entry.message)),
        hasMore: cache.hasMore ?? true,
        lastFetched: didSanitize ? 0 : Number(cache.lastFetched ?? now),
        oldestLoadedAt: cache.oldestLoadedAt ?? null,
      };
    }

    return pruneMessagesByChannel(next);
  } catch {
    return {};
  }
};

const persistMessagesByChannel = (messagesByChannel: Record<string, ChannelMessages>) => {
  if (typeof window === "undefined") return;
  try {
    const persisted = Object.fromEntries(
      Object.entries(pruneMessagesByChannel(messagesByChannel)).map(([channelId, cache]) => [
        channelId,
        {
          messages: cache.messages.map((message) => sanitizePersistedMessage(message).message),
          hasMore: cache.hasMore,
          lastFetched: cache.lastFetched,
          oldestLoadedAt: cache.oldestLoadedAt ?? null,
        },
      ]),
    );
    window.sessionStorage.setItem(MESSAGE_CACHE_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // ignore storage pressure/quota issues
  }
};

const pruneMessagesByChannel = (
  input: Record<string, ChannelMessages>,
  keepChannelId?: string,
  keepChannelTrimMode: "newest" | "oldest" = "newest",
) => {
  const normalized: Record<string, ChannelMessages> = {};
  for (const [channelId, data] of Object.entries(input)) {
    const isKeptChannel = !!keepChannelId && channelId === keepChannelId;
    const shouldBypassTrim = isKeptChannel && keepChannelTrimMode === "oldest";
    const trimMode = isKeptChannel ? keepChannelTrimMode : "newest";
    normalized[channelId] = {
      ...data,
      prefetchedOlder: data.prefetchedOlder ?? null,
      // Keep the actively paginated channel growing so top-reached loading
      // can continue firing while loading older history.
      messages: shouldBypassTrim ? (data.messages || []) : trimMessages(data.messages || [], trimMode),
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

const loadChannelMessagePageUncached = async ({
  channelId,
  limit,
  before,
  skipBootstrap = false,
  perfId,
}: {
  channelId: string;
  limit: number;
  before?: string;
  skipBootstrap?: boolean;
  perfId?: string | null;
}): Promise<LoadedChannelMessagePage> => {
  const normalizedBefore = typeof before === "string" && before.trim().length > 0 ? before : undefined;
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
      markChatPerf(perfId, "bootstrap-rpc", {
        ok: false,
        missingRpc: isMissingRpcError(bootstrapError),
      });
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
        markChatPerf(perfId, "bootstrap-rpc", {
          ok: true,
          rowCount: messageRows.length,
          permissionCount: channelPermissions.length,
        });
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
    markChatPerf(perfId, "messages-rpc", {
      rowCount: messageRows.length,
      paginated: !!normalizedBefore,
      skipBootstrap,
    });

    if (normalizedBefore && messageRows.length === 0) {
      const beforeMs = Date.parse(normalizedBefore);
      if (Number.isFinite(beforeMs)) {
        const nudgedBefore = new Date(beforeMs - 1).toISOString();
        const { data: fallbackData, error: fallbackError } = await supabase.rpc("get_channel_messages_secure", {
          _channel_id: channelId,
          _user_id: requestUserId,
          _limit: limit,
          _before: nudgedBefore,
          _blocked_user_ids: blockedUserIds,
        });
        if (!fallbackError) {
          messageRows = Array.isArray(fallbackData) ? fallbackData : [];
          markChatPerf(perfId, "messages-rpc-nudge", {
            rowCount: messageRows.length,
          });
        }
      }
    }

    if (!normalizedBefore) {
      void useServerStore
        .getState()
        .fetchChannelPermissions(channelId)
        .catch(() => undefined);
    }
  }

  const replyMap: Record<string, MessageReply> = {};
  const missingReplyIds: string[] = [];
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

    const hasInlineField = Object.prototype.hasOwnProperty.call(msg, "reply_to");
    if (!hasInlineField) {
      missingReplyIds.push(replyId);
    }
  });

  const dedupedMissingReplyIds = Array.from(new Set(missingReplyIds));

  const deferredReplyIds = usedBootstrap ? dedupedMissingReplyIds : [];

  if (!usedBootstrap && dedupedMissingReplyIds.length > 0) {
    const { data: replyData } = await supabase.rpc("get_message_replies_secure", {
      _message_ids: dedupedMissingReplyIds,
      _user_id: requestUserId,
      _blocked_user_ids: blockedUserIds,
    });

    if (replyData) {
      markChatPerf(perfId, "reply-rpc", {
        replyCount: Array.isArray(replyData) ? replyData.length : 0,
        missingReplyIds: dedupedMissingReplyIds.length,
      });
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

  const uniqueUsers = new Map<string, User>();
  for (const msg of messageRows) {
    if (msg.user && typeof msg.user === "object" && msg.user.id) {
      uniqueUsers.set(msg.user.id, msg.user as User);
    }
    if (msg.reply_to?.user && typeof msg.reply_to.user === "object" && msg.reply_to.user.id) {
      uniqueUsers.set(msg.reply_to.user.id, msg.reply_to.user as User);
    }
  }
  if (uniqueUsers.size > 0) {
    bulkSetUsersInCache(Array.from(uniqueUsers.values()));
  }

  const messages: Message[] = messageRows.reverse().map((msg: any) => ({
    id: msg.id,
    channel_id: msg.channel_id,
    user_id: msg.user_id,
    is_own: msg.is_own ?? (msg.user_id === currentUserId),
    reply_to_id: msg.reply_to_id ?? null,
    content: msg.content,
    is_pinned: msg.is_pinned ?? false,
    is_system_message: msg.is_system_message ?? false,
    embed_hidden: msg.embed_hidden ?? false,
    edited_at: msg.edited_at ?? null,
    created_at: msg.created_at,
    reply_to: msg.reply_to_id
      ? replyMap[msg.reply_to_id] ?? toMessageReply(msg.reply_to)
      : undefined,
    attachments: msg.attachments || [],
    reactions: groupReactions(
      blockedUserIds.length > 0
        ? (msg.reactions || []).filter((r: any) => !blockedUserIds.includes(r.user_id))
        : msg.reactions || [],
      currentUserId,
    ),
  }));

  const hasMore = messages.length === limit;
  const oldestLoadedAt = messages[0]?.created_at ?? null;

  const attachmentUrls = messages
    .flatMap((m) => (m.attachments || []).map((a: any) => a.file_url as string))
    .filter((url): url is string => !!url && isSupabaseAttachmentUrl(url));
  if (attachmentUrls.length > 0) {
    resolveSignedUrls(attachmentUrls).catch(() => {});
  }

  markChatPerf(perfId, "normalized", {
    messageCount: messages.length,
    usedBootstrap,
    deferredReplyIds: deferredReplyIds.length,
    attachmentUrlCount: attachmentUrls.length,
  });

  return { messages, hasMore, oldestLoadedAt, deferredReplyIds };
};

const loadChannelMessagePage = async (args: {
  channelId: string;
  limit: number;
  before?: string;
  skipBootstrap?: boolean;
  perfId?: string | null;
}): Promise<LoadedChannelMessagePage> => {
  const normalizedBefore = typeof args.before === "string" && args.before.trim().length > 0 ? args.before : undefined;
  if (normalizedBefore || args.skipBootstrap) {
    return loadChannelMessagePageUncached(args);
  }

  const requestUserId = useAuthStore.getState().user?.id;
  if (!requestUserId) {
    return loadChannelMessagePageUncached(args);
  }

  const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
  const blockedKey = blockedUserIds.slice().sort().join(",");
  const inflightKey = `${args.channelId}:${requestUserId}:${args.limit}:${blockedKey}`;
  const existingInflight = inflightBootstrapPageLoads.get(inflightKey);
  if (existingInflight) return existingInflight;

  const p = loadChannelMessagePageUncached(args).finally(() => {
    const cur = inflightBootstrapPageLoads.get(inflightKey);
    if (cur === p) inflightBootstrapPageLoads.delete(inflightKey);
  });

  inflightBootstrapPageLoads.set(inflightKey, p);
  return p;
};

export const useMessageStore = create<MessageState>((set, get) => ({
  messagesByChannel: readPersistedMessagesByChannel(),
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
    const requestUserId = useAuthStore.getState().user?.id;
    const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
    const inflightKey = `${channelId}:${normalizedBefore ?? ""}:${limit}`;
    const existingInflight = inflightFetches.get(inflightKey);
    if (existingInflight) return existingInflight;

    const p = (async () => {
      const { messagesByChannel } = get();
      const cached = messagesByChannel[channelId];
      const perfId = beginChatPerf("fetch-messages", {
        channelId,
        before: normalizedBefore ?? null,
        force,
        silent,
        skipBootstrap,
        hadCached: !!cached?.messages?.length,
      });

      // If we have cached messages and they're fresh, don't refetch (unless paginating)
      if (!normalizedBefore && !force && cached && cached.messages.length > 0) {
        const isFresh = Date.now() - cached.lastFetched < CACHE_EXPIRY_MS;
        if (isFresh) {
          endChatPerf(perfId, "cache-hit", {
            messageCount: cached.messages.length,
          });
          return;
        }
      }

      // ─── KEY CHANGE: stale-while-revalidate ───
      // Only show the full-screen skeleton if we have ZERO cached messages for this channel.
      // If we have stale cached messages, show them immediately and fetch silently in background.
      const hasCachedMessages = cached && cached.messages.length > 0;
      const prefetchedBootstrap =
        !normalizedBefore && !skipBootstrap ? getPrefetchedBootstrapPage(channelId, limit) : null;

      if (!hasCachedMessages && !prefetchedBootstrap && !silent) {
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
        const existingCache = get().messagesByChannel[channelId];
        const prefetchedOlder =
          normalizedBefore && existingCache?.prefetchedOlder?.beforeCursor === normalizedBefore
            ? existingCache.prefetchedOlder
            : null;

        const page =
          prefetchedOlder && Date.now() - prefetchedOlder.prefetchedAt < PREFETCH_CACHE_EXPIRY_MS
            ? {
                messages: prefetchedOlder.messages,
                hasMore: prefetchedOlder.hasMore,
                oldestLoadedAt: prefetchedOlder.oldestLoadedAt,
                deferredReplyIds: [] as string[],
              }
            : prefetchedBootstrap
              ? {
                  messages: prefetchedBootstrap.messages,
                  hasMore: prefetchedBootstrap.hasMore,
                  oldestLoadedAt: prefetchedBootstrap.oldestLoadedAt,
                  deferredReplyIds: prefetchedBootstrap.deferredReplyIds,
                }
            : await loadChannelMessagePage({
                channelId,
                limit,
                before: normalizedBefore,
                skipBootstrap,
                perfId,
              });

        if (prefetchedOlder && Date.now() - prefetchedOlder.prefetchedAt < PREFETCH_CACHE_EXPIRY_MS) {
          markChatPerf(perfId, "used-prefetched-older", {
            rowCount: prefetchedOlder.messages.length,
          });
        } else if (prefetchedBootstrap) {
          markChatPerf(perfId, "used-prefetched-bootstrap", {
            rowCount: prefetchedBootstrap.messages.length,
            deferredReplyIds: prefetchedBootstrap.deferredReplyIds.length,
          });
        }

        const { messages, hasMore, oldestLoadedAt: oldestFetchedAt, deferredReplyIds } = page;

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
                  prefetchedOlder: null,
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
                    prefetchedOlder: null,
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
                  prefetchedOlder: null,
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
                  prefetchedOlder: null,
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
        afterNextPaint(() => {
          markChatPerf(perfId, "post-state-paint", {
            messageCount: messages.length,
            paginated: !!normalizedBefore,
          });
        });

        if (deferredReplyIds.length > 0 && !normalizedBefore && requestUserId) {
          void hydrateMissingRepliesInBackground(
            channelId,
            deferredReplyIds,
            requestUserId,
            blockedUserIds,
          ).then(() => {
            endChatPerf(perfId, "deferred-replies-complete", {
              deferredReplyIds: deferredReplyIds.length,
            });
          }).catch((error) => {
            endChatPerf(perfId, "deferred-replies-failed", {
              deferredReplyIds: deferredReplyIds.length,
              error: error instanceof Error ? error.message : "Deferred reply hydration failed",
            });
          });
        } else {
          endChatPerf(perfId, "done", {
            messageCount: messages.length,
          });
        }
      } catch (error) {
        endChatPerf(perfId, "failed", {
          error: error instanceof Error ? error.message : "Failed to fetch messages",
        });
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

  prefetchChannelBootstrap: async (channelId: string, limit = 50) => {
    const cacheEntry = get().messagesByChannel[channelId];
    const hasFreshCache =
      !!cacheEntry &&
      (cacheEntry.messages?.length ?? 0) > 0 &&
      Date.now() - cacheEntry.lastFetched < CACHE_EXPIRY_MS;
    if (hasFreshCache) return;

    if (getPrefetchedBootstrapPage(channelId, limit)) return;

    const inflightKey = `bootstrap:${channelId}:${limit}`;
    const existingInflight = inflightPrefetches.get(inflightKey);
    if (existingInflight) return existingInflight;

    const p = (async () => {
      try {
        const page = await loadChannelMessagePage({
          channelId,
          limit,
          skipBootstrap: false,
        });

        const currentCache = get().messagesByChannel[channelId];
        const stillHasFreshCache =
          !!currentCache &&
          (currentCache.messages?.length ?? 0) > 0 &&
          Date.now() - currentCache.lastFetched < CACHE_EXPIRY_MS;
        if (stillHasFreshCache) return;

        bootstrapPrefetchCache.set(channelId, {
          limit,
          messages: page.messages,
          hasMore: page.hasMore,
          oldestLoadedAt: page.oldestLoadedAt,
          deferredReplyIds: page.deferredReplyIds,
          prefetchedAt: Date.now(),
        });
      } catch (error) {
        console.error("Failed to prefetch channel bootstrap:", error);
      }
    })().finally(() => {
      const cur = inflightPrefetches.get(inflightKey);
      if (cur === p) inflightPrefetches.delete(inflightKey);
    });

    inflightPrefetches.set(inflightKey, p);
    return p;
  },

  prefetchOlderMessages: async (channelId: string, limit = 50) => {
    const cacheEntry = get().messagesByChannel[channelId];
    if (!cacheEntry || cacheEntry.messages.length === 0 || !cacheEntry.hasMore) return;

    const beforeCursor = cacheEntry.oldestLoadedAt || cacheEntry.messages[0]?.created_at;
    if (!beforeCursor) return;

    const prefetchedOlder = cacheEntry.prefetchedOlder;
    if (
      prefetchedOlder?.beforeCursor === beforeCursor &&
      Date.now() - prefetchedOlder.prefetchedAt < PREFETCH_CACHE_EXPIRY_MS
    ) {
      return;
    }

    const inflightKey = `${channelId}:${beforeCursor}:${limit}`;
    const existingInflight = inflightPrefetches.get(inflightKey);
    if (existingInflight) return existingInflight;

    const p = (async () => {
      try {
        const page = await loadChannelMessagePage({
          channelId,
          limit,
          before: beforeCursor,
          skipBootstrap: true,
        });

        set((state) => {
          const current = state.messagesByChannel[channelId];
          if (!current) return state;

          const currentBeforeCursor = current.oldestLoadedAt || current.messages[0]?.created_at;
          if (!currentBeforeCursor || currentBeforeCursor !== beforeCursor) {
            return state;
          }

          return {
            messagesByChannel: {
              ...state.messagesByChannel,
              [channelId]: {
                ...current,
                prefetchedOlder: {
                  beforeCursor,
                  messages: page.messages,
                  hasMore: page.hasMore,
                  oldestLoadedAt: page.oldestLoadedAt,
                  prefetchedAt: Date.now(),
                },
              },
            },
          };
        });
      } catch (error) {
        console.error("Failed to prefetch older messages:", error);
      }
    })().finally(() => {
      const cur = inflightPrefetches.get(inflightKey);
      if (cur === p) inflightPrefetches.delete(inflightKey);
    });

    inflightPrefetches.set(inflightKey, p);
    return p;
  },

  sendMessage: async (
    channelId: string,
    userId: string,
    content: string,
    replyToId?: string,
    options?: SendMessageOptions,
  ) => {
    const tempId = createOptimisticMessageId();
    const perfId = beginChatPerf("send-message", {
      channelId,
      hasReply: !!replyToId,
      hasAttachments: (options?.optimisticAttachments?.length ?? 0) > 0,
      contentLength: content.length,
    });
    const syncStore = useSyncStore.getState();
    const currentUser = useAuthStore.getState().user;
    const replyData = resolveReplyPreview(get().messagesByChannel, channelId, replyToId);

    if (currentUser) {
      useUserCacheStore.getState().upsertUser(currentUser as unknown as User);
    }

    syncStore.addOptimisticItem(tempId);
    set((state) => ({
      messagesByChannel: mergeMessageIntoChannelCache(state.messagesByChannel, channelId, {
        id: tempId,
        channel_id: channelId,
        user_id: userId,
        is_own: true,
        reply_to_id: replyToId ?? null,
        content,
        is_pinned: false,
        is_system_message: false,
        embed_hidden: false,
        edited_at: null,
        created_at: new Date().toISOString(),
        reply_to: replyData,
        attachments: options?.optimisticAttachments ?? [],
        reactions: [],
      }),
      replyingTo: null,
    }));
    afterNextPaint(() => {
      markChatPerf(perfId, "local-render");
    });

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

      // Map RPC response to Message type; author data still resolves from the user cache.
      const message: Message = {
        id: (data as any).id,
        channel_id: (data as any).channel_id,
        user_id: (data as any).user_id,
        is_own: true,
        reply_to_id: (data as any).reply_to_id ?? null,
        content: (data as any).content,
        is_pinned: (data as any).is_pinned ?? false,
        is_system_message: (data as any).is_system_message ?? false,
        embed_hidden: (data as any).embed_hidden ?? false,
        edited_at: (data as any).edited_at ?? null,
        created_at: (data as any).created_at,
        reply_to: replyData,
        attachments: [],
        reactions: [],
      };

      syncStore.confirmOptimisticItem(tempId, message.id);
      set((state) => ({
        messagesByChannel: mergeMessageIntoChannelCache(state.messagesByChannel, channelId, message, tempId),
        replyingTo: null,
      }));
      endChatPerf(perfId, "server-reconcile");

      // Attach mass-mention delivery metadata for the caller.
      (message as any)._mentions_suppressed = (data as any).mentions_suppressed;
      (message as any)._suppressed_types = (data as any).suppressed_types;
      (message as any)._mass_mentions_queued = (data as any).mass_mentions_queued;
      (message as any)._queued_mention_types = (data as any).queued_mention_types;

      return message;
    } catch (error) {
      endChatPerf(perfId, "failed", {
        error: error instanceof Error ? error.message : "Failed to send message",
      });
      syncStore.failOptimisticItem(tempId, error instanceof Error ? error.message : "Failed to send message");
      syncStore.removeOptimisticItem(tempId);
      set((state) => {
        const existingCache = state.messagesByChannel[channelId];
        if (!existingCache) return state;

        return {
          messagesByChannel: pruneMessagesByChannel(
            {
              ...state.messagesByChannel,
              [channelId]: {
                ...existingCache,
                messages: existingCache.messages.filter((m) => m.id !== tempId),
              },
            },
            channelId,
          ),
        };
      });
      console.error("Failed to send message:", error);
      if (isNewAccountMessagingRestrictionError(error)) {
        toast.warning("Messaging is temporarily restricted", {
          description: "Please wait a few minutes after creating your account, then try again.",
        });
      }
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
      const userData = localUser?.id === userId ? localUser : await fetchAndCacheUser(userId);

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
            user_id: replyMsg.user_id,
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
        // user data lives in cache, not on message
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
    const editedAt = new Date().toISOString();
    let previousMessage: Message | null = null;
    set((state) => ({
      messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, (message) => {
        previousMessage = previousMessage ?? message;
        return { ...message, content, edited_at: editedAt };
      }),
    }));

    try {
      const { error } = await supabase.rpc("edit_message", {
        _message_id: messageId,
        _user_id: userId,
        _content: content,
      });

      if (error) throw error;
    } catch (error) {
      if (previousMessage) {
        set((state) => ({
          messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, () => previousMessage),
        }));
      }
      console.error("Failed to edit message:", error);
    }
  },

  deleteMessage: async (messageId: string, userId: string) => {
    let previousMessage: Message | null = null;
    set((state) => ({
      messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, (message) => {
        previousMessage = previousMessage ?? message;
        return null;
      }),
    }));

    try {
      const { error } = await supabase.rpc("delete_message", {
        _message_id: messageId,
        _user_id: userId,
      });

      if (error) throw error;
    } catch (error) {
      if (previousMessage) {
        set((state) => ({
          messagesByChannel: mergeMessageIntoChannelCache(
            state.messagesByChannel,
            previousMessage.channel_id,
            previousMessage,
          ),
        }));
      }
      console.error("Failed to delete message:", error);
    }
  },

  pinMessage: async (messageId: string, isPinned: boolean, userId: string) => {
    let previousMessage: Message | null = null;
    set((state) => ({
      messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, (message) => {
        previousMessage = previousMessage ?? message;
        return { ...message, is_pinned: isPinned };
      }),
    }));

    try {
      const { error } = await supabase.rpc("pin_message", {
        _message_id: messageId,
        _user_id: userId,
        _pinned: isPinned,
      });

      if (error) throw error;
    } catch (error) {
      if (previousMessage) {
        set((state) => ({
          messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, () => previousMessage),
        }));
      }
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
    let previousMessage: Message | null = null;
    set((state) => ({
      messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, (message) => {
        previousMessage = previousMessage ?? message;
        return addReactionToMessage(message, userId, emoji);
      }),
    }));

    try {
      const { error } = await supabase.rpc("add_reaction", {
        _message_id: messageId,
        _user_id: userId,
        _emoji: emoji,
      });

      if (error) throw error;
    } catch (error) {
      if (previousMessage) {
        set((state) => ({
          messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, () => previousMessage),
        }));
      }
      console.error("Failed to add reaction:", error);
    }
  },

  removeReaction: async (messageId: string, userId: string, emoji: string) => {
    let previousMessage: Message | null = null;
    set((state) => ({
      messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, (message) => {
        previousMessage = previousMessage ?? message;
        return removeReactionFromMessage(message, userId, emoji);
      }),
    }));

    try {
      const { error } = await supabase.rpc("remove_reaction", {
        _message_id: messageId,
        _user_id: userId,
        _emoji: emoji,
      });

      if (error) throw error;
    } catch (error) {
      if (previousMessage) {
        set((state) => ({
          messagesByChannel: updateMessageInCaches(state.messagesByChannel, messageId, () => previousMessage),
        }));
      }
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

  clearMessages: () => {
    bootstrapPrefetchCache.clear();
    set({ messagesByChannel: {}, replyingTo: null });
  },

  clearChannelCache: (channelId: string) => {
    bootstrapPrefetchCache.delete(channelId);
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

useMessageStore.subscribe((state, prevState) => {
  if (state.messagesByChannel === prevState.messagesByChannel) return;
  persistMessagesByChannel(state.messagesByChannel);
});

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
