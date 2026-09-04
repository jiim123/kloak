import { useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseRealtimeDisabled } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import { useUserCacheStore } from '@/stores/userCacheStore';
import { useUIStore } from '@/stores/uiStore';
import { isKloakSocketEnabled, kloakSocket } from '@/lib/kloakSocket';
import type { User, UserStatus } from '@/types';

/** Patch changes to other users' conversations (DM sidebar + chat area render presence). */
const isStatusOnlyUpdate = (updatedUser: Partial<User> & { id: string }): boolean => {
  const keys = Object.keys(updatedUser).filter((k) => k !== 'id');
  return keys.length > 0 && keys.every((k) => k === 'status' || k === 'last_seen' || k === 'custom_status');
};

// ---------------------------------------------------------------------------
// Batched cross-store patching (unchanged — flushes once per macrotask)
// ---------------------------------------------------------------------------
let pendingMemberPatches = new Map<string, Partial<User>>();
let memberPatchTimer: ReturnType<typeof setTimeout> | null = null;

const flushMemberPatches = () => {
  memberPatchTimer = null;
  const patches = pendingMemberPatches;
  pendingMemberPatches = new Map();
  if (patches.size === 0) return;

  useServerStore.setState((state) => {
    if (state.members.length === 0) return {};
    let changed = false;
    const members = state.members.map((m) => {
      const patch = patches.get(m.user_id);
      if (!patch) return m;
      changed = true;
      return { ...m, user: m.user ? { ...m.user, ...patch } : (patch as User) };
    });
    return changed ? { members } : {};
  });
};

let pendingFriendPatches = new Map<string, Partial<User>>();
let friendPatchTimer: ReturnType<typeof setTimeout> | null = null;

const flushFriendPatches = () => {
  friendPatchTimer = null;
  const patches = pendingFriendPatches;
  pendingFriendPatches = new Map();
  if (patches.size === 0) return;

  useFriendStore.setState((state) => {
    type HasId = { id: string };
    const patchList = <T extends HasId>(list: T[]): { list: T[]; changed: boolean } => {
      let changed = false;
      const next = list.map((item) => {
        const p = patches.get(item.id);
        if (!p) return item;
        changed = true;
        return { ...item, ...p } as T;
      });
      return changed ? { list: next, changed } : { list, changed: false };
    };

    const friends = patchList(state.friends);
    const pendingRequests = patchList(state.pendingRequests);
    const outgoingRequests = patchList(state.outgoingRequests);
    const blockedUsers = patchList(state.blockedUsers);

    if (!friends.changed && !pendingRequests.changed && !outgoingRequests.changed && !blockedUsers.changed) return {};
    return {
      friends: friends.list,
      pendingRequests: pendingRequests.list,
      outgoingRequests: outgoingRequests.list,
      blockedUsers: blockedUsers.list,
    };
  });
};

let pendingDMPatches = new Map<string, Partial<User>>();
let dmPatchTimer: ReturnType<typeof setTimeout> | null = null;

