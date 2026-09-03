import { useEffect, useRef } from 'react';
import { supabase, isSupabaseRealtimeDisabled } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import { useUserCacheStore } from '@/stores/userCacheStore';
import { useUIStore } from '@/stores/uiStore';
import { isKloakSocketEnabled, kloakSocket } from '@/lib/kloakSocket';
import type { User, UserStatus } from '@/types';

/**
 * Patches user data across all relevant stores (members, friends, conversations, cached messages).
 * Exported so other components can use it for manual updates.
 */
/**
 * Determines if an update is status/presence-only (no visual identity changes).
 * Status-only updates don't need to patch cached messages since messages don't render status.
 */
const isStatusOnlyUpdate = (updatedUser: Partial<User> & { id: string }): boolean => {
  const keys = Object.keys(updatedUser).filter((k) => k !== 'id');
  return keys.length > 0 && keys.every((k) => k === 'status' || k === 'last_seen' || k === 'custom_status');
};

// ---------------------------------------------------------------------------
// Batched cross-store patching
// ---------------------------------------------------------------------------
// When Presence sync fires with N users, patchUserAcrossStores is called N
// times synchronously. Instead of calling setState on serverStore/friendStore/
// dmStore each time (N × 3 re-renders), we collect patches into Maps and flush
// once per macrotask via setTimeout(fn, 0).

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

// ---------------------------------------------------------------------------

