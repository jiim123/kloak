import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useFriendStore } from '@/stores/friendStore';
import { acquireChannel, subscribeChannel, releaseChannel, isChannelSubscribed } from '@/lib/sharedChannel';
import { isKloakSocketEnabled, kloakSocket } from '@/lib/kloakSocket';

interface ChannelUnreadInfo {
  unreadCount: number;
  mentionCount: number;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  firstUnreadMessageId: string | null;
  latestUnreadMessageId: string | null;
  latestUnreadCreatedAt: string | null;
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
  mention_count?: number | null;
};

type ChannelReadEventDetail = {
  channelId?: string;
  at?: string;
  lastReadMessageId?: string | null;
  unreadCount?: number;
  mentionCount?: number;
};

type BroadcastMutationPayload<T> = {
  op?: BroadcastMutationOp;
  new?: T;
  old?: T;
};

type ReadWatermark = {
  at: string;
  lastReadMessageId: string | null;
  recordedAt: number;
};

const UNREAD_FETCH_COOLDOWN_MS = 3000;
const READ_WATERMARK_TTL_MS = 30 * 24 * 60 * 60_000;
const CHANNEL_READ_EVENT = 'kloak:channel-read';
const READ_WATERMARK_STORAGE_PREFIX = 'kloak:channel-read-watermarks:';
const sharedReadWatermarksByUser = new Map<string, Map<string, ReadWatermark>>();


const readPersistedReadWatermarks = (userId: string): Map<string, ReadWatermark> => {
  const cached = sharedReadWatermarksByUser.get(userId);
  if (cached) return cached;

  const watermarks = new Map<string, ReadWatermark>();
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(`${READ_WATERMARK_STORAGE_PREFIX}${userId}`);
      const parsed = raw ? JSON.parse(raw) as Record<string, ReadWatermark> : null;
      if (parsed && typeof parsed === 'object') {
        for (const [channelId, watermark] of Object.entries(parsed)) {
          if (!watermark?.at || typeof watermark.recordedAt !== 'number') continue;
          watermarks.set(channelId, {
            at: watermark.at,
            lastReadMessageId: watermark.lastReadMessageId ?? null,
            recordedAt: watermark.recordedAt,
          });
        }
      }
    } catch {
      // ignore storage failures
    }
  }

  pruneReadWatermarks(watermarks);
  sharedReadWatermarksByUser.set(userId, watermarks);
  return watermarks;
};

const persistReadWatermarks = (userId: string, watermarks: Map<string, ReadWatermark>) => {
  pruneReadWatermarks(watermarks);
  sharedReadWatermarksByUser.set(userId, watermarks);
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      `${READ_WATERMARK_STORAGE_PREFIX}${userId}`,
      JSON.stringify(Object.fromEntries(watermarks)),
    );
  } catch {
    // ignore storage failures
  }
};
const toTime = (value: string | null | undefined): number => {
  if (!value) return Number.NEGATIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
};
const readAtForMessage = (fallbackAt: string, messageCreatedAt?: string): string => {
  const fallbackTime = toTime(fallbackAt);
  const messageTime = toTime(messageCreatedAt);
  if (!Number.isFinite(messageTime)) return fallbackAt;

  const nextTime = Math.max(Number.isFinite(fallbackTime) ? fallbackTime : 0, messageTime + 1);
  return new Date(nextTime).toISOString();
};

const pruneReadWatermarks = (watermarks: Map<string, ReadWatermark>, now = Date.now()) => {
  for (const [channelId, watermark] of watermarks) {
    if (now - watermark.recordedAt > READ_WATERMARK_TTL_MS) {
      watermarks.delete(channelId);
    }
  }
};