const flushDMPatches = () => {
  dmPatchTimer = null;
  const patches = pendingDMPatches;
  pendingDMPatches = new Map();
  if (patches.size === 0) return;

  useDMStore.setState((state) => {
    if (state.conversations.length === 0 && !state.currentConversation) return {};
    let changed = false;

    const conversations = state.conversations.map((c) => {
      let conversationChanged = false;
      let nextConversation = c;

      const otherPatch = c.other_user?.id ? patches.get(c.other_user.id) : undefined;
      if (otherPatch) {
        conversationChanged = true;
        nextConversation = { ...nextConversation, other_user: { ...c.other_user, ...otherPatch } };
      }

      if (Array.isArray(c.participants) && c.participants.length > 0) {
        let participantsChanged = false;
        const participants = c.participants.map((p) => {
          const pPatch = p.user_id ? patches.get(p.user_id) : undefined;
          if (!pPatch || !p.user) return p;
          participantsChanged = true;
          return { ...p, user: { ...p.user, ...pPatch } };
        });
        if (participantsChanged) {
          conversationChanged = true;
          nextConversation = { ...nextConversation, participants };
        }
      }

      if (conversationChanged) changed = true;
      return nextConversation;
    });

    let currentConversation = state.currentConversation;
    if (state.currentConversation) {
      let currentChanged = false;
      let nextCurrent = state.currentConversation;

      const otherPatch = state.currentConversation.other_user?.id
        ? patches.get(state.currentConversation.other_user.id)
        : undefined;
      if (otherPatch) {
        currentChanged = true;
        nextCurrent = { ...nextCurrent, other_user: { ...state.currentConversation.other_user, ...otherPatch } };
      }

      if (Array.isArray(state.currentConversation.participants)) {
        let participantsChanged = false;
        const participants = state.currentConversation.participants.map((p) => {
          const pPatch = p.user_id ? patches.get(p.user_id) : undefined;
          if (!pPatch || !p.user) return p;
          participantsChanged = true;
          return { ...p, user: { ...p.user, ...pPatch } };
        });
        if (participantsChanged) {
          currentChanged = true;
          nextCurrent = { ...nextCurrent, participants };
        }
      }

      if (currentChanged) {
        changed = true;
        currentConversation = nextCurrent;
      }
    }

    return changed || currentConversation !== state.currentConversation
      ? { conversations, currentConversation }
      : {};
  });
};

export const patchUserAcrossStores = (updatedUser: Partial<User> & { id: string }) => {
  useUserCacheStore.getState().patchUser(updatedUser.id, updatedUser);

  pendingMemberPatches.set(updatedUser.id, updatedUser);
  if (!memberPatchTimer) {
    memberPatchTimer = setTimeout(flushMemberPatches, 0);
  }

  pendingFriendPatches.set(updatedUser.id, updatedUser);
  if (!friendPatchTimer) {
    friendPatchTimer = setTimeout(flushFriendPatches, 0);
  }

  pendingDMPatches.set(updatedUser.id, updatedUser);
  if (!dmPatchTimer) {
    dmPatchTimer = setTimeout(flushDMPatches, 0);
  }
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

const GLOBAL_USERS_PRESENCE_TOPIC = 'presence:users-global';
const PRESENCE_ABSENT_GRACE_MS = 30_000;
const RECENT_PRESENCE_WINDOW_MS = 180_000;
const TARGET_CHANGE_APPLY_DEBOUNCE_MS = 120;
const PRESENCE_HEARTBEAT_MS = 20_000;
const LAST_SEEN_HEARTBEAT_MS = 60_000;

// ---------------------------------------------------------------------------
// Kloak-ws live-presence stabilisation (unchanged)
// ---------------------------------------------------------------------------
const KLOAK_OFFLINE_CONFIRM_MS = 4_000;
const KLOAK_OFFLINE_SWEEP_MS = 2_000;

const kloakAppliedStatusByUser = new Map<string, UserStatus>();

/**
 * Last status the kloak-ws server told us about a user (live `user.presence`
 * events, presence snapshot entries, or an explicit offline signal). With
 * kloak-ws the server is the authority: it publishes `offline` on disconnect
 * and its snapshot reconciles absence, so this map is the source of truth for
 * the UI — it must NOT be gated behind the 180s `recentRealtimePresence` pin.
 * That pin (a Supabase-Realtime-era heuristic) expires whenever a peer's tab is
 * backgrounded and its heartbeats pause, even though its socket stays connected
 * and the server still reports it online — which made the member list randomly
 * show and hide people on each viewer's own timer.
 */
export const getAuthoritativeKloakStatus = (userId: string): UserStatus | undefined =>
  kloakAppliedStatusByUser.get(userId);

const pendingKloakOfflineByUser = new Map<string, { since: number; confirmMs: number }>();
const liveEventSeqByUser = new Map<string, number>();
let liveEventSeq = 0;
let offlineConfirmSweepTimer: ReturnType<typeof setInterval> | null = null;

let presenceReady = false;
const presenceReadyListeners = new Set<() => void>();
let presenceBootstrapDoneOnce = false;

export const isPresenceReady = (): boolean => presenceReady;

export const subscribePresenceReady = (listener: () => void): (() => void) => {
  presenceReadyListeners.add(listener);
  return () => {
    presenceReadyListeners.delete(listener);
  };
};

const markPresenceReady = () => {
  if (presenceReady) return;
  presenceReady = true;
  const listeners = Array.from(presenceReadyListeners);
  presenceReadyListeners.clear();
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // listener errors must not break presence processing
    }
  }
};

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
  const { conversations, currentConversation } = useDMStore.getState();
  const { members } = useServerStore.getState();
  const { activeModal, modalData } = useUIStore.getState();
  const userIds = new Set<string>();
  friends.forEach((f) => userIds.add(f.id));
  conversations.forEach((c) => {
    if (c.other_user?.id) userIds.add(c.other_user.id);
    c.participants?.forEach((p) => {
      if (p.user_id) userIds.add(p.user_id);
    });
  });
  if (currentConversation?.other_user?.id) userIds.add(currentConversation.other_user.id);
  currentConversation?.participants?.forEach((p) => {
    if (p.user_id) userIds.add(p.user_id);
  });
  members.forEach((member) => userIds.add(member.user_id));
  if (activeModal === 'userProfile' && typeof modalData?.userId === 'string') {
    userIds.add(modalData.userId);
  }
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
    last_seen: new Date().toISOString(),
    ts: Date.now(),
  };
};

