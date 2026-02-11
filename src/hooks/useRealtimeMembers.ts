import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { toast } from '@/hooks/use-toast';
import { useRealtimeUserUpdates } from './useRealtimeUserUpdates';

export const useRealtimeMembers = (serverId: string | null) => {
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
      // Throttle: only refresh if at least 10s since last fetch
      const now = Date.now();
      if (now - lastRefresh < 10_000) return;
      lastRefresh = now;
      fetchMembersRef.current(serverId);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [serverId]);

  useEffect(() => {
    if (!serverId) return;

    const channel = supabase
      .channel(`members:${serverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'server_members',
          filter: `server_id=eq.${serverId}`,
        },
        async (payload) => {
          // Fetch the user info for the new member
          const { data: userData } = await supabase
            .from('users')
            .select('username, display_name')
            .eq('id', payload.new.user_id)
            .single();

          if (userData) {
            const displayName = userData.display_name || userData.username;
            toast({
              title: `${displayName} has joined the server!`,
              duration: 3000,
            });
          }

          fetchMembersRef.current(serverId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'server_members',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          fetchMembersRef.current(serverId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'server_members',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          fetchMembersRef.current(serverId);
        }
      )
      // Listen for role changes (server_roles table)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'server_roles',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          // Refresh both roles and members when a role is created
          fetchRolesRef.current(serverId);
          fetchMembersRef.current(serverId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'server_roles',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          // Refresh both roles and members when a role is updated
          fetchRolesRef.current(serverId);
          fetchMembersRef.current(serverId);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'server_roles',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          // Refresh both roles and members when a role is deleted
          fetchRolesRef.current(serverId);
          fetchMembersRef.current(serverId);
        }
      )
      // Listen for member role assignments (server_member_roles table)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'server_member_roles',
        },
        (payload) => {
          // Check if this member belongs to this server using current members list
          const { members } = useServerStore.getState();
          const memberExists = members.some(m => m.id === payload.new.member_id);
          
          if (memberExists) {
            // Refresh members when a role is assigned
            fetchMembersRef.current(serverId);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'server_member_roles',
        },
        (payload) => {
          // Check if this member belongs to this server using current members list
          const { members } = useServerStore.getState();
          const memberExists = members.some(m => m.id === payload.old.member_id);
          
          if (memberExists) {
            // Refresh members when a role is removed
            fetchMembersRef.current(serverId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId]);
};