const applyReadWatermarks = (state: UnreadState, watermarks: Map<string, ReadWatermark>): UnreadState => {
  pruneReadWatermarks(watermarks);
  let next = state;

  for (const [channelId, watermark] of watermarks) {
    const current = next[channelId];
    if (!current) continue;
    if (toTime(current.lastReadAt) >= toTime(watermark.at)) continue;

    if (next === state) next = { ...state };
    next[channelId] = {
      unreadCount: 0,
      mentionCount: 0,
      lastReadMessageId: watermark.lastReadMessageId ?? current.lastReadMessageId ?? null,
      lastReadAt: watermark.at,
      firstUnreadMessageId: null,
    latestUnreadMessageId: null,
    latestUnreadCreatedAt: null,
    };
  }

  return next;
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
  const readWatermarksRef = useRef<Map<string, ReadWatermark>>(new Map());
  const serverChannelIdsRef = useRef<string[]>(serverChannelIds);
  const fetchUnreadCountsRef = useRef<(opts?: { force?: boolean }) => Promise<void>>(async () => undefined);
  const channelIdsKey = [...serverChannelIds].sort().join(',');

  useEffect(() => {
    unreadStateRef.current = unreadState;
  }, [unreadState]);

  useEffect(() => {
    serverChannelIdsRef.current = serverChannelIds;
  }, [serverChannelIds]);

  useEffect(() => {
    readWatermarksRef.current = userId ? readPersistedReadWatermarks(userId) : new Map();
  }, [userId]);


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
        latest_unread_message_id?: string | null;
        latest_unread_created_at?: string | null;
      }) => {
        newState[row.channel_id] = {
          unreadCount: Number(row.unread_count),
          mentionCount: row.mention_count,
          lastReadMessageId: row.last_read_message_id,
          lastReadAt: row.last_read_at,
          firstUnreadMessageId: row.first_unread_message_id,
          latestUnreadMessageId: row.latest_unread_message_id ?? null,
          latestUnreadCreatedAt: row.latest_unread_created_at ?? null,
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
            latestUnreadMessageId: null,
            latestUnreadCreatedAt: null,
          };
        }
      });

      const reconciledState = applyReadWatermarks(newState, readWatermarksRef.current);
      setUnreadState(reconciledState);
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

  const recordReadWatermark = useCallback((channelId: string, lastReadMessageId: string | null, at: string) => {
    if (!userId) return;
    pruneReadWatermarks(readWatermarksRef.current);
    const existing = readWatermarksRef.current.get(channelId);
    if (existing && toTime(existing.at) > toTime(at)) return;
    readWatermarksRef.current.set(channelId, { at, lastReadMessageId, recordedAt: Date.now() });
    persistReadWatermarks(userId, readWatermarksRef.current);
  }, [userId]);

  const publishChannelRead = useCallback((channelId: string, lastReadMessageId: string | null, lastReadAt: string) => {
    if (!userId) return;
    const topic = `user:${userId}`;
    const channel = acquireChannel(topic);
    let didSendOrRelease = false;
    let unsubscribeStatus: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const releaseOnce = () => {
      if (didSendOrRelease) return;
      didSendOrRelease = true;
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribeStatus?.();
      releaseChannel(topic);
    };

    const send = () => {
      void channel.send({
        type: 'broadcast',
        event: 'channel_reads',
        payload: {
          op: 'UPDATE',
          new: {
            user_id: userId,
            channel_id: channelId,
            last_read_message_id: lastReadMessageId,
            last_read_at: lastReadAt,
            mention_count: 0,
          },
        },
      }).finally(releaseOnce);
    };

    if (isChannelSubscribed(topic)) {
      send();
      return;
    }

    unsubscribeStatus = subscribeChannel(topic, (status) => {
      if (status === 'SUBSCRIBED') {
        send();
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        releaseOnce();
      }
    });

    timeoutId = setTimeout(releaseOnce, 5000);
  }, [recordReadWatermark, userId]);

  const dispatchLocalChannelRead = useCallback((channelId: string, at: string, lastReadMessageId: string | null = null) => {
    const previousUnread = unreadStateRef.current[channelId];
    window.dispatchEvent(
      new CustomEvent<ChannelReadEventDetail>(CHANNEL_READ_EVENT, {
        detail: {
          channelId,
          at,
          lastReadMessageId,
          unreadCount: previousUnread?.unreadCount ?? 0,
          mentionCount: previousUnread?.mentionCount ?? 0,
        },
      }),
    );
  }, []);

  // Mark channel as read
  const markAsRead = useCallback(
    async (channelId: string, lastMessageId?: string, lastMessageCreatedAt?: string) => {
      if (!user) return;

      const existing = markInFlightRef.current.get(channelId);
      if (existing) return existing;

      const p = (async () => {
        const fallbackAt = new Date().toISOString();
        const currentUnread = unreadStateRef.current[channelId];
        const latestUnreadCreatedAt = lastMessageCreatedAt ?? currentUnread?.latestUnreadCreatedAt ?? undefined;
        const readAt = readAtForMessage(fallbackAt, latestUnreadCreatedAt);
        const optimisticLastReadMessageId = lastMessageId ?? currentUnread?.latestUnreadMessageId ?? currentUnread?.lastReadMessageId ?? null;

        try {
          recordReadWatermark(channelId, optimisticLastReadMessageId, readAt);

          setUnreadState((prev) => ({
            ...prev,
            [channelId]: {
              unreadCount: 0,
              mentionCount: 0,
              lastReadMessageId: optimisticLastReadMessageId,
              lastReadAt: readAt,
              firstUnreadMessageId: null,
              latestUnreadMessageId: null,
              latestUnreadCreatedAt: null,
            },
          }));
          dispatchLocalChannelRead(channelId, readAt, optimisticLastReadMessageId);

          if (isKloakSocketEnabled()) {
            await kloakSocket.markChannelRead({
              channelId,
              lastReadMessageId: optimisticLastReadMessageId,
              lastReadAt: readAt,
            });
          } else {
            const { error } = optimisticLastReadMessageId
              ? await supabase.rpc('mark_channel_read', {
                  _channel_id: channelId,
                  _user_id: user.id,
                  _last_read_message_id: optimisticLastReadMessageId,
                  _last_read_at: readAt,
                })
              : await supabase.rpc('mark_channels_read', {
                  _channel_ids: [channelId],
                  _user_id: user.id,
                  _last_read_at: readAt,
                });

            if (error) throw error;
            publishChannelRead(channelId, optimisticLastReadMessageId, readAt);
          }
        } catch (error) {
          console.error('Error marking channel as read:', error);
          void fetchUnreadCountsRef.current({ force: true });
        } finally {
          const cur = markInFlightRef.current.get(channelId);
          if (cur === p) markInFlightRef.current.delete(channelId);
        }
      })();

      markInFlightRef.current.set(channelId, p);
      return p;
    },
    [dispatchLocalChannelRead, publishChannelRead, recordReadWatermark, user]
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
          latestUnreadMessageId: null,
          latestUnreadCreatedAt: null,
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
      const currentState = unreadStateRef.current;
      const readEvents = channelIds.map((channelId) => {
        const currentUnread = currentState[channelId];
        const readAt = readAtForMessage(now, currentUnread?.latestUnreadCreatedAt ?? undefined);
        const lastReadMessageId = currentUnread?.latestUnreadMessageId ?? currentUnread?.lastReadMessageId ?? null;
        recordReadWatermark(channelId, lastReadMessageId, readAt);
        return { channelId, lastReadMessageId, readAt };
      });

      setUnreadState((prev) => {
        const next = { ...prev };
        for (const event of readEvents) {
          next[event.channelId] = {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: event.lastReadMessageId,
            lastReadAt: event.readAt,
            firstUnreadMessageId: null,
            latestUnreadMessageId: null,
            latestUnreadCreatedAt: null,
          };
        }
        return next;
      });

      for (const event of readEvents) {
        dispatchLocalChannelRead(event.channelId, event.readAt, event.lastReadMessageId);
      }

      try {
        if (isKloakSocketEnabled()) {
          await Promise.all(
            readEvents.map((event) =>
              kloakSocket.markChannelRead({
                channelId: event.channelId,
                lastReadMessageId: event.lastReadMessageId,
                lastReadAt: event.readAt,
              }),
            ),
          );
        } else {
          const { error } = await supabase.rpc('mark_channels_read', {
            _channel_ids: channelIds,
            _user_id: user.id,
            _last_read_at: now,
          });

          if (error) throw error;

          for (const event of readEvents) {
            publishChannelRead(event.channelId, event.lastReadMessageId, event.readAt);
          }
        }
      } catch (error) {
        console.error('Error marking server as read:', error);
        void fetchUnreadCountsRef.current({ force: true });
      }
    },
    [dispatchLocalChannelRead, publishChannelRead, recordReadWatermark, user]
  );
  // Fetch on mount and when channel IDs change
  useEffect(() => {
    fetchUnreadCounts();
  }, [fetchUnreadCounts, channelIdsKey]);

  // Kloak user-topic unread fanout. This keeps channel badges moving even when
  // the active route is a DM, settings page, or any non-channel surface.
  useEffect(() => {
    if (!userId || !isKloakSocketEnabled()) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void kloakSocket
      .subscribe(`user:${userId}`, (event) => {
        if (event.event === "channel.read") {
          const payload = event.payload as { channel_id?: string; last_read_message_id?: string | null; last_read_at?: string | null };
          const channelId = payload?.channel_id;
          if (!channelId) return;
          const trackedChannels = serverChannelIdsRef.current;
          if (trackedChannels.length > 0 && !trackedChannels.includes(channelId)) return;
          const at = payload.last_read_at ?? new Date().toISOString();
          recordReadWatermark(channelId, payload.last_read_message_id ?? null, at);
          setUnreadState((prev) => ({
            ...prev,
            [channelId]: {
              unreadCount: 0,
              mentionCount: 0,
              lastReadMessageId: payload.last_read_message_id ?? prev[channelId]?.lastReadMessageId ?? null,
              lastReadAt: at,
              firstUnreadMessageId: null,
              latestUnreadMessageId: null,
              latestUnreadCreatedAt: null,
            },
          }));
          return;
        }

        if (event.event !== "channel.unread") return;
        const payload = event.payload as ChannelUnreadSocketPayload;
        const channelId = payload?.channel_id;
        if (!channelId || payload.author_user_id === userId) return;

        const trackedChannels = serverChannelIdsRef.current;
        if (trackedChannels.length > 0 && !trackedChannels.includes(channelId)) return;

        const createdAt = payload.created_at ?? event.createdAt ?? new Date().toISOString();
        const messageId = payload.message_id ?? null;
        const unreadDelta = Math.max(1, Number(payload.unread_count_delta ?? 1));
        const mentionDelta = Math.max(0, Number(payload.mention_count_delta ?? 0));

        setUnreadState((prev) => {
          const current = prev[channelId] ?? {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: null,
            lastReadAt: null,
            firstUnreadMessageId: null,
            latestUnreadMessageId: null,
            latestUnreadCreatedAt: null,
          };

          return {
            ...prev,
            [channelId]: {
              ...current,
              unreadCount: current.unreadCount + unreadDelta,
              mentionCount: current.mentionCount + mentionDelta,
              firstUnreadMessageId: current.firstUnreadMessageId ?? messageId,
              latestUnreadMessageId: messageId ?? current.latestUnreadMessageId,
              latestUnreadCreatedAt: createdAt,
            },
          };
        });

        void fetchUnreadCountsRef.current({ force: true });
      })
      .then((off) => {
        if (cancelled) off();
        else unsubscribe = off;
      })
      .catch((error) => {
        console.warn("[KloakWS] Failed to subscribe to channel unread fanout", error);
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [recordReadWatermark, userId]);
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
        recordReadWatermark(channelId, row?.last_read_message_id ?? null, row?.last_read_at ?? new Date().toISOString());
        setUnreadState((prev) => ({
          ...prev,
          [channelId]: {
            unreadCount: 0,
            mentionCount: 0,
            lastReadMessageId: row?.last_read_message_id ?? prev[channelId]?.lastReadMessageId ?? null,
            lastReadAt: row?.last_read_at ?? prev[channelId]?.lastReadAt ?? null,
            firstUnreadMessageId: null,
          latestUnreadMessageId: null,
          latestUnreadCreatedAt: null,
          },
        }));
      },
    );
    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [recordReadWatermark, userId]);

  // Cross-component sync: when any part of the app marks a channel as read,
  // immediately clear that channel locally if it's in our tracked set.
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<ChannelReadEventDetail>;
      const channelId = ev.detail?.channelId;
      const at = ev.detail?.at;
      if (!channelId) return;
      if (serverChannelIds.length > 0 && !serverChannelIds.includes(channelId)) return;
      if (at) recordReadWatermark(channelId, ev.detail?.lastReadMessageId ?? null, at);

      setUnreadState((prev) => ({
        ...prev,
        [channelId]: {
          unreadCount: 0,
          mentionCount: 0,
          lastReadMessageId: prev[channelId]?.lastReadMessageId ?? null,
          lastReadAt: at ?? prev[channelId]?.lastReadAt ?? null,
          firstUnreadMessageId: null,
          latestUnreadMessageId: null,
          latestUnreadCreatedAt: null,
        },
      }));
    };

    window.addEventListener(CHANNEL_READ_EVENT, handler as EventListener);
    return () => window.removeEventListener(CHANNEL_READ_EVENT, handler as EventListener);
  }, [recordReadWatermark, serverChannelIds]);

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




