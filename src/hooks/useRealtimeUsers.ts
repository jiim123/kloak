import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import type { User } from '@/types';

export const useRealtimeUsers = () => {
  const { members, fetchMembers, currentServer } = useServerStore();

  useEffect(() => {
    const channel = supabase
      .channel('users-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          const updatedUser = payload.new as User;
          // Check if this user is in current server's members
          const isMember = members.some(m => m.user_id === updatedUser.id);
          if (isMember && currentServer) {
            fetchMembers(currentServer.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [members, currentServer, fetchMembers]);
};