const publishOwnSocketPresence = () => {
  const payload = buildOwnPresencePayload();
  if (!payload) return;
  recentRealtimePresenceByUser.set(payload.user_id, Date.now());
  patchUserAcrossStores({
    id: payload.user_id,
    status: toUserStatus(payload.status, 'online'),
    custom_status: payload.custom_status ?? null,
    last_seen: payload.last_seen ?? new Date().toISOString(),
  });
  void kloakSocket
    .updatePresence({
      status: toUserStatus(payload.status, 'online'),
      customStatus: payload.custom_status ?? null,
      lastSeen: payload.last_seen ?? new Date().toISOString(),
      ts: typeof payload.ts === 'number' ? payload.ts : Date.now(),
    })
    .catch(() => undefined);
};

const getPresenceMeta = (payload: unknown): (GlobalPresenceMeta & { user_id: string }) | null => {
  const meta = payload as GlobalPresenceMeta | null;
  if (!meta || typeof meta.user_id !== 'string' || meta.user_id.length === 0) return null;
  return meta as GlobalPresenceMeta & { user_id: string };
};

const applyKloakPresenceOffline = (userId: string) => {
  kloakAppliedStatusByUser.set(userId, 'offline');
  recentRealtimePresenceByUser.set(userId, Date.now());
  patchUserAcrossStores({ id: userId, status: 'offline' });
};

const applyKloakPresenceOnline = (meta: GlobalPresenceMeta & { user_id: string }, status: UserStatus) => {
  const { user_id: userId } = meta;
  pendingKloakOfflineByUser.delete(userId);
  kloakAppliedStatusByUser.set(userId, status);
  recentRealtimePresenceByUser.set(userId, Date.now());
  patchUserAcrossStores({
    id: userId,
    status,
    custom_status: meta.custom_status ?? null,
    last_seen: meta.last_seen ?? null,
  });
};

const recordKloakLiveEvent = (userId: string) => {
  liveEventSeq += 1;
  liveEventSeqByUser.set(userId, liveEventSeq);
};

