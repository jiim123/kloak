import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { patchUserAcrossStores } from './useRealtimeUsers';
import { useAuthStore } from '@/stores/authStore';
import { getUserCacheAge } from '@/stores/userCacheStore';
import type { User } from '@/types';

/**
 * Maximum number of user IDs to fetch in one targeted poll.
 */
const MAX_USER_IDS_FOR_SUBSCRIPTION = 100;
const TARGETED_USER_POLL_INTERVAL_MS = 60_000;
const TARGETED_USER_REFRESH_TTL_MS = 5 * 60_000;

const inflightTargetedFetches = new Map<string, Promise<void>>();

const collectStaleUserIds = (userIds: string[]): string[] =>
  userIds.filter((userId) => {
    const cacheAge = getUserCacheAge(userId);
    return cacheAge == null || cacheAge >= TARGETED_USER_REFRESH_TTL_MS;
  });

/**
 * Hook for targeted user updates.
 *
 * This polls hardened RPCs instead of subscribing to `public.users` changes,
 * so profile updates remain fresh without depending on broad realtime table access.
 */
export const useRealtimeUserUpdates = (
  userIds: string[],
  channelName: string,
  onUpdate?: (user: User) => void
) => {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const viewerId = useAuthStore((s) => s.user?.id ?? null);
  const shouldSkipTargetedPolling = userIds.length > MAX_USER_IDS_FOR_SUBSCRIPTION;
  const userIdsKey = shouldSkipTargetedPolling ? `skip:${userIds.length}` : userIds.join(',');

  useEffect(() => {
    if (shouldSkipTargetedPolling) {
      return;
    }

    const targetUserIds = userIdsKey ? userIdsKey.split(',') : [];

    // Skip if no user IDs or too many (fall back to polling for large sets)
    if (!viewerId || targetUserIds.length === 0) {
      return;
    }
 
    let mounted = true;

    const fetchUsers = async () => {
      const staleTargetUserIds = collectStaleUserIds(targetUserIds);
      if (staleTargetUserIds.length === 0) return;

      const fetchKey = `${viewerId}:${staleTargetUserIds.slice().sort().join(',')}`;
      const existingFetch = inflightTargetedFetches.get(fetchKey);
      if (existingFetch) {
        await existingFetch;
        return;
      }

      const fetchPromise = (async () => {
        const { data, error } = await supabase.rpc('get_users_basic_secure', {
          _user_id: viewerId,
          _target_user_ids: staleTargetUserIds,
        });

        if (!mounted || error || !Array.isArray(data)) return;

        data.forEach((row) => {
          if (!row || typeof row !== 'object' || !('id' in row)) return;
          const updatedUser = row as unknown as User;
          patchUserAcrossStores(updatedUser);
          if (onUpdateRef.current) {
            onUpdateRef.current(updatedUser);
          }
        });
      })();

      inflightTargetedFetches.set(fetchKey, fetchPromise);
      try {
        await fetchPromise;
      } finally {
        inflightTargetedFetches.delete(fetchKey);
      }
    };

    void fetchUsers();

    const intervalId = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void fetchUsers();
    }, TARGETED_USER_POLL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchUsers();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [userIdsKey, channelName, viewerId, shouldSkipTargetedPolling]); // Re-fetch when user IDs change
};
