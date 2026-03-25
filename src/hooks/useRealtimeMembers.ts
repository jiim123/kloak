import { useEffect, useRef } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { toast } from '@/hooks/use-toast';
import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUIStore } from '@/stores/uiStore';

export const useRealtimeMembers = (serverId: string | null, opts?: { full?: boolean }) => {
  const useFull = opts?.full === true;
  const isMobile = useIsMobile();
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);

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

  // Re-fetch members when tab becomes visible (presence data goes stale in background)
  useEffect(() => {
    if (!serverId) return;

    let lastRefresh = Date.now();

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastRefresh < 30_000) return;
      lastRefresh = now;
      fetchRolesRef.current(serverId);
      fetchMembersRef.current(serverId, { force: true, full: useFull });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [serverId, useFull]);

  useEffect(() => {
    if (!serverId) return;

    const topic = `server:${serverId}`;
    const channel = acquireChannel(topic);
    channel.on('broadcast', { event: 'server_surface' }, ({ payload }) => {
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

  // Poll members at moderate frequency to catch status-driven changes
  // (users coming online/offline update the `users` table, not `server_members`,
  // so the broadcast trigger doesn't fire for those)
  useEffect(() => {
    if (!serverId) return;
    if (!isMemberSidebarOpen && isMobile) return;

    const MEMBER_POLL_INTERVAL_MS = 30_000;

    const pollMembers = () => {
      if (document.visibilityState !== 'visible') return;
      fetchMembersRef.current(serverId, { full: useFull });
    };

    const intervalId = setInterval(pollMembers, MEMBER_POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [serverId, useFull, isMobile, isMemberSidebarOpen]);
};
