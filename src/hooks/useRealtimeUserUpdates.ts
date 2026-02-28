import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { patchUserAcrossStores } from './useRealtimeUsers';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

/**
 * Maximum number of user IDs to fetch in one targeted poll.
 */
const MAX_USER_IDS_FOR_SUBSCRIPTION = 100;

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
  const userIdsKey = userIds.join(',');

  useEffect(() => {
    const targetUserIds = userIdsKey ? userIdsKey.split(',') : [];

    // Skip if no user IDs or too many (fall back to polling for large sets)
    if (!viewerId || targetUserIds.length === 0 || targetUserIds.length > MAX_USER_IDS_FOR_SUBSCRIPTION) {
      return;
    }
 
    let mounted = true;

    const fetchUsers = async () => {
      const { data, error } = await supabase.rpc('get_users_basic_secure', {
        _user_id: viewerId,
        _target_user_ids: targetUserIds,
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
    };

    void fetchUsers();

    const intervalId = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      void fetchUsers();
    }, 60000);

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
  }, [userIdsKey, channelName, viewerId]); // Re-fetch when user IDs change
};