export const patchUserAcrossStores = (updatedUser: Partial<User> & { id: string }) => {
  // Always update the centralized user cache immediately (version bump is batched internally)
  useUserCacheStore.getState().patchUser(updatedUser.id, updatedUser);

  // Batch server member patches — flushed once after all patches in this tick
  pendingMemberPatches.set(updatedUser.id, updatedUser);
  if (!memberPatchTimer) {
    memberPatchTimer = setTimeout(flushMemberPatches, 0);
  }

  // Batch friend patches
  pendingFriendPatches.set(updatedUser.id, updatedUser);
  if (!friendPatchTimer) {
    friendPatchTimer = setTimeout(flushFriendPatches, 0);
  }

  // Batch DM patches
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
// Periodically re-read presenceState() so online/offline stays authoritative even when
// no join/leave events fire (static user sets) and so offline grace transitions complete.
const PRESENCE_HEARTBEAT_MS = 20_000;
// Keeps the DB `last_seen` column fresh while the app is open, so the persisted
// presence fallback (used before the first realtime event and for users who
// disconnected before we connected) can tell online from offline reliably.
const LAST_SEEN_HEARTBEAT_MS = 60_000;

// ---------------------------------------------------------------------------
// Kloak-ws live-presence stabilisation
// ---------------------------------------------------------------------------
// A peer whose socket blips (reconnect, network drop, another session churning)
// produces an "offline" event from the dead socket followed seconds later by an
// "online" event from the fresh socket. Applying the offline instantly is what
// makes members randomly appear/hide in the member list. We therefore hold
// offline signals for a short confirmation window and only hide the user if no
// newer online event arrives first. Connected users keep heartbeating every ~60s
// (and re-publish immediately after reconnect), so a legitimately-online peer
// always cancels the pending hide long before it fires.
const KLOAK_OFFLINE_CONFIRM_MS = 8_000;
const KLOAK_OFFLINE_SWEEP_MS = 2_000;

// Last status we actually applied for a user through the kloak-ws transport.
const kloakAppliedStatusByUser = new Map<string, UserStatus>();
// userId -> { since, confirmMs } for the first (still-unconfirmed) offline signal.
// `confirmMs` is the grace before the offline is applied; it is per-signal so the
// first authoritative snapshot can correct the startup roster immediately while
// live reconnect blips keep the longer grace.
const pendingKloakOfflineByUser = new Map<string, { since: number; confirmMs: number }>();
// Monotonic arrival sequence per user. Live events are FIFO per socket, but the
// presence *snapshot* request/response can interleave with them, so when a
// snapshot was requested we remember where the live stream had gotten and refuse
// to let the (possibly older) snapshot regress anyone whose live state is newer.
const liveEventSeqByUser = new Map<string, number>();
let liveEventSeq = 0;
let offlineConfirmSweepTimer: ReturnType<typeof setInterval> | null = null;

// True once we have applied authoritative realtime presence data at least once
// (first kloak-ws snapshot, first live presence event, or first Supabase
// presence snapshot). Components (e.g. the member sidebar) can wait for this
// before painting presence-dependent UI, so the initial paint is based on the
// authoritative snapshot instead of the stale DB `last_seen` window — which
// would otherwise flash recently-disconnected users as "online" for a moment
// and then hide them.
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
  // Pin the offline as recent realtime presence so the persisted `status`/`last_seen`
  // fallback (which can't distinguish "invisible but connected" from "gone") doesn't
  // override it — exactly like an online event pins online.
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

// Records that a live (non-snapshot) event was handled for a user, so snapshot
// results that raced ahead of the live stream can't regress it.
const recordKloakLiveEvent = (userId: string) => {
  liveEventSeq += 1;
  liveEventSeqByUser.set(userId, liveEventSeq);
};

const hasNewerLiveEventSince = (userId: string, seqAtRequest: number): boolean =>
  (liveEventSeqByUser.get(userId) ?? 0) > seqAtRequest;

// Holds an offline signal for its confirmation window unless the user was already
// confirmed offline (dedupe). During the window a newer online event cancels it.
// `confirmMs` defaults to the live-flap grace; the first bootstrap passes 0 so the
// startup roster is corrected immediately.
const scheduleKloakOffline = (userId: string, confirmMs: number = KLOAK_OFFLINE_CONFIRM_MS) => {
  if (kloakAppliedStatusByUser.get(userId) === 'offline') return;
  const existing = pendingKloakOfflineByUser.get(userId);
  if (existing) {
    // A newer signal with a shorter grace wins (e.g. explicit offline event
    // overriding an earlier snapshot-absence mark).
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
    // Safe-guard: only hide if a newer online event hasn't been applied since
    // (applyKloakPresenceOnline removes the pending entry, but re-check anyway).
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
const handleKloakLivePresence = (payload: unknown) => {
  const meta = getPresenceMeta(payload);
  if (!meta) return;
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
const PRESENCE_BOOTSTRAP_THROTTLE_MS = 30_000;

// Fetches the authoritative "who's online" snapshot from kloak-ws and applies it,
// so a freshly-connected client doesn't have to wait up to a minute for heartbeats
// (or trust stale DB status). Peers absent from the snapshot are queued offline
// (through the same confirmation window as live offline events).
const bootstrapPresenceFromSocket = async (userId: string) => {
  const now = Date.now();
  if (now - lastPresenceBootstrapAt < PRESENCE_BOOTSTRAP_THROTTLE_MS) return;
  if (bootstrapInFlight) return;
  lastPresenceBootstrapAt = now;
  bootstrapInFlight = true;
  // Sequence the live stream had reached when this snapshot was requested. The
  // snapshot response can arrive *after* newer live events (they travel on the
  // same socket, so ordering is FIFO, but the snapshot content was generated
  // earlier) — anything newer than the request must not be regressed by it.
  const seqAtRequest = liveEventSeq;
  // The very first snapshot of a session is the authoritative startup truth: the
  // member list has been painted from the DB `last_seen` window (which over-claims
  // "online" for anyone who disconnected within the last 5 minutes). Correcting
  // those rows immediately — before the list is shown — prevents members from
  // flashing "online" for ~10s and then vanishing.
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
      // Ignore snapshot rows whose presence is older than the live window (e.g.
      // a peer whose heartbeats stopped long ago but whose socket lingers).
      const ts = typeof meta.ts === 'number' ? meta.ts : 0;
      if (ts > 0 && Date.now() - ts > RECENT_PRESENCE_WINDOW_MS) continue;
      applyKloakPresenceOnline(meta, status);
    }

    if (isFirstBootstrap && entries.length === 0) {
      // An empty snapshot on first load is almost always a hiccup (e.g. the
      // recipients lookup failing, or the peer set not yet loaded). Marking
      // everyone offline would blank the whole member list; leave the DB view up
      // and let live heartbeats fill in the truth.
      markPresenceReady();
      return;
    }

    for (const targetId of collectPresenceTargetUserIds()) {
      if (targetId === userId || onlineIds.has(targetId)) continue;
      if (hasNewerLiveEventSince(targetId, seqAtRequest)) continue;
      scheduleKloakOffline(targetId, isFirstBootstrap ? 0 : KLOAK_OFFLINE_CONFIRM_MS);
    }

    if (isFirstBootstrap) {
      // Apply the first snapshot's corrections now (confirmMs 0) so the member
      // list paints with authoritative presence, then announce readiness.
      sweepKloakOfflineConfirms();
      markPresenceReady();
    }
  } catch {
    // Snapshot is best-effort: heartbeats + the last_seen fallback cover failures.
    markPresenceReady();
  } finally {
    bootstrapInFlight = false;
  }
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

    // ─── Kloak WS self-presence: publish own status, receive own events from other sessions ───
    let kloakUnsubscribe: (() => void) | null = null;
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

      void kloakSocket
        .subscribe(`user:${userId}`, (event) => {
          if (event.event === 'user.presence') handleKloakLivePresence(event.payload);
        })
        .then((fn) => {
          kloakUnsubscribe = fn;
          publishOwnSocketPresence();
          void bootstrapPresenceFromSocket(userId);
        })
        .catch(() => undefined);

      // Re-publish our presence as soon as the socket is (re)established. Without
      // this, a reconnect leaves us absent from the server's live presence until
      // the next 60s heartbeat — our peers see us blink offline for up to a minute
      // on every socket drop.
      kloakUnsubReconnect = kloakSocket.onReconnect(() => {
        publishOwnSocketPresence();
        void bootstrapPresenceFromSocket(userId);
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

    // ─── Supabase Realtime Presence — only when Realtime is enabled AND kloak-ws
    // is not in use. When Realtime is disabled (production uses kloak-ws),
    // supabase.channel() is a stub that reports CLOSED immediately; setting the
    // channel up anyway would spin an infinite reconnect loop that repeatedly
    // clears `recentRealtimePresenceByUser` and fights the kloak-ws presence path.
    // The two transports must never run together: they don't share the same
    // roster of tracked users, so they'd mark each other's users offline and make
    // members randomly show/hide. kloak-ws is the authoritative transport when
    // enabled; Supabase Realtime presence is the fallback for builds without it.
    let teardownPresence: (() => void) | null = null;

    if (!isSupabaseRealtimeDisabled() && !isKloakSocketEnabled()) {
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
        // First realtime presence application → announce readiness (see
        // isPresenceReady / subscribePresenceReady).
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

      // Already connected but we may have been hidden/offline for a while:
      // re-read presenceState() so any drift is reconciled immediately.
      applyPresenceRef.current?.();
    };
    window.addEventListener('online', handleConnectivity);
    document.addEventListener('visibilitychange', handleConnectivity);

    // Heartbeat: keep the presence snapshot fresh while the tab is visible.
    // Supabase only emits sync/join/leave events on changes, so without this a
    // static roster of online users would eventually lose its "recent realtime
    // presence" signal and fall back to the persisted last_seen heuristic.
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

    return () => {
      clearInterval(lastSeenHeartbeat);
      kloakUnsubscribe?.();
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

