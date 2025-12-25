import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';

export const useRealtimeServer = (serverId: string | null) => {
  const { fetchServers, setCurrentServer, currentServer } = useServerStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!serverId) return;

    const channel = supabase
      .channel(`server:${serverId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'servers',
          filter: `id=eq.${serverId}`,
        },
        async (payload) => {
          const updatedServer = payload.new as any;
          // Update current server if it's the one being viewed
          if (currentServer?.id === serverId) {
            setCurrentServer(updatedServer);
          }
          // Refetch servers list
          if (user) {
            await fetchServers(user.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'servers',
          filter: `id=eq.${serverId}`,
        },
        () => {
          // Server was deleted, clear current server
          if (currentServer?.id === serverId) {
            setCurrentServer(null);
          }
          // Refetch servers list
          if (user) {
            fetchServers(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId, currentServer, setCurrentServer, fetchServers, user]);
};
