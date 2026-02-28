import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import type { User, UserStatus } from '@/types';

/**
 * Patches user data across all relevant stores (server members, friends, DMs).
 * Exported so other components can use it for manual updates.
 */
export const patchUserAcrossStores = (updatedUser: Partial<User> & { id: string }) => {
  // Patch current server members in-place
  useServerStore.setState((state) => {
    if (!state.currentServer || state.members.length === 0) return {};
    let changed = false;
    const members = state.members.map((m) => {
      if (m.user_id !== updatedUser.id) return m;
      changed = true;
      return {
        ...m,
        user: m.user ? { ...m.user, ...updatedUser } : (updatedUser as User),
      };
    });
    return changed ? { members } : {};
  });

  // Patch friend lists
  useFriendStore.setState((state) => {
    type HasId = { id: string };
    const patch = <T extends HasId>(list: T[]): { list: T[]; changed: boolean } => {
      let changed = false;
      const next = list.map((item) => {
        if (item.id !== updatedUser.id) return item;
        changed = true;
        return { ...item, ...updatedUser } as T;
      });
      return changed ? { list: next, changed } : { list, changed: false };
    };

    const friends = patch(state.friends);
    const pendingRequests = patch(state.pendingRequests);
    const outgoingRequests = patch(state.outgoingRequests);
    const blockedUsers = patch(state.blockedUsers);

    if (!friends.changed && !pendingRequests.changed && !outgoingRequests.changed && !blockedUsers.changed) {
      return {};
    }

    return {
      friends: friends.list,
      pendingRequests: pendingRequests.list,
      outgoingRequests: outgoingRequests.list,
      blockedUsers: blockedUsers.list,
    };
  });

  // Patch DM conversations
  useDMStore.setState((state) => {
    if (!state.currentConversation && state.conversations.length === 0) return {};

    let changed = false;
    const conversations = state.conversations.map((c) => {
      if (c.other_user?.id !== updatedUser.id) return c;
      changed = true;
      return { ...c, other_user: { ...c.other_user, ...updatedUser } };
    });

    const currentConversation =
      state.currentConversation?.other_user?.id === updatedUser.id
        ? { ...state.currentConversation, other_user: { ...state.currentConversation.other_user, ...updatedUser } }
        : state.currentConversation;

    return changed || currentConversation !== state.currentConversation
      ? { conversations, currentConversation }
      : {};
  });
};

type PresenceRow = {
  id: string;
  status: string | null;
  last_seen: string | null;
};

type GlobalPresenceMeta = {
  user_id?: string;
  status?: string | null;
  custom_status?: string | null;
  last_seen?: string | null;
  ts?: number;
};

// Fallback polling only; targeted realtime listeners should handle most updates.
const GLOBAL_USERS_PRESENCE_TOPIC = 'presence:users-global';
const PRESENCE_POLL_INTERVAL_MS = 90_000;
const PRESENCE_FETCH_COOLDOWN_MS = 60_000;
const PRESENCE_MIN_HIDDEN_MS_FOR_REFETCH = 15_000;
const PRESENCE_BACKSTOP_POLL_INTERVAL_MS = 300_000;
const PRESENCE_ABSENT_GRACE_MS = 30_000;
const RECENT_PRESENCE_WINDOW_MS = 2 * PRESENCE_POLL_INTERVAL_MS;

const recentRealtimePresenceByUser = new Map<string, number>();

export const hasRecentRealtimePresence = (userId: string, nowMs: number = Date.now()): boolean => {
  const lastSeenAt = recentRealtimePresenceByUser.get(userId);
  return typeof lastSeenAt === 'number' && nowMs - lastSeenAt <= RECENT_PRESENCE_WINDOW_MS;
};

const toUserStatus = (value: unknown, fallback: UserStatus): UserStatus => {
  if (value === 'online' || value === 'idle' || value === 'dnd' || value === 'offline') {
    return value;
  }
  return fallback;
};

const collectPresenceTargetUserIds = (): string[] => {
  const { friends } = useFriendStore.getState();
  const { conversations } = useDMStore.getState();
  const { members } = useServerStore.getState();
  const userIds = new Set<string>();
  friends.forEach((f) => userIds.add(f.id));
  conversations.forEach((c) => {
    if (c.other_user?.id) userIds.add(c.other_user.id);
  });
  members.forEach((member) => userIds.add(member.user_id));
  return Array.from(userIds);
};

const collectPollTargetUserIds = (): string[] => {
  const { friends } = useFriendStore.getState();
  const { conversations } = useDMStore.getState();
  const userIds = new Set<string>();
  friends.forEach((f) => userIds.add(f.id));
  conversations.forEach((c) => {
    if (c.other_user?.id) userIds.add(c.other_user.id);
  });
  return Array.from(userIds);
};

