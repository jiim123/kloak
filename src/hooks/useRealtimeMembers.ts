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
      fetchMembersRef.current(serverId, { force: true, full: useFull });
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [serverId, useFull]);

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
          // Fetch the new member's full data and add to store incrementally
          const newMemberData = payload.new as { user_id: string; id: string; role: string; nickname: string | null; is_banned: boolean; is_muted: boolean; joined_at: string };
          
          // Skip banned members
          if (newMemberData.is_banned) return;

          // Fetch user info for the new member (use users_public view to respect privacy)
          const { data: userData } = await supabase
            .from('users_public')
            .select('id, username, display_name, avatar_url, avatar_decoration, banner_color, bio, status, custom_status, created_at, last_seen')
            .eq('id', newMemberData.user_id)
            .single();

          if (userData) {
            const displayName = userData.display_name || userData.username;
            toast({
              title: `${displayName} has joined the server!`,
              duration: 3000,
            });

            // Add member to store incrementally instead of full refetch
            useServerStore.setState((state) => {
              // Prevent duplicates
              if (state.members.some(m => m.id === newMemberData.id)) return {};
              return {
                members: [...state.members, {
                  id: newMemberData.id,
                  server_id: serverId,
                  user_id: newMemberData.user_id,
                  role: newMemberData.role as any,
                  nickname: newMemberData.nickname,
                  is_banned: newMemberData.is_banned,
                  is_muted: newMemberData.is_muted || false,
                  joined_at: newMemberData.joined_at,
                  user: userData as any,
                  roles: [],
                }],
              };
            });
          }
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
        (payload) => {
          const updated = payload.new as any;
          // Update member in-place instead of full refetch
          useServerStore.setState((state) => {
            let changed = false;
            const members = state.members
              .filter(m => {
                // Remove if now banned
                if (m.id === updated.id && updated.is_banned) {
                  changed = true;
                  return false;
                }
                return true;
              })
              .map(m => {
                if (m.id !== updated.id) return m;
                changed = true;
                return {
                  ...m,
                  role: updated.role ?? m.role,
                  nickname: updated.nickname ?? m.nickname,
                  is_muted: updated.is_muted ?? m.is_muted,
                  is_banned: updated.is_banned ?? m.is_banned,
                };
              });
            return changed ? { members } : {};
          });
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
        (payload) => {
          const deleted = payload.old as any;
          // Remove member from store incrementally
          useServerStore.setState((state) => {
            const filtered = state.members.filter(m => m.id !== deleted.id);
            if (filtered.length === state.members.length) return {};
            return { members: filtered };
          });
        }
      )
      // Listen for role changes (server_roles table)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'server_roles',
          filter: `server_id=eq.${serverId}`,
        },
        () => {
          // Refresh roles when any role changes, then refresh members for role assignments
          fetchRolesRef.current(serverId);
          fetchMembersRef.current(serverId, { force: true, full: useFull });
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
          const { members } = useServerStore.getState();
          const memberExists = members.some(m => m.id === payload.new.member_id);
          if (memberExists) {
            // Full refetch needed to get updated role data
            fetchMembersRef.current(serverId, { force: true, full: useFull });
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
          const { members } = useServerStore.getState();
          const memberExists = members.some(m => m.id === payload.old.member_id);
          if (memberExists) {
            fetchMembersRef.current(serverId, { force: true, full: useFull });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId, useFull]);
};
