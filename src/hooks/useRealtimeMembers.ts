import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';

export const useRealtimeMembers = (serverId: string | null) => {
  const { fetchMembers } = useServerStore();

  useEffect(() => {
    if (!serverId) return;

    const channel = supabase
      .channel(`members:${serverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'server_members',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          // Refetch members list on any change
          fetchMembers(serverId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId, fetchMembers]);
};
