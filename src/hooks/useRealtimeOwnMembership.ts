import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

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

    const channel = supabase
      .channel(`own-membership:${user.id}`)
      // Listen for DELETE events on the current user's membership (kicked)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'server_members',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const deletedServerId = payload.old?.server_id;
          if (!deletedServerId) return;

          const { currentServer, servers, setCurrentServer, fetchServers } = serverStoreRef.current;

          // Find the server name for the toast
          const server = servers.find((s) => s.id === deletedServerId);
          const serverName = server?.name || 'the server';

          // If user is currently viewing this server, navigate away
          if (currentServer?.id === deletedServerId) {
            setCurrentServer(null);
            toast.error(`You have been removed from ${serverName}`);
          }

          // Refresh the servers list to remove the server
          await fetchServers(user.id);
        }
      )
      // Listen for UPDATE events where is_banned becomes true (banned)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'server_members',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          const newData = payload.new as { server_id?: string; is_banned?: boolean };
          const oldData = payload.old as { is_banned?: boolean };

          // Check if user was just banned
          if (newData.is_banned === true && oldData.is_banned !== true) {
            const bannedServerId = newData.server_id;
            if (!bannedServerId) return;

            const { currentServer, servers, setCurrentServer, fetchServers } = serverStoreRef.current;

            // Find the server name for the toast
            const server = servers.find((s) => s.id === bannedServerId);
            const serverName = server?.name || 'the server';

            // If user is currently viewing this server, navigate away
            if (currentServer?.id === bannedServerId) {
              setCurrentServer(null);
              toast.error(`You have been banned from ${serverName}`);
            }

            // Refresh the servers list to remove the server
            await fetchServers(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
};
