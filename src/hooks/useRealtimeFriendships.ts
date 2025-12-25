import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFriendStore } from '@/stores/friendStore';

export const useRealtimeFriendships = (userId: string | null) => {
  const { fetchFriends } = useFriendStore();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`friendships:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friendships',
        },
        (payload) => {
          const data = payload.new as any || payload.old as any;
          // Check if this friendship involves the current user
          if (data?.requester_id === userId || data?.addressee_id === userId) {
            fetchFriends(userId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchFriends]);
};
