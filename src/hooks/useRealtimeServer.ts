import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { useConnectionStatus } from './useConnectionStatus';
import { toast } from '@/hooks/use-toast';
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

    store.fetchChannels(sid, { force: true }).then(() => {
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
    return serverStoreRef.current.fetchRoles(sid, { force: true });
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

          if (event.table === 'servers') {
            const user = authStoreRef.current.user;
            if (user?.id) {
              void serverStoreRef.current.fetchServers(user.id);
            }
          }

          if (
            event.table === 'channels' ||
            event.table === 'channel_categories' ||
            event.table === 'channel_permissions' ||
            event.table === 'role_permissions' ||
            event.table === 'channel_members' ||
            event.table === 'servers'
          ) {
            debouncedRefreshRef.current?.();
          }

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
