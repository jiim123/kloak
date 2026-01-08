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

    console.log('[Realtime] Setting up server subscription for:', serverId);

    const channel = supabase
      .channel(`server:${serverId}`)
      // Server updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'servers',
          filter: `id=eq.${serverId}`,
        },
        async (payload) => {
          console.log('[Realtime] Server updated:', payload.new);
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
          console.log('[Realtime] Server deleted:', serverId);
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
      // Channel changes
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channels',
          filter: `server_id=eq.${serverId}`,
        },
        async (payload) => {
          console.log('[Realtime] New channel created:', payload.new);
          // Refetch channels to get full data
          await serverStoreRef.current.fetchChannels(serverId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channels',
          filter: `server_id=eq.${serverId}`,
        },
        async (payload) => {
          console.log('[Realtime] Channel updated:', payload.new);
          await serverStoreRef.current.fetchChannels(serverId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'channels',
          filter: `server_id=eq.${serverId}`,
        },
        async (payload) => {
          console.log('[Realtime] Channel deleted:', payload.old);
          await serverStoreRef.current.fetchChannels(serverId);
        }
      )
      // Category changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_categories',
          filter: `server_id=eq.${serverId}`,
        },
        async (payload) => {
          console.log('[Realtime] Category change:', payload);
          await serverStoreRef.current.fetchChannels(serverId);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Server subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Cleaning up server subscription for:', serverId);
      supabase.removeChannel(channel);
    };
  }, [serverId]);
};
