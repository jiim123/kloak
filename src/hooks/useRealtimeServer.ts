import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStatus } from './useConnectionStatus';
import { toast } from '@/hooks/use-toast';
import type { Channel } from '@/types';

type RealtimeRow = Record<string, unknown>;
type RealtimeErrorLike = { message?: string; name?: string; cause?: unknown };
type ServerSurfaceBroadcastPayload = {
  table?: string;
  op?: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: RealtimeRow | null;
  old?: RealtimeRow | null;
};

function makeDebouncedFn(fn: () => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}

export const useRealtimeServer = (serverId: string | null) => {
  const { isConnected } = useConnectionStatus();
  const serverStoreRef = useRef(useServerStore.getState());
  const authStoreRef = useRef(useAuthStore.getState());
  const prevConnectedRef = useRef<boolean | null>(null);

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

  const handleChannelAccessLost = useCallback((sid: string, message: string) => {
    const { channels, setCurrentChannel } = useServerStore.getState();
    const remaining = channels.filter((c) => c.server_id === sid);
    const fallback = remaining[0] || null;
    setCurrentChannel(fallback);
    toast({ title: message });
  }, []);

  const refreshAccessibleState = useCallback((sid: string, accessLostMessage: string) => {
    const store = serverStoreRef.current;
    console.log('[Realtime] Refreshing channels & permissions for server', sid);

    store.fetchChannels(sid).then(() => {
      const { currentChannel, channels } = useServerStore.getState();
      if (currentChannel && !channels.some((c) => c.id === currentChannel.id)) {
        handleChannelAccessLost(sid, accessLostMessage);
      }
    });
    store.fetchRolePermissions(sid, { force: true });
  }, [handleChannelAccessLost]);

  const refreshMemberSnapshot = useCallback((sid: string) => {
    const storeState = useServerStore.getState();
    const shouldUseFull = storeState.membersServerId === sid && storeState.membersFetchMode === 'full';
    return serverStoreRef.current.fetchMembers(sid, { force: true, full: shouldUseFull });
  }, []);

  const refreshRoleMetadata = useCallback((sid: string) => {
    return serverStoreRef.current.fetchRoles(sid);
  }, []);

  const debouncedRefreshRef = useRef<ReturnType<typeof makeDebouncedFn> | null>(null);

  useEffect(() => {
    if (!serverId) return;

    if (prevConnectedRef.current === false && isConnected) {
      console.log('[Realtime] Reconnected - refreshing server state for', serverId);
      refreshAccessibleState(serverId, 'A channel you were viewing is no longer available');
      void refreshRoleMetadata(serverId);
      void refreshMemberSnapshot(serverId);
    }

    prevConnectedRef.current = isConnected;
  }, [isConnected, refreshAccessibleState, refreshMemberSnapshot, refreshRoleMetadata, serverId]);

  useEffect(() => {
    if (!serverId) return;

    const debounced = makeDebouncedFn(() => {
      console.log('[Realtime] Permission change detected - refreshing channels & roles for', serverId);
      refreshAccessibleState(serverId, 'You no longer have access to that channel');
    }, 500);

    debouncedRefreshRef.current = debounced;
    return () => {
      debounced.cancel();
    };
  }, [refreshAccessibleState, serverId]);

  useEffect(() => {
    if (!serverId) return;

    const channel = supabase
      .channel(`server:${serverId}`)
      .on(
        'broadcast',
        { event: 'server_surface' },
        ({ payload }) => {
          const event = payload as ServerSurfaceBroadcastPayload | null;
          if (!event?.table) return;

          debouncedRefreshRef.current?.();

          if (
            event.table === 'server_roles' ||
            event.table === 'server_member_roles' ||
            event.table === 'server_members'
          ) {
            void refreshRoleMetadata(serverId);
            void refreshMemberSnapshot(serverId);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'servers' },
        async (payload) => {
          try {
            const updatedServer = payload.new as RealtimeRow;
            if (updatedServer.id !== serverId) return;
            const { currentServer } = serverStoreRef.current;
            const { user } = authStoreRef.current;
            if (currentServer?.id === serverId) {
              useServerStore.setState((state) => ({
                currentServer: { ...state.currentServer!, ...updatedServer },
                servers: state.servers.map((s) => (s.id === serverId ? { ...s, ...updatedServer } : s)),
              }));
            } else if (user) {
              await serverStoreRef.current.fetchServers(user.id);
            }
          } catch (error) {
            console.error('[Realtime] Error processing server update:', error);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'servers' },
        async (payload) => {
          try {
            const oldServer = payload.old as RealtimeRow;
            if (oldServer.id !== serverId) return;
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
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channels' },
        async (payload) => {
          try {
            const newChannel = payload.new as RealtimeRow;
            if (newChannel.server_id !== serverId) return;
            if (useServerStore.getState().channels.some((c) => c.id === newChannel.id)) return;

            if (newChannel.is_private) {
              const userId = authStoreRef.current.user?.id;
              if (!userId) return;
              const { data } = await supabase
                .from('channel_members')
                .select('id')
                .eq('channel_id', newChannel.id as string)
                .eq('user_id', userId)
                .maybeSingle();
              if (!data) return;
            }

            useServerStore.setState((state) => ({
              channels: [
                ...state.channels,
                {
                  id: newChannel.id,
                  server_id: newChannel.server_id,
                  category_id: newChannel.category_id,
                  linked_voice_channel_id: newChannel.linked_voice_channel_id ?? null,
                  name: newChannel.name,
                  topic: newChannel.topic,
                  type: (newChannel.type as Channel['type']) || 'text',
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
                },
              ],
            }));
          } catch (error) {
            console.error('[Realtime] Error processing channel insert:', error);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'channels' },
        (payload) => {
          try {
            const updated = payload.new as RealtimeRow;
            if (updated.server_id !== serverId) return;
            const normalizedChannel: Partial<Channel> = {
              id: String(updated.id),
              server_id: String(updated.server_id),
              category_id: updated.category_id ? String(updated.category_id) : null,
              linked_voice_channel_id: updated.linked_voice_channel_id ? String(updated.linked_voice_channel_id) : null,
              name: String(updated.name),
              topic: updated.topic ? String(updated.topic) : null,
              type: (String(updated.type) as Channel['type']) || 'text',
              position: Number(updated.position) || 0,
              is_nsfw: Boolean(updated.is_nsfw),
              slowmode_seconds: Number(updated.slowmode_seconds) || 0,
              is_read_only: Boolean(updated.is_read_only),
              is_private: Boolean(updated.is_private),
              icon: updated.icon ? String(updated.icon) : null,
              created_at: String(updated.created_at),
              block_links: Boolean(updated.block_links),
              allowed_link_domains: Array.isArray(updated.allowed_link_domains)
                ? (updated.allowed_link_domains as string[])
                : [],
              ghost_mode: Boolean(updated.ghost_mode),
            };
            useServerStore.setState((state) => ({
              channels: state.channels.map((ch) => (ch.id === normalizedChannel.id ? { ...ch, ...normalizedChannel } : ch)),
              currentChannel:
                state.currentChannel?.id === normalizedChannel.id
                  ? { ...state.currentChannel, ...normalizedChannel }
                  : state.currentChannel,
            }));
          } catch (error) {
            console.error('[Realtime] Error processing channel update:', error);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'channels' },
        (payload) => {
          try {
            const oldChannel = payload.old as { id?: string };
            if (!oldChannel.id) return;

            const existingChannel = useServerStore.getState().channels.find((ch) => ch.id === oldChannel.id);
            if (!existingChannel || existingChannel.server_id !== serverId) return;

            const { currentChannel } = useServerStore.getState();
            const wasViewing = currentChannel?.id === oldChannel.id;

            useServerStore.setState((state) => {
              const remaining = state.channels.filter((ch) => ch.id !== oldChannel.id);
              const nextChannel = wasViewing ? remaining.find((c) => c.server_id === serverId) || null : state.currentChannel;

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
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'channel_categories' },
        (payload) => {
          try {
            const newCat = payload.new as RealtimeRow;
            if (newCat.server_id !== serverId) return;
            useServerStore.setState((state) => ({
              categories: [
                ...state.categories,
                {
                  id: newCat.id,
                  server_id: newCat.server_id,
                  name: newCat.name,
                  position: newCat.position || 0,
                  is_collapsed: newCat.is_collapsed || false,
                  created_at: newCat.created_at,
                },
              ],
            }));
          } catch (error) {
            console.error('[Realtime] Error processing category insert:', error);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'channel_categories' },
        (payload) => {
          try {
            const updated = payload.new as RealtimeRow;
            if (updated.server_id !== serverId) return;
            useServerStore.setState((state) => ({
              categories: state.categories.map((cat) => (cat.id === updated.id ? { ...cat, ...updated } : cat)),
            }));
          } catch (error) {
            console.error('[Realtime] Error processing category update:', error);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'channel_categories' },
        (payload) => {
          try {
            const oldCat = payload.old as { id?: string };
            if (!oldCat.id) return;
            const existingCategory = useServerStore.getState().categories.find((cat) => cat.id === oldCat.id);
            if (!existingCategory || existingCategory.server_id !== serverId) return;
            useServerStore.setState((state) => ({
              categories: state.categories.filter((cat) => cat.id !== oldCat.id),
            }));
          } catch (error) {
            console.error('[Realtime] Error processing category delete:', error);
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_permissions' },
        (payload) => {
          const rec = (payload.new || payload.old) as RealtimeRow | null;
          if (!rec?.channel_id) return;
          const channels = useServerStore.getState().channels;
          const belongsToCurrentServer = channels.some((ch) => ch.id === rec.channel_id && ch.server_id === serverId);
          if (!belongsToCurrentServer) return;
          debouncedRefreshRef.current?.();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'role_permissions' },
        (payload) => {
          const rec = (payload.new || payload.old) as RealtimeRow | null;
          if (rec?.server_id !== serverId) return;
          debouncedRefreshRef.current?.();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'server_roles' },
        (payload) => {
          const rec = (payload.new || payload.old) as RealtimeRow | null;
          if (rec?.server_id !== serverId) return;
          void refreshRoleMetadata(serverId);
          void refreshMemberSnapshot(serverId);
          debouncedRefreshRef.current?.();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'server_member_roles' },
        (payload) => {
          const rec = (payload.new || payload.old) as RealtimeRow | null;
          if (!rec?.member_id) return;

          const userId = authStoreRef.current.user?.id;
          if (!userId) return;

          const members = useServerStore.getState().members;
          const selfMember = members.find((m) => m.user_id === userId && m.server_id === serverId);

          if (!selfMember) {
            void refreshMemberSnapshot(serverId);
            debouncedRefreshRef.current?.();
            return;
          }

          if (rec.member_id !== selfMember.id) return;
          void refreshMemberSnapshot(serverId);
          debouncedRefreshRef.current?.();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'server_members' },
        (payload) => {
          const rec = payload.new as RealtimeRow;
          const userId = authStoreRef.current.user?.id;
          if (!userId || rec?.server_id !== serverId || rec?.user_id !== userId) return;
          void refreshMemberSnapshot(serverId);
          debouncedRefreshRef.current?.();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channel_members' },
        (payload) => {
          const rec = (payload.new || payload.old) as RealtimeRow | null;
          const userId = authStoreRef.current.user?.id;
          if (rec?.user_id === userId) {
            debouncedRefreshRef.current?.();
          }
        },
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to server:', serverId);
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          if (err) {
            console.warn('[Realtime] Server subscribe error:', {
              serverId,
              status,
              message: (err as RealtimeErrorLike | null)?.message,
              name: (err as RealtimeErrorLike | null)?.name,
              cause: (err as RealtimeErrorLike | null)?.cause,
              details: err,
            });
          } else {
            console.warn('[Realtime] Server subscribe status:', { serverId, status });
          }
        }
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // Ignore cleanup errors.
      }
    };
  }, [refreshMemberSnapshot, refreshRoleMetadata, serverId]);
};