const hasNewerLiveEventSince = (userId: string, seqAtRequest: number): boolean =>
  (liveEventSeqByUser.get(userId) ?? 0) > seqAtRequest;

const scheduleKloakOffline = (userId: string, confirmMs: number = KLOAK_OFFLINE_CONFIRM_MS) => {
  if (kloakAppliedStatusByUser.get(userId) === 'offline') return;
  const existing = pendingKloakOfflineByUser.get(userId);
  if (existing) {
    if (confirmMs < existing.confirmMs) {
      pendingKloakOfflineByUser.set(userId, { since: Date.now(), confirmMs });
    }
    return;
  }
  pendingKloakOfflineByUser.set(userId, { since: Date.now(), confirmMs });
};

const sweepKloakOfflineConfirms = () => {
  if (pendingKloakOfflineByUser.size === 0) return;
  const now = Date.now();
  for (const [userId, entry] of Array.from(pendingKloakOfflineByUser.entries())) {
    if (now - entry.since < entry.confirmMs) continue;
    pendingKloakOfflineByUser.delete(userId);
    if (kloakAppliedStatusByUser.get(userId) !== 'offline') {
      applyKloakPresenceOffline(userId);
    }
  }
};

const ensureKloakOfflineSweep = () => {
  if (offlineConfirmSweepTimer) return;
  offlineConfirmSweepTimer = setInterval(sweepKloakOfflineConfirms, KLOAK_OFFLINE_SWEEP_MS);
};

const stopKloakOfflineSweep = () => {
  if (offlineConfirmSweepTimer) {
    clearInterval(offlineConfirmSweepTimer);
    offlineConfirmSweepTimer = null;
  }
};

// Handles a live `user.presence` event pushed by kloak-ws (FIFO per socket).
// The kloak-ws server publishes presence to BOTH `user:{sender}` and
// `user:{recipient}` for every presence recipient, so other users' status
// changes arrive live — no need to wait for the snapshot + confirmation window.
// Debug aid: last time we heard our OWN presence echoed back on `user:{self}`
// (the server republishes every update_presence to the sender's own topic). If
// this never updates, our presence updates are not reaching the kloak-ws
// server.
let debugSelfPresenceEchoAt = 0;

export const getSelfPresenceEchoAgeMs = (): number | null =>
  debugSelfPresenceEchoAt === 0 ? null : Date.now() - debugSelfPresenceEchoAt;

const handleKloakLivePresence = (payload: unknown) => {
  const meta = getPresenceMeta(payload);
  if (!meta) return;
  if (meta.user_id === useAuthStore.getState().user?.id) {
    debugSelfPresenceEchoAt = Date.now();
  }
  const status = toUserStatus(meta.status, 'online');
  const ts = typeof meta.ts === 'number' ? meta.ts : 0;
  // Ignore stale online signals (e.g. replayed events older than the live window).
  if (status !== 'offline' && ts > 0 && Date.now() - ts > RECENT_PRESENCE_WINDOW_MS) return;

  recordKloakLiveEvent(meta.user_id);
  markPresenceReady();

  if (status === 'offline') {
    // Our own presence decisions (manual status, our other session publishing) are
    // authoritative and originate locally — apply them immediately.
    if (meta.user_id === useAuthStore.getState().user?.id) {
      pendingKloakOfflineByUser.delete(meta.user_id);
      applyKloakPresenceOffline(meta.user_id);
      return;
    }
    scheduleKloakOffline(meta.user_id);
    return;
  }

  applyKloakPresenceOnline(meta, status);
};

const clearKloakPresenceBookkeeping = () => {
  kloakAppliedStatusByUser.clear();
  pendingKloakOfflineByUser.clear();
  liveEventSeqByUser.clear();
  liveEventSeq = 0;
  presenceReady = false;
  presenceBootstrapDoneOnce = false;
  stopKloakOfflineSweep();
};

