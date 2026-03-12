import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useFriendStore } from '@/stores/friendStore';
import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';

interface ChannelUnreadInfo {
  unreadCount: number;
  mentionCount: number;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  firstUnreadMessageId: string | null;
}

interface UnreadState {
  [channelId: string]: ChannelUnreadInfo;
}

interface ServerUnreadInfo {
  hasUnread: boolean;
  totalMentions: number;
}

type BroadcastMutationOp = "INSERT" | "UPDATE" | "DELETE";

type ChannelReadBroadcastRow = {
  id?: string;
  user_id?: string;
  channel_id?: string;
  last_read_message_id?: string | null;
  last_read_at?: string | null;
};

type BroadcastMutationPayload<T> = {
  op?: BroadcastMutationOp;
  new?: T;
  old?: T;
};

const extractFirstMessageId = (rows: unknown): string | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const first = rows[0] as { id?: unknown };
  return typeof first.id === 'string' ? first.id : null;
};

const UNREAD_POLL_INTERVAL_MS = 90000;
const UNREAD_FETCH_COOLDOWN_MS = 3000;
const CHANNEL_READ_EVENT = 'kloak:channel-read';
const UNREAD_STORAGE_PREFIX = 'kloak:channel-unread:';
const sharedUnreadSnapshotByUser = new Map<string, { unreadState: UnreadState; cachedAt: number }>();

const readPersistedUnreadState = (userId: string): { unreadState: UnreadState; cachedAt: number } | null => {
  const existing = sharedUnreadSnapshotByUser.get(userId);
  if (existing && Date.now() - existing.cachedAt < UNREAD_POLL_INTERVAL_MS) {
    return existing;
  }
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${UNREAD_STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { unreadState?: UnreadState; cachedAt?: number };
    if (!parsed?.unreadState || typeof parsed.cachedAt !== 'number') return null;
    if (Date.now() - parsed.cachedAt >= UNREAD_POLL_INTERVAL_MS) return null;
    const snapshot = { unreadState: parsed.unreadState, cachedAt: parsed.cachedAt };
    sharedUnreadSnapshotByUser.set(userId, snapshot);
    return snapshot;
  } catch {
    return null;
  }
};

const persistUnreadState = (userId: string, unreadState: UnreadState) => {
  const existing = sharedUnreadSnapshotByUser.get(userId);
  const next = {
    unreadState: {
      ...(existing?.unreadState ?? {}),
      ...unreadState,
    },
    cachedAt: Date.now(),
  };
  sharedUnreadSnapshotByUser.set(userId, next);
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      `${UNREAD_STORAGE_PREFIX}${userId}`,
      JSON.stringify(next),
    );
  } catch {
    // ignore storage failures
  }
};

const getUnreadSubset = (snapshot: UnreadState, channelIds: string[]): { unreadState: UnreadState; complete: boolean } => {
  const unreadState: UnreadState = {};
  let complete = channelIds.length > 0;
  for (const channelId of channelIds) {
    const existing = snapshot[channelId];
    if (existing) {
      unreadState[channelId] = existing;
      continue;
    }
    complete = false;
  }
  return { unreadState, complete };
};

