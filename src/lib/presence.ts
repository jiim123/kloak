import type { UserStatus } from '@/types';
import { getAuthoritativeKloakStatus, hasRecentRealtimePresence } from '@/hooks/useRealtimeUsers';
import { isKloakSocketEnabled } from '@/lib/kloakConfig';

// Offline detection threshold for the DB `last_seen` fallback.
// `last_seen` is heartbeated every ~60s while the app is open (see
// useRealtimeUsers), so 5 minutes is a comfortable margin for network/cadence drift.
export const PRESENCE_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface EffectivePresence {
  status: UserStatus;
  /**
   * True when we had to "fix up" the displayed status because the persisted
   * `status`/`last_seen` fields were inconsistent (stale write).
   */
  isStale: boolean;
  isOffline: boolean;
}

/**
 * Compute a reliable "effective" presence from (status, last_seen).
 *
 * - If we have recent realtime presence (kloak-ws `user.presence` events, or the
 *   Supabase Realtime presence channel when kloak-ws is disabled), trust the status
 *   as-is. This is the authoritative path.
 * - Otherwise fall back to the persisted `status` + `last_seen`. `last_seen` is
 *   heartbeated while a user's app is open, so a recent `last_seen` means online and
 *   an old `last_seen` means offline — regardless of a possibly-stale `status`.
 */
export function getEffectivePresence(
  status: UserStatus,
  lastSeen: string | null | undefined,
  userId?: string,
): EffectivePresence {

  // When kloak-ws is the presence transport, the server is the ONLY source of
  // truth. The DB `status` is never updated on disconnect (it stays 'online'
  // forever) and `last_seen` only reflects the last 60s heartbeat, so trusting
  // either would show closed clients as online for up to 5 minutes.
  //
  // The server tells us explicitly who is offline: it publishes an `offline`
  // `user.presence` event on disconnect and its presence snapshot omits
  // disconnected users. So the last status the server reported (live event,
  // snapshot entry, or explicit offline) is authoritative and never expires —
  // unlike the local 180s realtime pin, which expires whenever a peer's tab is
  // backgrounded and its heartbeats pause while its socket stays connected,
  // making two viewers (or one viewer over time) randomly show and hide the
  // same roster. A user the server has never reported on is offline until the
  // snapshot + live events say otherwise.
  if (isKloakSocketEnabled()) {
    const authoritative = userId ? getAuthoritativeKloakStatus(userId) : undefined;
    if (authoritative) {
      return { status: authoritative, isStale: false, isOffline: authoritative === 'offline' };
    }
    // No kloak-ws data yet — default to offline. The status param may carry
    // a stale "online" from the DB (never cleared on disconnect), so we must
    // NOT trust it here. The profile popup gets this right because it reads
    // from the user cache which the realtime layer patches correctly.
    return { status: 'offline', isStale: false, isOffline: true };
  }

  // Supabase Realtime fallback: trust the status as-is when we have recent
  // presence data (the realtime layer patched it into the cache correctly).
  if (userId && hasRecentRealtimePresence(userId)) {
    return { status, isStale: false, isOffline: status === 'offline' };
  }

  if (!lastSeen) {
    return { status, isStale: false, isOffline: status === 'offline' };
  }

  const nowMs = Date.now();
  const lastSeenMs = new Date(lastSeen).getTime();
  const isRecent = Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= PRESENCE_OFFLINE_THRESHOLD_MS;

  // NOTE: we deliberately do NOT flip `offline` → `online` just because
  // `last_seen` is recent. The realtime presence layer already pins an explicit
  // offline signal (socket close, manual invisible, reconnect) as authoritative
  // for RECENT_PRESENCE_WINDOW_MS (~3 min). If we then "rescued" the user via a
  // recent `last_seen`, every user who closed their app would ghost back to
  // "online" between minutes 3–5 after leaving (offline pin expires while
  // `last_seen` is still inside the 5-min window) and then hide again — the
  // member list would randomly show and hide people who aren't online.
  // Connected users keep their realtime presence fresh via heartbeats, so the
  // fallback below only ever runs for users we have genuinely lost track of.

  // `last_seen` is old → the app is no longer open, treat as offline even if the
  // persisted `status` was never updated to offline (e.g. hard browser close).
  if (!isRecent && status !== 'offline') {
    return { status: 'offline', isStale: true, isOffline: true };
  }

  return { status, isStale: false, isOffline: status === 'offline' };
}