let lastPresenceBootstrapAt = 0;
let bootstrapInFlight = false;
let bootstrapRerunRequested = false;
const PRESENCE_BOOTSTRAP_THROTTLE_MS = 30_000;

const bootstrapPresenceFromSocket = async (userId: string, opts?: { force?: boolean }) => {
  const now = Date.now();
  if (!opts?.force && now - lastPresenceBootstrapAt < PRESENCE_BOOTSTRAP_THROTTLE_MS) return;
  // If a bootstrap is already in flight (e.g. the first one at connect is still
  // running when DMs load), remember that a newer snapshot was requested so the
  // tracked-set growth is not silently dropped — re-run right after it finishes.
  if (bootstrapInFlight) {
    bootstrapRerunRequested = true;
    return;
  }
  lastPresenceBootstrapAt = now;
  bootstrapInFlight = true;
  const seqAtRequest = liveEventSeq;
  const isFirstBootstrap = !presenceBootstrapDoneOnce;
  presenceBootstrapDoneOnce = true;

  try {
    const entries = (await kloakSocket.getPresenceSnapshot()) as GlobalPresenceMeta[];
    if (!Array.isArray(entries)) return;

    const onlineIds = new Set<string>();
    for (const entry of entries) {
      const meta = getPresenceMeta(entry);
      if (!meta || meta.user_id === userId) continue;
      onlineIds.add(meta.user_id);
      if (hasNewerLiveEventSince(meta.user_id, seqAtRequest)) continue;
      const status = toUserStatus(meta.status, 'online');
      if (status === 'offline') continue;
      const ts = typeof meta.ts === 'number' ? meta.ts : 0;
      if (ts > 0 && Date.now() - ts > RECENT_PRESENCE_WINDOW_MS) continue;
      // Periodic re-syncs re-apply the same status every 30s — skip when the
      // roster already reflects this exact state so stores don't churn / the
      // member list doesn't re-render on every reconcile. The applied-status
      // map is authoritative and never expires, so this dedupe is safe: a user
      // whose events pause (backgrounded tab) keeps their last known server
      // status until the server itself says otherwise (offline event, or
      // absence from a later snapshot).
      if (kloakAppliedStatusByUser.get(meta.user_id) === status) continue;
      applyKloakPresenceOnline(meta, status);
    }

    // An empty snapshot is almost always a hiccup (peer set not yet loaded or
    // recipients lookup failing). Marking everyone offline would blank the whole
    // member list; leave the DB view up and let live heartbeats fill in the truth.
    if (entries.length === 0) {
      markPresenceReady();
      return;
    }

    const targets = collectPresenceTargetUserIds();
    for (const targetId of targets) {
      if (targetId === userId || onlineIds.has(targetId)) continue;
      if (hasNewerLiveEventSince(targetId, seqAtRequest)) continue;
      // First impression (never applied a status yet) → correct immediately.
      // Previously-seen users get the reconnect-blip confirmation window.
      const firstImpression = !kloakAppliedStatusByUser.has(targetId);
      scheduleKloakOffline(targetId, firstImpression || isFirstBootstrap ? 0 : KLOAK_OFFLINE_CONFIRM_MS);
    }

    if (isFirstBootstrap || opts?.force) {
      // Apply immediate corrections now (confirmMs 0) so the UI paints with
      // authoritative presence instead of flashing "online" for a few seconds.
      sweepKloakOfflineConfirms();
    }

    markPresenceReady();
  } catch {
    markPresenceReady();
  } finally {
    bootstrapInFlight = false;
    if (bootstrapRerunRequested) {
      bootstrapRerunRequested = false;
      void bootstrapPresenceFromSocket(userId, { force: true });
    }
  }
};

