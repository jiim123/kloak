import type { UserStatus } from '@/types';
import { hasRecentRealtimePresence } from '@/hooks/useRealtimeUsers';

export interface EffectivePresence {
  status: UserStatus;
  /**
   * Retained for compatibility. Presence is now derived from the authoritative
   * realtime presence channel (plus the persisted status as a fallback), so this
   * is always false — no last_seen-based "stale" inference is applied anymore.
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
  _lastSeen: string | null | undefined,
  userId?: string,
): EffectivePresence {
  // If we have recent real-time Presence data for this user,
  // trust the status as-is without any DB/last_seen override.
  if (userId && hasRecentRealtimePresence(userId)) {
    return { status, isStale: false, isOffline: status === 'offline' };
  }

  // Fallback: we have no live realtime presence data for this user, so trust the
  // persisted status verbatim. We deliberately do NOT infer online/offline from
  // `last_seen` here. `last_seen` is only updated while the user actively types or
  // changes status, so treating a stale `last_seen` as "offline" mislabels connected
  // and idle users as offline, and a recent `last_seen` as "online" fights the
  // realtime presence channel when it explicitly marks a user offline. The live
  // presence channel (kept fresh by a heartbeat in useRealtimeUsers) is the
  // authoritative source of online/offline — exactly like Discord's gateway.
  return { status, isStale: false, isOffline: status === 'offline' };
}

