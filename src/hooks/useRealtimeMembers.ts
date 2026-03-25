import { useEffect, useRef } from 'react';
import { useServerStore } from '@/stores/serverStore';
import { toast } from '@/hooks/use-toast';
import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';

export const useRealtimeMembers = (serverId: string | null, opts?: { full?: boolean }) => {
  const useFull = opts?.full === true;
  const members = useServerStore((s) => s.members);

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

  // Re-fetch members when presence system detects a user came online
  // who isn't in the current members list, or a member went offline
  useEffect(() => {
    if (!serverId) return;

    let lastMemberIds = new Set(members.map((m) => m.user_id));
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;

    const handlePresenceChange = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail?.serverId || detail.serverId !== serverId) return;

      const userId = detail.userId;
      const newStatus = detail.status;

      if (!userId) return;

      const isInList = lastMemberIds.has(userId);
      const isComingOnline = newStatus !== 'offline' && !isInList;
      const isGoingOffline = newStatus === 'offline' && isInList;

      if (isComingOnline || isGoingOffline) {
        if (refetchTimer) clearTimeout(refetchTimer);
        refetchTimer = setTimeout(() => {
          fetchMembersRef.current(serverId, { full: useFull });
        }, 2000);
      }
    };

    window.addEventListener('kloak-presence-change', handlePresenceChange);

    return () => {
      window.removeEventListener('kloak-presence-change', handlePresenceChange);
      if (refetchTimer) clearTimeout(refetchTimer);
    };
  }, [serverId, members, useFull]);
};
