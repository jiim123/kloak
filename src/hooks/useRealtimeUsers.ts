import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDMStore } from '@/stores/dmStore';
import type { User } from '@/types';

export const useRealtimeUsers = () => {
  useEffect(() => {
    const channel = supabase
      .channel('users-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          const updatedUser = payload.new as User;
          // Patch current server members in-place (avoid refetch storms from last_seen heartbeats)
          useServerStore.setState((state) => {
            if (!state.currentServer || state.members.length === 0) return {};
            let changed = false;
            const members = state.members.map((m) => {
              if (m.user_id !== updatedUser.id) return m;
              changed = true;
              return {
                ...m,
                user: m.user ? { ...m.user, ...updatedUser } : updatedUser,
              };
            });
            return changed ? { members } : {};
          });

          // Patch friend lists (Friends UI uses friendStore data, not serverStore members)
          useFriendStore.setState((state) => {
            type HasId = { id: string };
            const patch = <T extends HasId>(list: T[]): { list: T[]; changed: boolean } => {
              let changed = false;
              const next = list.map((item) => {
                if (item.id !== updatedUser.id) return item;
                changed = true;
                return { ...item, ...updatedUser } as T;
              });
              return changed ? { list: next, changed } : { list, changed: false };
            };

            const friends = patch(state.friends);
            const pendingRequests = patch(state.pendingRequests);
            const outgoingRequests = patch(state.outgoingRequests);
            const blockedUsers = patch(state.blockedUsers);

            if (!friends.changed && !pendingRequests.changed && !outgoingRequests.changed && !blockedUsers.changed) {
              return {};
            }

            return {
              friends: friends.list,
              pendingRequests: pendingRequests.list,
              outgoingRequests: outgoingRequests.list,
              blockedUsers: blockedUsers.list,
            };
          });

          // Patch DM conversations (header/avatar presence, etc.)
          useDMStore.setState((state) => {
            if (!state.currentConversation && state.conversations.length === 0) return {};

            let changed = false;
            const conversations = state.conversations.map((c) => {
              if (c.other_user?.id !== updatedUser.id) return c;
              changed = true;
              return { ...c, other_user: { ...c.other_user, ...updatedUser } };
            });

            const currentConversation =
              state.currentConversation?.other_user?.id === updatedUser.id
                ? { ...state.currentConversation, other_user: { ...state.currentConversation.other_user, ...updatedUser } }
                : state.currentConversation;

            return changed || currentConversation !== state.currentConversation
              ? { conversations, currentConversation }
              : {};
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
