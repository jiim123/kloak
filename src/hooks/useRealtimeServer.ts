import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';

export const useRealtimeServer = (serverId: string | null) => {
  // Use refs to avoid recreating subscription when store functions or user object changes
  const serverStoreRef = useRef(useServerStore.getState());
  const authStoreRef = useRef(useAuthStore.getState());

  // Keep refs updated
  useEffect(() => {
    const unsubServer = useServerStore.subscribe((state) => {
      serverStoreRef.current = state;
    });
    const unsubAuth = useAuthStore.subscribe((state) => {
      authStoreRef.current = state;
    });
    return () => {
      unsubServer();
      unsubAuth();
    };
  }, []);

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
          const { currentServer } = serverStoreRef.current;
          const { user } = authStoreRef.current;
          
          // Update current server inline without calling setCurrentServer
          // to avoid triggering state clears
          if (currentServer?.id === serverId) {
            useServerStore.setState((state) => ({
              currentServer: { ...state.currentServer!, ...updatedServer },
              servers: state.servers.map((s) =>
                s.id === serverId ? { ...s, ...updatedServer } : s
              ),
            }));
          } else if (user) {
            // Only refetch if not viewing this server
            await serverStoreRef.current.fetchServers(user.id);
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
        async () => {
          const { currentServer, setCurrentServer } = serverStoreRef.current;
          const { user } = authStoreRef.current;
          
          // Server was deleted, clear current server
          if (currentServer?.id === serverId) {
            setCurrentServer(null);
          }
          // Refetch servers list
          if (user) {
            await serverStoreRef.current.fetchServers(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId]);
};