export const useUnread = (serverChannelIds: string[] = []) => {
  const { user } = useAuthStore();
  const userId = user?.id ?? null;
  const [unreadState, setUnreadState] = useState<UnreadState>({});
  const [isLoading, setIsLoading] = useState(false);
  const channelIdsRef = useRef<string[]>([]);
  const fetchSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const markInFlightRef = useRef<Map<string, Promise<void>>>(new Map());
  const unreadStateRef = useRef<UnreadState>({});
  const serverChannelIdsRef = useRef<string[]>(serverChannelIds);
  const fetchUnreadCountsRef = useRef<(opts?: { force?: boolean }) => Promise<void>>(async () => undefined);
  const channelIdsKey = [...serverChannelIds].sort().join(',');

  useEffect(() => {
    unreadStateRef.current = unreadState;
    if (userId && Object.keys(unreadState).length > 0) {
      persistUnreadState(userId, unreadState);
    }
  }, [unreadState, userId]);

  useEffect(() => {
    serverChannelIdsRef.current = serverChannelIds;
  }, [serverChannelIds]);

  useEffect(() => {
    if (!userId || !channelIdsKey) return;

    const persisted = readPersistedUnreadState(userId);
    if (!persisted) return;

    const { unreadState: subset } = getUnreadSubset(persisted.unreadState, serverChannelIds);
    if (Object.keys(subset).length === 0) return;
    setUnreadState(subset);
    unreadStateRef.current = subset;
    channelIdsRef.current = [...serverChannelIds];
    lastFetchAtRef.current = persisted.cachedAt;
  }, [channelIdsKey, serverChannelIds, userId]);

  // OPTIMIZATION: Use batch RPC instead of N+1 queries
  // This reduces 50+ queries to a single query per polling cycle
  const fetchUnreadCounts = useCallback(async (opts?: { force?: boolean }) => {
    if (!user || serverChannelIds.length === 0) return;

    // Debounce bursts while still allowing periodic/background reconciliation.
    const idsString = [...serverChannelIds].sort().join(',');
    const prevIdsString = [...channelIdsRef.current].sort().join(',');
    const idsChanged = idsString !== prevIdsString;
    const now = Date.now();
    if (!opts?.force && !idsChanged && now - lastFetchAtRef.current < UNREAD_FETCH_COOLDOWN_MS) {
      return;
    }

    if (!opts?.force) {
      const persisted = readPersistedUnreadState(user.id);
      if (persisted) {
        const { unreadState: subset, complete } = getUnreadSubset(persisted.unreadState, serverChannelIds);
        if (complete) {
          channelIdsRef.current = [...serverChannelIds];
          lastFetchAtRef.current = persisted.cachedAt;
          setUnreadState(subset);
          unreadStateRef.current = subset;
          return;
        }
      }
    }
    
    channelIdsRef.current = [...serverChannelIds];
    lastFetchAtRef.current = now;
    const seq = ++fetchSeqRef.current;
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    inFlightRef.current = true;
    setIsLoading(true);

    try {
      // Get blocked user IDs for filtering
      const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;

      // OPTIMIZATION: Single RPC call replaces N individual queries
      const { data, error } = await supabase.rpc('get_all_channel_unread_counts', {
        _user_id: user.id,
        _channel_ids: serverChannelIds,
        _blocked_user_ids: blockedUserIds.length > 0 ? blockedUserIds : [],
      });

      if (error) {
        console.error('Error fetching unread counts:', error);
        throw error;
      }

      if (fetchSeqRef.current !== seq) return;

      const newState: UnreadState = {};
      (data || []).forEach((row: {
        channel_id: string;
        unread_count: number;
        mention_count: number;
        last_read_at: string | null;
        last_read_message_id: string | null;
        first_unread_message_id: string | null;
      }) => {
        newState[row.channel_id] = {
          unreadCount: Number(row.unread_count),
          mentionCount: row.mention_count,
          lastReadMessageId: row.last_read_message_id,
          lastReadAt: row.last_read_at,
          firstUnreadMessageId: row.first_unread_message_id,
        };
      });

      // Ensure all requested channels have an entry (even if no unread)
      serverChannelIds.forEach((channelId) => {
        if (!newState[channelId]) {
          newState[channelId] = {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: null,
            lastReadAt: null,
            firstUnreadMessageId: null,
          };
        }
      });

      setUnreadState(newState);
      persistUnreadState(user.id, newState);
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    } finally {
      if (fetchSeqRef.current === seq) {
        setIsLoading(false);
      }
      inFlightRef.current = false;
      if (queuedRef.current) {
        queuedRef.current = false;
        fetchUnreadCounts({ force: true });
      }
    }
  }, [user, serverChannelIds]);

  useEffect(() => {
    fetchUnreadCountsRef.current = fetchUnreadCounts;
  }, [fetchUnreadCounts]);

  // Mark channel as read
  const markAsRead = useCallback(
    async (channelId: string, lastMessageId?: string) => {
      if (!user) return;

      // If we already consider this channel read up to the same message id, skip the RPC.
      // This avoids extra `mark_channel_read` when revisiting a channel you already read.
      if (lastMessageId) {
        const local = unreadStateRef.current[channelId];
        if (local?.lastReadMessageId === lastMessageId && local.unreadCount === 0 && local.mentionCount === 0) {
          return;
        }
      }

      const existing = markInFlightRef.current.get(channelId);
      if (existing) return existing;

      const p = (async () => {
        try {
          const now = new Date().toISOString();

          if (lastMessageId) {
            // Fast path: caller already knows the last visible message id.
            const { error: rpcError } = await supabase.rpc('mark_channel_read', {
              _channel_id: channelId,
              _user_id: user.id,
              _last_read_message_id: lastMessageId,
              _last_read_at: now,
            });

            if (rpcError) {
              console.warn('mark_channel_read RPC failed:', rpcError.message);
            }

            setUnreadState((prev) => ({
              ...prev,
              [channelId]: {
                unreadCount: 0,
                mentionCount: 0,
                lastReadMessageId: lastMessageId,
                lastReadAt: now,
                firstUnreadMessageId: null,
              },
            }));
          } else {
            // Avoid a client-side "latest message" query (causes request spam).
            // Let the DB compute the latest message id per channel in a single RPC.
            const { error: rpcError } = await supabase.rpc('mark_channels_read' as never, {
              _channel_ids: [channelId],
              _user_id: user.id,
              _last_read_at: now,
            } as never);

            let fallbackMessageId: string | null = null;

            if (rpcError) {
              console.warn('mark_channels_read RPC failed:', rpcError.message);

              // Back-compat fallback (in case migration hasn't been applied yet).
              // This reintroduces the extra query, but only until the RPC exists.
              const { data: latestMessages } = await supabase.rpc('get_channel_messages_secure', {
                _channel_id: channelId,
                _user_id: user.id,
                _limit: 1,
                _before: null,
                _blocked_user_ids: [],
              });

              fallbackMessageId = extractFirstMessageId(latestMessages);

              if (fallbackMessageId) {
                const { error: fallbackError } = await supabase.rpc('mark_channel_read', {
                  _channel_id: channelId,
                  _user_id: user.id,
                  _last_read_message_id: fallbackMessageId,
                  _last_read_at: now,
                });

                if (fallbackError) {
                  console.warn('mark_channel_read fallback failed:', fallbackError.message);
                }
              }
            }

            setUnreadState((prev) => ({
              ...prev,
              [channelId]: {
                unreadCount: 0,
                mentionCount: 0,
                lastReadMessageId: fallbackMessageId ?? prev[channelId]?.lastReadMessageId ?? null,
                lastReadAt: now,
                firstUnreadMessageId: null,
              },
            }));
          }

          // Broadcast locally so other `useUnread()` instances (ServerSidebar, etc.)
          // update immediately without waiting for realtime/poll.
          window.dispatchEvent(new CustomEvent(CHANNEL_READ_EVENT, { detail: { channelId, at: now } }));
        } catch (error) {
          console.error('Error marking channel as read:', error);
        } finally {
          const cur = markInFlightRef.current.get(channelId);
          if (cur === p) markInFlightRef.current.delete(channelId);
        }
      })();

      markInFlightRef.current.set(channelId, p);
      return p;
    },
    [user]
  );

  // Get unread info for a specific channel
  const getChannelUnread = useCallback(
    (channelId: string): ChannelUnreadInfo => {
      return (
        unreadState[channelId] || {
          unreadCount: 0,
          mentionCount: 0,
          lastReadMessageId: null,
          lastReadAt: null,
          firstUnreadMessageId: null,
        }
      );
    },
    [unreadState]
  );

  // Check if any channel has unread messages
  const hasAnyUnread = useCallback(() => {
    return Object.values(unreadState).some((s) => s.unreadCount > 0);
  }, [unreadState]);

  // Get total mention count
  const getTotalMentions = useCallback(() => {
    return Object.values(unreadState).reduce((sum, s) => sum + s.mentionCount, 0);
  }, [unreadState]);

  // Get server-level unread info (for sidebar indicators)
  const getServerUnreadInfo = useCallback(
    (channelIds: string[]): ServerUnreadInfo => {
      let hasUnread = false;
      let totalMentions = 0;

      for (const channelId of channelIds) {
        const info = unreadState[channelId];
        if (info) {
          if (info.unreadCount > 0) hasUnread = true;
          totalMentions += info.mentionCount;
        }
      }

      return { hasUnread, totalMentions };
    },
    [unreadState]
  );

  // Mark all channels in a server as read
  const markServerAsRead = useCallback(
    async (channelIds: string[]) => {
      if (!user || channelIds.length === 0) return;

      const now = new Date().toISOString();

      try {
        // One RPC instead of N calls (+ avoids "latest message" lookups on the client).
        const { error: rpcError } = await supabase.rpc('mark_channels_read' as never, {
          _channel_ids: channelIds,
          _user_id: user.id,
          _last_read_at: now,
        } as never);

        if (rpcError) {
          console.warn('mark_channels_read RPC failed:', rpcError.message);

          // Back-compat fallback (in case migration hasn't been applied yet).
          // Note: this is N+1, but only used during rollout.
          await Promise.all(
            channelIds.map(async (channelId) => {
              const { data: latestMessages } = await supabase.rpc('get_channel_messages_secure', {
                _channel_id: channelId,
                _user_id: user.id,
                _limit: 1,
                _before: null,
                _blocked_user_ids: [],
              });

              const messageId = extractFirstMessageId(latestMessages);
              if (!messageId) return;

              const { error: fallbackError } = await supabase.rpc('mark_channel_read', {
                _channel_id: channelId,
                _user_id: user.id,
                _last_read_message_id: messageId,
                _last_read_at: now,
              });

              if (fallbackError) {
                console.warn('mark_channel_read fallback failed:', fallbackError.message);
              }
            })
          );
        }
      } catch (error) {
        console.error('Error marking server as read:', error);
      }

      // Optimistically clear unread state locally.
      setUnreadState((prev) => {
        const next = { ...prev };
        for (const channelId of channelIds) {
          next[channelId] = {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: prev[channelId]?.lastReadMessageId ?? null,
            lastReadAt: now,
            firstUnreadMessageId: null,
          };
        }
        return next;
      });

      // Broadcast locally for cross-component sync.
      for (const channelId of channelIds) {
        window.dispatchEvent(new CustomEvent(CHANNEL_READ_EVENT, { detail: { channelId, at: now } }));
      }
    },
    [user]
  );

  // Fetch on mount and when channel IDs change
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts, channelIdsKey]);

  // Poll periodically to keep unread indicators consistent even when realtime misses events.
  useEffect(() => {
    if (!user || serverChannelIds.length === 0) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      fetchUnreadCounts();
    }, UNREAD_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user, channelIdsKey, fetchUnreadCounts, serverChannelIds.length]);

  // Subscribe to broadcast updates for current user's channel reads.
  useEffect(() => {
    if (!userId) return;

    const topic = `user:${userId}`;
    const channel = acquireChannel(topic);
    channel.on(
      'broadcast',
      { event: 'channel_reads' },
      ({ payload }) => {
        const eventPayload = payload as BroadcastMutationPayload<ChannelReadBroadcastRow>;
        const op = eventPayload?.op;
        if (!op) return;

        const row = op === "DELETE" ? eventPayload.old : eventPayload.new;
        const channelId = row?.channel_id;
        if (!channelId) {
          fetchUnreadCountsRef.current({ force: true });
          return;
        }

        const trackedChannels = serverChannelIdsRef.current;
        if (trackedChannels.length > 0 && !trackedChannels.includes(channelId)) {
          return;
        }

        if (op === "DELETE") {
          fetchUnreadCountsRef.current({ force: true });
          return;
        }

        // A channel_read update for this user means unread is cleared for that channel.
        setUnreadState((prev) => ({
          ...prev,
          [channelId]: {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: row?.last_read_message_id ?? prev[channelId]?.lastReadMessageId ?? null,
            lastReadAt: row?.last_read_at ?? prev[channelId]?.lastReadAt ?? null,
            firstUnreadMessageId: null,
          },
        }));
      },
    );
    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [userId]);

  // Cross-component sync: when any part of the app marks a channel as read,
  // immediately clear that channel locally if it's in our tracked set.
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ channelId?: string; at?: string }>;
      const channelId = ev.detail?.channelId;
      const at = ev.detail?.at;
      if (!channelId) return;
      if (serverChannelIds.length > 0 && !serverChannelIds.includes(channelId)) return;

      setUnreadState((prev) => ({
        ...prev,
        [channelId]: {
          unreadCount: 0,
          mentionCount: 0,
          lastReadMessageId: prev[channelId]?.lastReadMessageId ?? null,
          lastReadAt: at ?? prev[channelId]?.lastReadAt ?? null,
          firstUnreadMessageId: null,
        },
      }));
    };

    window.addEventListener(CHANNEL_READ_EVENT, handler as EventListener);
    return () => window.removeEventListener(CHANNEL_READ_EVENT, handler as EventListener);
  }, [serverChannelIds]);

  // Reconcile on app focus / tab restore (realtime can be lossy during sleep/background)
  // OPTIMIZATION: Only use visibilitychange (not focus) to avoid double-firing
  // when switching tabs. A single event is sufficient and reduces redundant queries.
  useEffect(() => {
    let lastRefetchTime = 0;
    const REFETCH_COOLDOWN_MS = 5000; // Don't refetch more than once per 5 seconds
    const MIN_HIDDEN_MS_FOR_REFETCH = 15_000; // skip refetch for quick tab switches
    let hiddenAt: number | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }

      if (document.visibilityState !== "visible") return;

      // If the tab was only hidden briefly, don't refetch.
      if (hiddenAt) {
        const hiddenFor = Date.now() - hiddenAt;
        hiddenAt = null;
        if (hiddenFor > 0 && hiddenFor < MIN_HIDDEN_MS_FOR_REFETCH) return;
      }

      const now = Date.now();
      if (now - lastRefetchTime < REFETCH_COOLDOWN_MS) return;
      lastRefetchTime = now;

      fetchUnreadCounts({ force: true });
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchUnreadCounts]);

  return {
    unreadState,
    isLoading,
    markAsRead,
    getChannelUnread,
    hasAnyUnread,
    getTotalMentions,
    getServerUnreadInfo,
    refetch: fetchUnreadCounts,
    markServerAsRead,
  };
};
