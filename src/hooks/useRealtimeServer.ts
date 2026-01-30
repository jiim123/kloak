import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStatus } from './useConnectionStatus';

export const useRealtimeServer = (serverId: string | null) => {
  const { isConnected, isReconnecting } = useConnectionStatus();
  
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

    // Don't set up subscription if connection is down
    if (!isConnected && !isReconnecting) {
      return;
    }

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
          try {
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
          } catch (error) {
            console.error('[Realtime] Error processing server update:', error);
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
          try {
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
          } catch (error) {
            console.error('[Realtime] Error processing server delete:', error);
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
          try {
            const newChannel = payload.new as any;
            useServerStore.setState((state) => {
              // Prevent duplicate if already added optimistically by createChannel
              if (state.channels.some(c => c.id === newChannel.id)) {
                return state;
              }
              return {
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
                  is_private: newChannel.is_private || false,
                  icon: newChannel.icon,
                  created_at: newChannel.created_at,
                  block_links: newChannel.block_links || false,
                  allowed_link_domains: newChannel.allowed_link_domains || [],
                  ghost_mode: newChannel.ghost_mode || false,
                }],
              };
            });
          } catch (error) {
            console.error('[Realtime] Error processing channel insert:', error);
          }
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
          try {
            const updated = payload.new as any;
            useServerStore.setState((state) => ({
              channels: state.channels.map((ch) =>
                ch.id === updated.id ? { ...ch, ...updated } : ch
              ),
              currentChannel: state.currentChannel?.id === updated.id
                ? { ...state.currentChannel, ...updated }
                : state.currentChannel,
            }));
          } catch (error) {
            console.error('[Realtime] Error processing channel update:', error);
          }
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
          try {
            const oldChannel = payload.old as { id?: string };
            if (oldChannel.id) {
              useServerStore.setState((state) => ({
                channels: state.channels.filter((ch) => ch.id !== oldChannel.id),
                currentChannel: state.currentChannel?.id === oldChannel.id
                  ? null
                  : state.currentChannel,
              }));
            }
          } catch (error) {
            console.error('[Realtime] Error processing channel delete:', error);
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
          try {
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
          } catch (error) {
            console.error('[Realtime] Error processing category insert:', error);
          }
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
          try {
            const updated = payload.new as any;
            useServerStore.setState((state) => ({
              categories: state.categories.map((cat) =>
                cat.id === updated.id ? { ...cat, ...updated } : cat
              ),
            }));
          } catch (error) {
            console.error('[Realtime] Error processing category update:', error);
          }
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
          try {
            const oldCat = payload.old as { id?: string };
            if (oldCat.id) {
              useServerStore.setState((state) => ({
                categories: state.categories.filter((cat) => cat.id !== oldCat.id),
              }));
            }
          } catch (error) {
            console.error('[Realtime] Error processing category delete:', error);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to server:', serverId);
        } else if (status === 'CHANNEL_ERROR') {
          // Only log if connection is available (otherwise it's expected)
          if (isConnected || isReconnecting) {
            console.warn('[Realtime] Channel error for server:', err?.message || 'Unknown error');
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Server subscription timed out');
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // Ignore cleanup errors
      }
    };
  }, [serverId, isConnected, isReconnecting]);
};