export const useRealtimeUsers = () => {
  const authUser = useAuthStore((s) => s.user);
  const manualStatus = useAuthStore((s) => s.manualStatus);
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
      clearKloakPresenceBookkeeping();
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

    // ─── Kloak WS self-presence: publish own status ───
    let kloakUnsubscribeSelf: (() => void) | null = null;
    let kloakUnsubReconnect: (() => void) | null = null;
    let kloakHeartbeat: ReturnType<typeof setInterval> | null = null;
    let kloakHandleRecovery: (() => void) | null = null;

    if (isKloakSocketEnabled()) {
      kloakHeartbeat = setInterval(publishOwnSocketPresence, 60_000);

      kloakHandleRecovery = () => {
        if (document.visibilityState !== 'visible') return;
        publishOwnSocketPresence();
        void bootstrapPresenceFromSocket(userId);
      };

      // Subscribe to our OWN topic. The kloak-ws server fans out `user.presence`
      // events for every presence recipient (server members, friends, DM
      // participants) to the recipient's own topic, so this single subscription
      // delivers live presence for everyone we care about. (Subscribing to
      // `user:{otherId}` is rejected server-side and unnecessary.)
      void kloakSocket
        .subscribe(`user:${userId}`, (event) => {
          if (event.event === 'user.presence') handleKloakLivePresence(event.payload);
        })
        .then((fn) => {
          kloakUnsubscribeSelf = fn;
          publishOwnSocketPresence();
          void bootstrapPresenceFromSocket(userId);
        })
        .catch(() => undefined);

      // Re-publish our presence as soon as the socket is (re)established.
      kloakUnsubReconnect = kloakSocket.onReconnect(() => {
        publishOwnSocketPresence();
        void bootstrapPresenceFromSocket(userId, { force: true });
      });

      ensureKloakOfflineSweep();

      window.addEventListener('online', kloakHandleRecovery);
      document.addEventListener('visibilitychange', kloakHandleRecovery);
    }

    // ─── DB `last_seen` heartbeat (runs regardless of presence transport) ───
    const lastSeenHeartbeat = setInterval(() => {
      const { user, manualStatus } = useAuthStore.getState();
      if (!user) return;
      if (user.status === 'offline' || manualStatus === 'offline') return;
      void useAuthStore.getState().updateLastSeen();
    }, LAST_SEEN_HEARTBEAT_MS);

    // ─── Supabase Realtime Presence (fallback when kloak-ws is disabled) ───
    let teardownPresence: (() => void) | null = null;

    if (!isSupabaseRealtimeDisabled() && !isKloakSocketEnabled()) {
      // ... [existing Supabase Realtime presence code unchanged] ...
      const presenceSigByUser = presenceSigByUserRef.current;
      const absenceStartedAtByUser = absenceStartedAtByUserRef.current;

      let activeChannel: ReturnType<typeof supabase.channel> | null = null;
      let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
      let reconnectAttempts = 0;
      let teardown: (() => void) | null = null;
      let storeSubTimer: ReturnType<typeof setTimeout> | null = null;
      let lastTargetIdsKey = collectPresenceTargetUserIds().slice().sort().join(',');
      let lastTargetIdsSet = new Set(collectPresenceTargetUserIds());

      const scheduleReconnect = () => {
        if (reconnectTimer) return;
        const delay = Math.min(10_000, 500 * 2 ** Math.min(reconnectAttempts, 5));
        reconnectAttempts += 1;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          try {
            teardown?.();
          } catch {
            // ignore
          }
          presenceSigByUser.clear();
          absenceStartedAtByUser.clear();
          recentRealtimePresenceByUser.clear();
          setupChannel();
        }, delay);
      };

      const setupChannel = () => {
        const channel = supabase.channel(GLOBAL_USERS_PRESENCE_TOPIC, {
          config: { presence: { key: `${userId}:${tabIdRef.current}` } },
        });
        activeChannel = channel;
        presenceChannelRef.current = channel;

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
            if (targetId === userId) return;

            const meta = latestByUser.get(targetId);
            if (!meta) {
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
          markPresenceReady();
        };

        applyPresenceRef.current = applyPresenceSnapshot;

        channel
          .on('presence', { event: 'sync' }, applyPresenceSnapshot)
          .on('presence', { event: 'join' }, applyPresenceSnapshot)
          .on('presence', { event: 'leave' }, applyPresenceSnapshot)
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              presenceConnectedRef.current = true;
              reconnectAttempts = 0;
              const payload = buildOwnPresencePayload();
              if (payload) {
                void channel.track(payload).catch(() => undefined);
              }
              applyPresenceSnapshot();
              return;
            }

            if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              presenceConnectedRef.current = false;
              scheduleReconnect();
            }
          });

        teardown = () => {
          presenceConnectedRef.current = false;
          if (presenceChannelRef.current === channel) {
            presenceChannelRef.current = null;
          }
          if (applyPresenceRef.current === applyPresenceSnapshot) {
            applyPresenceRef.current = null;
          }
          try {
            void channel.untrack();
            supabase.removeChannel(channel);
          } catch {
            // ignore cleanup errors
          }
          activeChannel = null;
        };
      };

      const throttledApply = () => {
        if (storeSubTimer) return;
        storeSubTimer = setTimeout(() => {
          storeSubTimer = null;
          const currentIds = collectPresenceTargetUserIds();
          const currentKey = currentIds.slice().sort().join(',');
          if (currentKey === lastTargetIdsKey) return;

          for (const id of currentIds) {
            if (!lastTargetIdsSet.has(id)) {
              presenceSigByUser.delete(id);
              absenceStartedAtByUser.delete(id);
            }
          }

          lastTargetIdsKey = currentKey;
          lastTargetIdsSet = new Set(currentIds);
          applyPresenceRef.current?.();
        }, TARGET_CHANGE_APPLY_DEBOUNCE_MS);
      };
      const unsubFriends = useFriendStore.subscribe(throttledApply);
      const unsubDMs = useDMStore.subscribe(throttledApply);
      const unsubServer = useServerStore.subscribe(throttledApply);
      const unsubUI = useUIStore.subscribe(throttledApply);

      const handleConnectivity = () => {
        if (document.visibilityState !== 'visible') return;
        if (!presenceConnectedRef.current) {
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
          reconnectAttempts = 0;
          try {
            teardown?.();
          } catch {
            // ignore
          }
          presenceSigByUser.clear();
          absenceStartedAtByUser.clear();
          recentRealtimePresenceByUser.clear();
          setupChannel();
          return;
        }

        applyPresenceRef.current?.();
      };
      window.addEventListener('online', handleConnectivity);
      document.addEventListener('visibilitychange', handleConnectivity);

      const presenceHeartbeat = setInterval(() => {
        if (document.visibilityState !== 'visible') return;
        if (!presenceConnectedRef.current) return;
        applyPresenceRef.current?.();
      }, PRESENCE_HEARTBEAT_MS);

      setupChannel();

      teardownPresence = () => {
        clearInterval(presenceHeartbeat);
        unsubFriends();
        unsubDMs();
        unsubServer();
        unsubUI();
        if (storeSubTimer) clearTimeout(storeSubTimer);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        window.removeEventListener('online', handleConnectivity);
        document.removeEventListener('visibilitychange', handleConnectivity);
        try {
          teardown?.();
        } catch {
          // ignore
        }
        presenceSigByUser.clear();
        absenceStartedAtByUser.clear();
      };
    }

    // ─── Kloak-ws: keep the authoritative snapshot fresh as the tracked set
    // grows ───
    // The presence snapshot is the authoritative "who's online" roster. Live
    // `user.presence` events (fanned out to our own topic) handle changes, but a
    // user who was offline before we connected never emits an event. The snapshot
    // marks them offline — but it only runs once at connect, before DMs/friends
    // have loaded, so those users are never corrected. Re-run the snapshot
    // whenever the tracked set changes so every new user gets their correct
    // online/offline state (Discord-style: authoritative roster + live events).
    let lastSyncTargetIdsKey = '';
    const syncKloakPresenceTargets = (currentUserId: string) => {
      if (!isKloakSocketEnabled()) return;
      const currentIds = collectPresenceTargetUserIds();
      const key = currentIds.slice().sort().join(',');
      if (key === lastSyncTargetIdsKey) return;
      lastSyncTargetIdsKey = key;
      // New users entered the tracked set — re-run the authoritative snapshot
      // (force bypasses the 30s throttle) so they get corrected immediately.
      void bootstrapPresenceFromSocket(currentUserId, { force: true });
    };

    // Initial sync after mount — wait a tick for stores to populate
    const initialSyncTimer = setTimeout(() => {
      syncKloakPresenceTargets(userId);
    }, 150);

    // Re-sync when the tracked user set changes (friends, DMs, server members, modals)
    const unsubFriendsSync = useFriendStore.subscribe(() => syncKloakPresenceTargets(userId));
    const unsubDMsSync = useDMStore.subscribe(() => syncKloakPresenceTargets(userId));
    const unsubServerSync = useServerStore.subscribe(() => syncKloakPresenceTargets(userId));
    const unsubUISync = useUIStore.subscribe(() => syncKloakPresenceTargets(userId));

    // Periodic authoritative reconciliation — re-run the presence snapshot
    // every 30s REGARDLESS of whether the tracked set changed. Live `user.presence`
    // events handle normal changes, but a client that missed events (socket blip,
    // transient recipient-RPC failure, event arriving during reconnect) would
    // otherwise keep a wrong roster forever: the snapshot only re-ran on set
    // growth, and two viewers running independent schedules stayed diverged.
    // The snapshot's confirm window prevents flapping (already-offline users are
    // not re-scheduled; genuinely-online users re-apply the same status, which
    // the skip-guard above dedupes).
    const periodicSyncTimer = setInterval(() => {
      if (!isKloakSocketEnabled()) return;
      void bootstrapPresenceFromSocket(userId, { force: true });
    }, 30_000);

    return () => {
      clearTimeout(initialSyncTimer);
      clearInterval(periodicSyncTimer);
      unsubFriendsSync();
      unsubDMsSync();
      unsubServerSync();
      unsubUISync();

      clearInterval(lastSeenHeartbeat);
      kloakUnsubscribeSelf?.();
      kloakUnsubReconnect?.();
      if (kloakHeartbeat) clearInterval(kloakHeartbeat);
      if (kloakHandleRecovery) {
        window.removeEventListener('online', kloakHandleRecovery);
        document.removeEventListener('visibilitychange', kloakHandleRecovery);
      }
      teardownPresence?.();
      clearKloakPresenceBookkeeping();
      recentRealtimePresenceByUser.clear();
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser?.id) return;

    if (isKloakSocketEnabled()) {
      publishOwnSocketPresence();
    }

    const channel = presenceChannelRef.current;
    if (!channel || !presenceConnectedRef.current) return;
    const payload = buildOwnPresencePayload();
    if (!payload) return;
    void channel.track(payload).catch(() => undefined);
  }, [authUser?.id, authUser?.status, authUser?.custom_status, authUser?.last_seen, manualStatus]);
};

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
      // The profile RPC carries the DB-default `status` ('online'), which is never
      // updated when a user disconnects. Patching it into the stores would
      // overwrite the correct realtime presence — strip it when kloak-ws is the
      // presence transport (the realtime layer remains the sole writer of status).
      if (isKloakSocketEnabled()) {
        const { status: _s, last_seen: _ls, ...rest } = updatedUser as any;
        patchUserAcrossStores(rest as User);
      } else {
        patchUserAcrossStores(updatedUser);
      }
    };

    void fetchUser();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchUser();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userId, viewerId]);
};
