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
      // Channel changes - use payload directly for speed
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channels',
          filter: `server_id=eq.${serverId}`,
        },
        (payload) => {
          console.log('[Realtime] New channel created:', payload.new);
          const newChannel = payload.new as any;
          useServerStore.setState((state) => ({
            channels: [...state.channels, {
              id: newChannel.id,
              server_id: newChannel.server_id,
              category_id: newChannel.category_id,
              name: newChannel.name,
              topic: newChannel.topic,
              type: newChannel.type || 'text',
              position: newChannel.position || 0,
              is_nsfw: newChannel.is_nsfw || false,
              slowmode_seconds: newChannel.slowmode_seconds || 0,
              is_read_only: newChannel.is_read_only || false,
              icon: newChannel.icon,
              created_at: newChannel.created_at,
            }],
          }));
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
        (payload) => {
          console.log('[Realtime] Channel updated:', payload.new);
          const updated = payload.new as any;
          useServerStore.setState((state) => ({
            channels: state.channels.map((ch) =>
              ch.id === updated.id ? { ...ch, ...updated } : ch
            ),
            currentChannel: state.currentChannel?.id === updated.id
              ? { ...state.currentChannel, ...updated }
              : state.currentChannel,
          }));
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
        (payload) => {
          console.log('[Realtime] Channel deleted:', payload.old);
          const oldChannel = payload.old as { id?: string };
          if (oldChannel.id) {
            useServerStore.setState((state) => ({
              channels: state.channels.filter((ch) => ch.id !== oldChannel.id),
              currentChannel: state.currentChannel?.id === oldChannel.id
                ? null
                : state.currentChannel,
            }));
          }
        }
      )
      // Category changes - use payload directly
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'channel_categories',
          filter: `server_id=eq.${serverId}`,
        },
        (payload) => {
          console.log('[Realtime] Category created:', payload.new);
          const newCat = payload.new as any;
          useServerStore.setState((state) => ({
            categories: [...state.categories, {
              id: newCat.id,
              server_id: newCat.server_id,
              name: newCat.name,
              position: newCat.position || 0,
              is_collapsed: newCat.is_collapsed || false,
              created_at: newCat.created_at,
            }],
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'channel_categories',
          filter: `server_id=eq.${serverId}`,
        },
        (payload) => {
          console.log('[Realtime] Category updated:', payload.new);
          const updated = payload.new as any;
          useServerStore.setState((state) => ({
            categories: state.categories.map((cat) =>
              cat.id === updated.id ? { ...cat, ...updated } : cat
            ),
          }));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'channel_categories',
          filter: `server_id=eq.${serverId}`,
        },
        (payload) => {
          console.log('[Realtime] Category deleted:', payload.old);
          const oldCat = payload.old as { id?: string };
          if (oldCat.id) {
            useServerStore.setState((state) => ({
              categories: state.categories.filter((cat) => cat.id !== oldCat.id),
            }));
          }
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
