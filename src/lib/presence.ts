import type { UserStatus } from '@/types';
import { hasRecentRealtimePresence } from '@/hooks/useRealtimeUsers';

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
  // If we have recent real-time Presence data for this user,
  // trust the status as-is without last_seen override.
  if (userId && hasRecentRealtimePresence(userId)) {
    return { status, isStale: false, isOffline: status === 'offline' };
  }

  if (!lastSeen) {
    return { status, isStale: false, isOffline: status === 'offline' };
  }

  const nowMs = Date.now();
  const lastSeenMs = new Date(lastSeen).getTime();
  const isRecent = Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= PRESENCE_OFFLINE_THRESHOLD_MS;

  // `status` says offline but the app heartbeat is recent → the "offline" write is
  // stale; the user is actually online.
  if (status === 'offline' && isRecent) {
    return { status: 'online', isStale: true, isOffline: false };
  }

  // `last_seen` is old → the app is no longer open, treat as offline even if the
  // persisted `status` was never updated to offline (e.g. hard browser close).
  if (!isRecent && status !== 'offline') {
    return { status: 'offline', isStale: true, isOffline: true };
  }

  return { status, isStale: false, isOffline: status === 'offline' };
}
