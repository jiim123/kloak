import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { toast } from '@/hooks/use-toast';

export const useRealtimeMembers = (serverId: string | null) => {
  const { fetchMembers } = useServerStore();

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

          fetchMembers(serverId);
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
          fetchMembers(serverId);
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
          fetchMembers(serverId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [serverId, fetchMembers]);
};
