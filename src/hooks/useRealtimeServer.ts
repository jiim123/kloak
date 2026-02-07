import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStatus } from './useConnectionStatus';
import { toast } from '@/hooks/use-toast';

/** Debounce helper – returns a debounced version of `fn` that delays execution by `ms`. */
function makeDebouncedFn(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  debounced.cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
  };
  return debounced;
}

export const useRealtimeServer = (serverId: string | null) => {
  const { isConnected, isReconnecting } = useConnectionStatus();

  // Use refs to avoid recreating subscription when store functions or user object changes
  const serverStoreRef = useRef(useServerStore.getState());
  const authStoreRef = useRef(useAuthStore.getState());
  const prevConnectedRef = useRef<boolean | null>(null);

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

  // ----- Reconnection recovery -----
  useEffect(() => {
    if (!serverId) return;
    const nowConnected = isConnected;

    if (prevConnectedRef.current === false && nowConnected) {
      // Just reconnected – re-fetch channels & permissions to catch missed events
      console.log('[Realtime] Reconnected – refreshing channels & permissions for server', serverId);
      const store = serverStoreRef.current;
      store.fetchChannels(serverId).then(() => {
        // After fetch, check if currentChannel still exists
        const { currentChannel, channels } = useServerStore.getState();
        if (currentChannel && !channels.some(c => c.id === currentChannel.id)) {
          handleChannelAccessLost(serverId, 'A channel you were viewing is no longer available');
        }
      });
      store.fetchRolePermissions(serverId);
    }

    prevConnectedRef.current = nowConnected;
  }, [isConnected, serverId]);

  // ----- Helper: handle when user loses access to current channel -----
  const handleChannelAccessLost = useCallback((sid: string, message: string) => {
    const { channels, setCurrentChannel } = useServerStore.getState();
    const remaining = channels.filter(c => c.server_id === sid);
    const fallback = remaining[0] || null;
    setCurrentChannel(fallback);
    toast({ title: message });
  }, []);

  // ----- Debounced permission refresh -----
  const debouncedRefreshRef = useRef<ReturnType<typeof makeDebouncedFn> | null>(null);

  useEffect(() => {
    if (!serverId) return;

    const refreshPermissions = () => {
      const sid = serverId;
      const store = serverStoreRef.current;
      console.log('[Realtime] Permission change detected – refreshing channels & roles for', sid);

      store.fetchChannels(sid).then(() => {
        const { currentChannel, channels } = useServerStore.getState();
        if (currentChannel && !channels.some(c => c.id === currentChannel.id)) {
          handleChannelAccessLost(sid, 'You no longer have access to that channel');
        }
      });
      store.fetchRolePermissions(sid);
    };

    const debounced = makeDebouncedFn(refreshPermissions, 500);
    debouncedRefreshRef.current = debounced;

    return () => { debounced.cancel(); };
  }, [serverId, handleChannelAccessLost]);

  // ----- Main subscription -----
  useEffect(() => {
    if (!serverId) return;
    if (!isConnected && !isReconnecting) return;

    const channel = supabase
      .channel(`server:${serverId}`)
      // ===== Server updates (existing) =====
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'servers', filter: `id=eq.${serverId}` },
        async (payload) => {
          try {
            const updatedServer = payload.new as any;
            const { currentServer } = serverStoreRef.current;
            const { user } = authStoreRef.current;
            if (currentServer?.id === serverId) {
              useServerStore.setState((state) => ({
                currentServer: { ...state.currentServer!, ...updatedServer },
                servers: state.servers.map((s) => s.id === serverId ? { ...s, ...updatedServer } : s),
              }));
            } else if (user) {
              await serverStoreRef.current.fetchServers(user.id);
            }
          } catch (error) {
            console.error('[Realtime] Error processing server update:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'servers', filter: `id=eq.${serverId}` },
        async () => {
          try {
            const { currentServer, setCurrentServer } = serverStoreRef.current;
            const { user } = authStoreRef.current;
            if (currentServer?.id === serverId) {
              setCurrentServer(null);
            }
            if (user) {
              await serverStoreRef.current.fetchServers(user.id);
            }
          } catch (error) {
            console.error('[Realtime] Error processing server delete:', error);
          }
        }
      )
      // ===== Channel INSERT – with private channel filtering =====
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channels', filter: `server_id=eq.${serverId}` },
        async (payload) => {
          try {
            const newChannel = payload.new as any;

            // Prevent duplicate if already added optimistically
            if (useServerStore.getState().channels.some(c => c.id === newChannel.id)) return;

            // Private channel check: verify user has access
            if (newChannel.is_private) {
              const userId = authStoreRef.current.user?.id;
              if (!userId) return; // no user, skip
              const { data } = await supabase
                .from('channel_members')
                .select('id')
                .eq('channel_id', newChannel.id)
                .eq('user_id', userId)
                .maybeSingle();
              if (!data) return; // user doesn't have access, skip
            }

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
                is_private: newChannel.is_private || false,
                icon: newChannel.icon,
                created_at: newChannel.created_at,
                block_links: newChannel.block_links || false,
                allowed_link_domains: newChannel.allowed_link_domains || [],
                ghost_mode: newChannel.ghost_mode || false,
              }],
            }));
          } catch (error) {
            console.error('[Realtime] Error processing channel insert:', error);
          }
        }
      )
      // ===== Channel UPDATE (existing) =====
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'channels', filter: `server_id=eq.${serverId}` },
        (payload) => {
          try {
            const updated = payload.new as any;
            const normalizedChannel = {
              id: String(updated.id),
              server_id: String(updated.server_id),
              category_id: updated.category_id ? String(updated.category_id) : null,
              name: String(updated.name),
              topic: updated.topic ? String(updated.topic) : null,
              type: (String(updated.type) as any) || 'text',
              position: Number(updated.position) || 0,
              is_nsfw: Boolean(updated.is_nsfw),
              slowmode_seconds: Number(updated.slowmode_seconds) || 0,
              is_read_only: Boolean(updated.is_read_only),
              is_private: Boolean(updated.is_private),
              icon: updated.icon ? String(updated.icon) : null,
              created_at: String(updated.created_at),
              block_links: Boolean(updated.block_links),
              allowed_link_domains: Array.isArray(updated.allowed_link_domains) ? updated.allowed_link_domains as string[] : [],
              ghost_mode: Boolean(updated.ghost_mode),
            };
            useServerStore.setState((state) => ({
              channels: state.channels.map((ch) =>
                ch.id === normalizedChannel.id ? { ...ch, ...normalizedChannel } : ch
              ),
              currentChannel: state.currentChannel?.id === normalizedChannel.id
                ? { ...state.currentChannel, ...normalizedChannel }
                : state.currentChannel,
            }));
          } catch (error) {
            console.error('[Realtime] Error processing channel update:', error);
          }
        }
      )
      // ===== Channel DELETE – with navigation & toast =====
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'channels', filter: `server_id=eq.${serverId}` },
        (payload) => {
          try {
            const oldChannel = payload.old as { id?: string };
            if (!oldChannel.id) return;

            const { currentChannel } = useServerStore.getState();
            const wasViewing = currentChannel?.id === oldChannel.id;

            useServerStore.setState((state) => {
              const remaining = state.channels.filter((ch) => ch.id !== oldChannel.id);
              let nextChannel = state.currentChannel;

              if (wasViewing) {
                // Pick the first remaining channel in this server, or null
                nextChannel = remaining.find(c => c.server_id === serverId) || null;
              }

              return {
                channels: remaining,
                currentChannel: wasViewing ? nextChannel : state.currentChannel,
              };
            });

            if (wasViewing) {
              toast({ title: 'The channel you were viewing has been deleted' });
            }
          } catch (error) {
            console.error('[Realtime] Error processing channel delete:', error);
          }
        }
      )
      // ===== Category INSERT/UPDATE/DELETE (existing) =====
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channel_categories', filter: `server_id=eq.${serverId}` },
        (payload) => {
          try {
            const newCat = payload.new as any;
            useServerStore.setState((state) => ({
              categories: [...state.categories, {
                id: newCat.id, server_id: newCat.server_id,
                name: newCat.name, position: newCat.position || 0,
                is_collapsed: newCat.is_collapsed || false, created_at: newCat.created_at,
              }],
            }));
          } catch (error) {
            console.error('[Realtime] Error processing category insert:', error);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'channel_categories', filter: `server_id=eq.${serverId}` },
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
        { event: 'DELETE', schema: 'public', table: 'channel_categories', filter: `server_id=eq.${serverId}` },
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
      // ===== NEW: Permission table subscriptions =====
      // channel_permissions changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_permissions' },
        (payload) => {
          // Only react if this permission is for a channel in the current server
          const rec = (payload.new || payload.old) as any;
          if (!rec?.channel_id) return;
          // We can't filter by server_id directly, but channels belong to servers.
          // The debounced refresh will re-fetch and the RPC handles filtering.
          debouncedRefreshRef.current?.();
        }
      )
      // role_permissions changes
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'role_permissions', filter: `server_id=eq.${serverId}` },
        () => { debouncedRefreshRef.current?.(); }
      )
      // server_member_roles changes (affects current user's permissions)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'server_member_roles' },
        () => { debouncedRefreshRef.current?.(); }
      )
      // channel_members changes (affects private channel visibility)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_members' },
        (payload) => {
          const rec = (payload.new || payload.old) as any;
          const userId = authStoreRef.current.user?.id;
          // Only refresh if this affects the current user
          if (rec?.user_id === userId) {
            debouncedRefreshRef.current?.();
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to server:', serverId);
        } else if (status === 'CHANNEL_ERROR') {
          if (isConnected || isReconnecting) {
            console.warn('[Realtime] Channel error for server:', err?.message || 'Unknown error');
          }
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Server subscription timed out');
        }
      });

    return () => {
      try { supabase.removeChannel(channel); } catch (e) { /* ignore */ }
    };
  }, [serverId, isConnected, isReconnecting, handleChannelAccessLost]);
};
