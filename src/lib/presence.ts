import type { UserStatus } from '@/types';
import { hasRecentRealtimePresence } from '@/hooks/useRealtimeUsers';

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
 * When a userId is provided and we have recent real-time Presence channel data
 * for that user, we trust the status as-is and skip last_seen heuristics.
 * This prevents stale DB data from overriding accurate Presence channel status.
 */
export function getEffectivePresence(
  status: UserStatus,
  lastSeen: string | null | undefined,
  userId?: string,
): EffectivePresence {
  // If we have recent real-time Presence data for this user,
  // trust the status as-is without last_seen override
  if (userId && hasRecentRealtimePresence(userId)) {
    return { status, isStale: false, isOffline: status === 'offline' };
  }

  if (!lastSeen) {
    return { status, isStale: false, isOffline: status === 'offline' };
  }

  const nowMs = Date.now();
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

