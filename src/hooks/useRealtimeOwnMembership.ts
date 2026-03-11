import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

type BroadcastMutationPayload<T> = {
  op?: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: T | null;
  old?: T | null;
};

/**
 * Hook that listens for realtime changes to the current user's own server membership.
 * This handles immediate removal when the user is kicked or banned from a server.
 */
export const useRealtimeOwnMembership = () => {
  const user = useAuthStore((state) => state.user);
  const serverStoreRef = useRef(useServerStore.getState());

  // Keep ref updated
  useEffect(() => {
    return useServerStore.subscribe((state) => {
      serverStoreRef.current = state;
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    console.log('[RealtimeOwnMembership] Setting up subscription for user:', user.id);

    const channel = supabase
      .channel(`user:${user.id}`)
      .on(
        'broadcast',
        {
          event: 'server_membership',
        },
        async (payload) => {
          const eventPayload = payload as BroadcastMutationPayload<{ server_id?: string; is_banned?: boolean }>;
          const newData = eventPayload.new ?? null;
          const oldData = eventPayload.old ?? null;

          if (eventPayload.op === 'DELETE') {
            const deletedServerId = oldData?.server_id;
            if (!deletedServerId) return;

            const { servers } = serverStoreRef.current;
            const server = servers.find((s) => s.id === deletedServerId);
            const serverName = server?.name || 'the server';

            useServerStore.setState((state) => ({
              servers: state.servers.filter((s) => s.id !== deletedServerId),
              currentServer: state.currentServer?.id === deletedServerId ? null : state.currentServer,
              currentChannel: state.currentServer?.id === deletedServerId ? null : state.currentChannel,
              channels: state.currentServer?.id === deletedServerId ? [] : state.channels,
              categories: state.currentServer?.id === deletedServerId ? [] : state.categories,
              members: state.currentServer?.id === deletedServerId ? [] : state.members,
            }));

            const persistedServerId = localStorage.getItem('kloak-current-server-id');
            if (persistedServerId === deletedServerId) {
              localStorage.removeItem('kloak-current-server-id');
              localStorage.removeItem('kloak-current-channel-id');
            }

            toast.error(`You have been kicked from ${serverName}`);
            return;
          }

          if (newData?.is_banned === true && oldData?.is_banned !== true) {
            const bannedServerId = newData.server_id;
            if (!bannedServerId) return;

            const { servers } = serverStoreRef.current;
            const server = servers.find((s) => s.id === bannedServerId);
            const serverName = server?.name || 'the server';

            useServerStore.setState((state) => ({
              servers: state.servers.filter((s) => s.id !== bannedServerId),
              currentServer: state.currentServer?.id === bannedServerId ? null : state.currentServer,
              currentChannel: state.currentServer?.id === bannedServerId ? null : state.currentChannel,
              channels: state.currentServer?.id === bannedServerId ? [] : state.channels,
              categories: state.currentServer?.id === bannedServerId ? [] : state.categories,
              members: state.currentServer?.id === bannedServerId ? [] : state.members,
            }));

            const persistedServerId = localStorage.getItem('kloak-current-server-id');
            if (persistedServerId === bannedServerId) {
              localStorage.removeItem('kloak-current-server-id');
              localStorage.removeItem('kloak-current-channel-id');
            }

            toast.error(`You have been banned from ${serverName}`);
          }
        }
      )
      .subscribe((status) => {
        console.log('[RealtimeOwnMembership] Subscription status:', status);
      });

    return () => {
      console.log('[RealtimeOwnMembership] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
};