const buildOwnPresencePayload = (): GlobalPresenceMeta | null => {
  const { user, manualStatus } = useAuthStore.getState();
  if (!user) return null;
  const status = manualStatus === 'offline' ? 'offline' : toUserStatus(user.status, 'online');
  return {
    user_id: user.id,
    status,
    custom_status: user.custom_status ?? null,
    last_seen: user.last_seen ?? null,
    ts: Date.now(),
  };
};

/**
 * Hook for targeted presence updates.
 * 
 * OPTIMIZATION: Removed global unfiltered subscription to users table.
 * Previously, we subscribed to ALL user updates platform-wide which caused
 * massive egress (O(n²) scaling - every user's heartbeat broadcast to every client).
 * 
 * Now we only poll presence for users the client actually cares about:
 * - Friends
 * - DM conversation participants
 * - Current server members (handled separately by useRealtimeMembers)
 */
export const useRealtimeUsers = () => {
  const authUser = useAuthStore((s) => s.user);
  const manualStatus = useAuthStore((s) => s.manualStatus);
  const lastPollRef = useRef<number>(0);
  const lastBackstopPollRef = useRef<number>(0);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceConnectedRef = useRef(false);
  const presenceSigByUserRef = useRef<Map<string, string>>(new Map());
  const absenceStartedAtByUserRef = useRef<Map<string, number>>(new Map());
  const tabIdRef = useRef<string>(Math.random().toString(36).slice(2, 10));
  const applyPresenceRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const userId = authUser?.id;
    if (!userId) {
      const existing = presenceChannelRef.current;
      presenceChannelRef.current = null;
      presenceConnectedRef.current = false;
      presenceSigByUserRef.current.clear();
      absenceStartedAtByUserRef.current.clear();
      recentRealtimePresenceByUser.clear();
      applyPresenceRef.current = null;
      if (existing) {
        try {
          void existing.untrack();
          supabase.removeChannel(existing);
        } catch {
          // ignore cleanup errors
        }
      }
      return;
    }

    const channel = supabase.channel(GLOBAL_USERS_PRESENCE_TOPIC, {
      config: { presence: { key: `${userId}:${tabIdRef.current}` } },
    });
    presenceChannelRef.current = channel;
    const presenceSigByUser = presenceSigByUserRef.current;
    const absenceStartedAtByUser = absenceStartedAtByUserRef.current;

    const applyPresenceSnapshot = () => {
      const nowMs = Date.now();
      const targetIds = collectPresenceTargetUserIds();
      if (targetIds.length === 0) return;

      const targetSet = new Set(targetIds);
      const rawState = channel.presenceState() as Record<string, GlobalPresenceMeta[]>;
      const latestByUser = new Map<string, GlobalPresenceMeta>();

      Object.values(rawState).forEach((entries) => {
        if (!Array.isArray(entries)) return;
        entries.forEach((meta) => {
          if (!meta || typeof meta.user_id !== 'string') return;
          const prev = latestByUser.get(meta.user_id);
          const prevTs = typeof prev?.ts === 'number' ? prev.ts : 0;
          const nextTs = typeof meta.ts === 'number' ? meta.ts : 0;
          if (!prev || nextTs >= prevTs) {
            latestByUser.set(meta.user_id, meta);
          }
        });
      });

      for (const trackedUserId of Array.from(presenceSigByUser.keys())) {
        if (!targetSet.has(trackedUserId)) {
          presenceSigByUser.delete(trackedUserId);
          absenceStartedAtByUser.delete(trackedUserId);
          recentRealtimePresenceByUser.delete(trackedUserId);
        }
      }

      for (const trackedUserId of Array.from(absenceStartedAtByUser.keys())) {
        if (!targetSet.has(trackedUserId)) {
          absenceStartedAtByUser.delete(trackedUserId);
        }
      }

      targetIds.forEach((targetId) => {
        const meta = latestByUser.get(targetId);
        if (!meta) {
          if (targetId === userId) return;
          const absentSince = absenceStartedAtByUser.get(targetId);
          if (typeof absentSince !== 'number') {
            absenceStartedAtByUser.set(targetId, nowMs);
            return;
          }
          if (nowMs - absentSince < PRESENCE_ABSENT_GRACE_MS) {
            return;
          }
          const offlineSig = 'offline|absent';
          if (presenceSigByUser.get(targetId) === offlineSig) return;
          presenceSigByUser.set(targetId, offlineSig);
          recentRealtimePresenceByUser.delete(targetId);
          patchUserAcrossStores({ id: targetId, status: 'offline' });
          return;
        }

        absenceStartedAtByUser.delete(targetId);
        recentRealtimePresenceByUser.set(targetId, nowMs);
        const status = toUserStatus(meta.status, 'online');
        const signature = `${status}|${meta.last_seen ?? ''}|${meta.custom_status ?? ''}`;
        if (presenceSigByUser.get(targetId) === signature) return;
        presenceSigByUser.set(targetId, signature);
        patchUserAcrossStores({
          id: targetId,
          status,
          custom_status: meta.custom_status ?? null,
          last_seen: meta.last_seen ?? null,
        });
      });
    };

    applyPresenceRef.current = applyPresenceSnapshot;
    const unsubFriends = useFriendStore.subscribe(() => applyPresenceSnapshot());
    const unsubDMs = useDMStore.subscribe(() => applyPresenceSnapshot());

    channel
      .on('presence', { event: 'sync' }, applyPresenceSnapshot)
      .on('presence', { event: 'join' }, applyPresenceSnapshot)
      .on('presence', { event: 'leave' }, applyPresenceSnapshot)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          presenceConnectedRef.current = true;
          const payload = buildOwnPresencePayload();
          if (payload) {
            void channel.track(payload).catch(() => undefined);
          }
          applyPresenceSnapshot();
          return;
        }

        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          presenceConnectedRef.current = false;
        }
      });

    return () => {
      unsubFriends();
      unsubDMs();
      if (presenceChannelRef.current === channel) {
        presenceChannelRef.current = null;
      }
      if (applyPresenceRef.current === applyPresenceSnapshot) {
        applyPresenceRef.current = null;
      }
      presenceConnectedRef.current = false;
      presenceSigByUser.clear();
      absenceStartedAtByUser.clear();
      recentRealtimePresenceByUser.clear();
      try {
        void channel.untrack();
        supabase.removeChannel(channel);
      } catch {
        // ignore cleanup errors
      }
    };
  }, [authUser?.id]);

  useEffect(() => {
    const channel = presenceChannelRef.current;
    if (!channel || !presenceConnectedRef.current || !authUser?.id) return;
    const payload = buildOwnPresencePayload();
    if (!payload) return;
    void channel.track(payload).catch(() => undefined);
  }, [authUser?.id, authUser?.status, authUser?.custom_status, authUser?.last_seen, manualStatus]);

  useEffect(() => {
    // Targeted polling: only fetch presence for users we care about
    const pollPresence = async (opts?: { force?: boolean }) => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      applyPresenceRef.current?.();
      const targetUserIds = collectPollTargetUserIds();
      if (targetUserIds.length === 0) return;

      // Throttle burst polling.
      const now = Date.now();
      if (presenceConnectedRef.current && !opts?.force) {
        if (now - lastBackstopPollRef.current < PRESENCE_BACKSTOP_POLL_INTERVAL_MS) return;
        lastBackstopPollRef.current = now;
      }
      if (now - lastPollRef.current < PRESENCE_FETCH_COOLDOWN_MS) return;
      lastPollRef.current = now;

      // Fetch only the columns we need (optimized query)
      const { data, error } = await supabase.rpc('get_users_presence_secure', {
        _user_id: userId,
        _target_user_ids: targetUserIds,
      });

      if (error || !data) return;

      // Patch each user's presence
      const rows = Array.isArray(data) ? (data as PresenceRow[]) : [];
      rows.forEach((presence) => {
        patchUserAcrossStores({
          id: presence.id,
          status: toUserStatus(presence.status, 'offline'),
          last_seen: presence.last_seen,
        });
      });
    };

    // Poll immediately on mount (if tab is visible)
    if (document.visibilityState === 'visible') {
      pollPresence({ force: true });
    }

    // Poll at reduced frequency while the tab is visible.
    const pollInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      pollPresence();
    }, PRESENCE_POLL_INTERVAL_MS);

    // Poll on tab restore only if it was hidden for a while.
    let hiddenAt: number | null = null;
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        return;
      }
      if (document.visibilityState !== 'visible') return;
      if (hiddenAt) {
        const hiddenFor = Date.now() - hiddenAt;
        hiddenAt = null;
        if (hiddenFor > 0 && hiddenFor < PRESENCE_MIN_HIDDEN_MS_FOR_REFETCH) return;
      }
      pollPresence({ force: true });
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
};

/**
 * Hook to subscribe to real-time updates for a specific user.
 * Useful for user profile popups and other single-user views.
 */
export const useRealtimeSingleUser = (
  userId: string | null | undefined,
  onUpdate: (user: User) => void
) => {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const viewerId = useAuthStore((s) => s.user?.id ?? null);

  useEffect(() => {
    if (!userId || !viewerId) return;

    let mounted = true;

    const fetchUser = async () => {
      const { data, error } = await supabase.rpc('get_user_profile_secure', {
        _target_user_id: userId,
        _requesting_user_id: viewerId,
      });

      if (!mounted || error || !data || typeof data !== 'object') return;
      const updatedUser = data as unknown as User;
      onUpdateRef.current(updatedUser);
      patchUserAcrossStores(updatedUser);
    };

    void fetchUser();

    const intervalId = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void fetchUser();
    }, 45000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchUser();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, viewerId]);
};
