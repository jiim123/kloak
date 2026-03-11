import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { toast } from '@/hooks/use-toast';
import { useRealtimeUserUpdates } from './useRealtimeUserUpdates';

export const useRealtimeMembers = (serverId: string | null, opts?: { full?: boolean }) => {
  const useFull = opts?.full === true;
  // Use refs to avoid recreating subscription when store functions change
  const fetchMembersRef = useRef(useServerStore.getState().fetchMembers);
  const fetchRolesRef = useRef(useServerStore.getState().fetchRoles);

  // Keep refs updated
  useEffect(() => {
    return useServerStore.subscribe((state) => {
      fetchMembersRef.current = state.fetchMembers;
      fetchRolesRef.current = state.fetchRoles;
    });
  }, []);

  // Get member user IDs for targeted user updates subscription
  const members = useServerStore((state) => state.members);
  const memberUserIds = members.map((m) => m.user_id);

  // Subscribe to user updates (status, avatar, etc.) for current server members
  useRealtimeUserUpdates(
    memberUserIds,
    `server-member-users:${serverId || 'none'}`,
  );

  // Re-fetch members when tab becomes visible (presence data goes stale in background)
  useEffect(() => {
    if (!serverId) return;

    let lastRefresh = Date.now();

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      // Throttle visibility refreshes; realtime handles most incremental updates.
      const now = Date.now();
      if (now - lastRefresh < 120_000) return;
      lastRefresh = now;
      fetchRolesRef.current(serverId);
      fetchMembersRef.current(serverId, { force: true, full: useFull });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [serverId, useFull]);

  useEffect(() => {
    if (!serverId) return;

    const channel = supabase
      .channel(`server:${serverId}`)
      .on('broadcast', { event: 'server_surface' }, ({ payload }) => {
        const event = payload as { table?: string } | null;
        if (!event?.table) return;

        if (event.table === 'server_members') {
          toast({
            title: 'Server members updated',
            duration: 2000,
          });
        }

        if (
          event.table === 'server_members' ||
          event.table === 'server_roles' ||
          event.table === 'server_member_roles'
        ) {
          fetchRolesRef.current(serverId, { force: true });
          fetchMembersRef.current(serverId, { force: true, full: useFull });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId, useFull]);
};
