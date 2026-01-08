import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { toast } from '@/hooks/use-toast';

export const useRealtimeMembers = (serverId: string | null) => {
  // Use ref to avoid recreating subscription when store function changes
  const fetchMembersRef = useRef(useServerStore.getState().fetchMembers);

  // Keep ref updated
  useEffect(() => {
    return useServerStore.subscribe((state) => {
      fetchMembersRef.current = state.fetchMembers;
    });
  }, []);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId]);
};
