import type { UserStatus } from '@/types';

// Keep this aligned with UX expectations in the app (Members list uses 5 minutes today).
export const PRESENCE_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface EffectivePresence {
  status: UserStatus;
  /**
   * True when we had to "fix up" the displayed status because DB fields are inconsistent.
   * Example: status === 'offline' but last_seen is recent → treat as online (stale).
   */
  isStale: boolean;
  isOffline: boolean;
}

/**
 * Compute a reliable "effective" presence from (status, last_seen).
 *
 * Why:
 * - Realtime delivery can be lossy; status updates may be missed.
 * - last_seen heartbeats are more robust and should prevent "stuck offline while active".
 * - We still preserve manual "Invisible" (status === 'offline') by allowing callers
 *   to stop heartbeats while invisible.
 */
export function getEffectivePresence(
  status: UserStatus,
  lastSeen: string | null | undefined,
  nowMs: number = Date.now()
): EffectivePresence {
  if (!lastSeen) {
    return { status, isStale: false, isOffline: status === 'offline' };
  }

  const lastSeenMs = new Date(lastSeen).getTime();
  const isRecent = Number.isFinite(lastSeenMs) && nowMs - lastSeenMs <= PRESENCE_OFFLINE_THRESHOLD_MS;

  // If last_seen is recent, but status says offline, treat as online (status likely stale).
  if (status === 'offline' && isRecent) {
    return { status: 'online', isStale: true, isOffline: false };
  }

  // If last_seen is old, treat as offline even if status says otherwise.
  if (!isRecent && status !== 'offline') {
    return { status: 'offline', isStale: true, isOffline: true };
  }

  return { status, isStale: false, isOffline: status === 'offline' };
}

