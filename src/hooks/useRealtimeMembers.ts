import { useEffect, useRef } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';

const activeServerIds = new Set<string>();

export const useRealtimeMembers = (serverId: string | null, opts?: { full?: boolean }) => {
  const useFull = opts?.full === true;

  // Use refs to avoid recreating subscription when store functions change
  const fetchMembersRef = useRef(useServerStore.getState().fetchMembers);
  const fetchRolesRef = useRef(useServerStore.getState().fetchRoles);

  // Only one instance per server should run the broadcast listener and visibility handler
  const isActiveInstanceRef = useRef(false);

  // Keep refs updated
  useEffect(() => {
    return useServerStore.subscribe((state) => {
      fetchMembersRef.current = state.fetchMembers;
      fetchRolesRef.current = state.fetchRoles;
    });
  }, []);

  // Instance registration — first mount for a serverId wins
  useEffect(() => {
    if (!serverId) return;

    if (activeServerIds.has(serverId)) {
      isActiveInstanceRef.current = false;
      return;
    }

    activeServerIds.add(serverId);
    isActiveInstanceRef.current = true;

    return () => {
      if (isActiveInstanceRef.current) {
        activeServerIds.delete(serverId);
      }
    };
  }, [serverId]);

  // Re-fetch members when tab becomes visible (presence data goes stale in background)
  useEffect(() => {
    if (!serverId) return;

    let lastRefresh = Date.now();

    const handleVisibility = () => {
      if (!isActiveInstanceRef.current) return;
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefresh < 60_000) return;
      lastRefresh = now;
      fetchRolesRef.current(serverId);
      fetchMembersRef.current(serverId, { force: true, full: useFull });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [serverId, useFull]);

  // Broadcast listener for member/role changes
  useEffect(() => {
    if (!serverId) return;

    const topic = `server:${serverId}`;
    const channel = acquireChannel(topic);
    channel.on('broadcast', { event: 'server_surface' }, ({ payload }) => {
      if (!isActiveInstanceRef.current) return;
      const event = payload as { table?: string } | null;
      if (!event?.table) return;

      if (
        event.table === 'server_members' ||
        event.table === 'server_roles' ||
        event.table === 'server_member_roles'
      ) {
        fetchRolesRef.current(serverId, { force: true });
        fetchMembersRef.current(serverId, { force: true, full: useFull });
      }
    });
    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [serverId, useFull]);
};
