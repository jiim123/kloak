import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useServerStore } from '@/stores/serverStore';
import { useFriendStore } from '@/stores/friendStore';
import { useDMStore } from '@/stores/dmStore';
import { useAuthStore } from '@/stores/authStore';
import type { User } from '@/types';

/**
 * Patches user data across all relevant stores (server members, friends, DMs).
 * Exported so other components can use it for manual updates.
 */
export const patchUserAcrossStores = (updatedUser: Partial<User> & { id: string }) => {
  // Patch current server members in-place
  useServerStore.setState((state) => {
    if (!state.currentServer || state.members.length === 0) return {};
    let changed = false;
    const members = state.members.map((m) => {
      if (m.user_id !== updatedUser.id) return m;
      changed = true;
      return {
        ...m,
        user: m.user ? { ...m.user, ...updatedUser } : (updatedUser as User),
      };
    });
    return changed ? { members } : {};
  });

  // Patch friend lists
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

  // Patch DM conversations
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
};

/**
 * Hook for real-time user presence updates across the app.
 * Subscribes to postgres_changes on users table and patches all stores.
 * Also includes a polling fallback for critical presence updates.
 */
export const useRealtimeUsers = () => {
  useEffect(() => {
    const channel = supabase
      .channel('users-status-global')
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
      .subscribe((status) => {
        console.log('[useRealtimeUsers] Subscription status:', status);
      });

    // Polling fallback: refetch friends and DM presence data periodically
    // This ensures presence is updated even if realtime events are missed
    const pollPresence = async () => {
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;

      // Check if we have friends or DMs that need updating
      const { friends } = useFriendStore.getState();
      const { conversations } = useDMStore.getState();

      if (friends.length === 0 && conversations.length === 0) return;

      // Collect user IDs we care about
      const userIds = new Set<string>();
      friends.forEach((f) => userIds.add(f.id));
      conversations.forEach((c) => {
        if (c.other_user?.id) userIds.add(c.other_user.id);
      });

      if (userIds.size === 0) return;

      // Fetch latest presence data for these users
      const { data, error } = await supabase
        .from('users')
        .select('id, status, last_seen')
        .in('id', Array.from(userIds));

      if (error || !data) return;

      // Patch each user's presence
      data.forEach((user) => {
        patchUserAcrossStores({
          id: user.id,
          status: user.status,
          last_seen: user.last_seen,
        });
      });
    };

    // Poll immediately on mount, then every 15 seconds
    pollPresence();
    const pollInterval = setInterval(pollPresence, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, []);
};

/**
 * Hook to subscribe to real-time updates for a specific user.
 * Useful for user profile popups and other single-user views.
 */
export const useRealtimeSingleUser = (
  userId: string | null | undefined,
  onUpdate: (user: User) => void
) => {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`user-presence-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          const updatedUser = payload.new as User;
          onUpdateRef.current(updatedUser);
          // Also patch stores for consistency
          patchUserAcrossStores(updatedUser);
        }
      )
      .subscribe((status) => {
        console.log(`[useRealtimeSingleUser] Subscription for ${userId}:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
};
