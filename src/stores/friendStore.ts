import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { friendRequestRateLimiter } from '@/lib/security';
import type { User, Friendship, FriendWithUser, FriendshipStatus } from '@/types';

interface FriendState {
  friends: FriendWithUser[];
  pendingRequests: FriendWithUser[];
  outgoingRequests: FriendWithUser[];
  blockedUsers: FriendWithUser[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchFriends: (userId: string) => Promise<void>;
  sendRequest: (userId: string, username: string) => Promise<boolean>;
  acceptRequest: (friendshipId: string) => Promise<void>;
  declineRequest: (friendshipId: string) => Promise<void>;
  removeFriend: (friendshipId: string) => Promise<void>;
  blockUser: (userId: string, targetUserId: string) => Promise<void>;
  unblockUser: (friendshipId: string) => Promise<void>;

  // Realtime
  updateFriendship: (friendship: Friendship) => void;
  removeFriendship: (friendshipId: string) => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  outgoingRequests: [],
  blockedUsers: [],
  isLoading: false,
  error: null,

  fetchFriends: async (userId: string) => {
    set({ isLoading: true, error: null });

    try {
      // Fetch all friendships involving this user
      const { data, error } = await supabase
        .from('friendships')
        .select(`
          *,
          requester:users!friendships_requester_id_fkey (*),
          addressee:users!friendships_addressee_id_fkey (*)
        `)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

      if (error) throw error;

      const friends: FriendWithUser[] = [];
      const pendingRequests: FriendWithUser[] = [];
      const outgoingRequests: FriendWithUser[] = [];
      const blockedUsers: FriendWithUser[] = [];

      (data || []).forEach((friendship: any) => {
        const isRequester = friendship.requester_id === userId;
        const otherUser = isRequester ? friendship.addressee : friendship.requester;

        const friendWithUser: FriendWithUser = {
          ...otherUser,
          friendship_id: friendship.id,
          friendship_status: friendship.status,
          is_requester: isRequester,
        };

        switch (friendship.status) {
          case 'accepted':
            friends.push(friendWithUser);
            break;
          case 'pending':
            if (isRequester) {
              outgoingRequests.push(friendWithUser);
            } else {
              pendingRequests.push(friendWithUser);
            }
            break;
          case 'blocked':
            if (isRequester) {
              blockedUsers.push(friendWithUser);
            }
            break;
        }
      });

      set({
        friends,
        pendingRequests,
        outgoingRequests,
        blockedUsers,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch friends:', error);
      set({ error: 'Failed to load friends', isLoading: false });
    }
  },

  sendRequest: async (userId: string, username: string) => {
    set({ error: null });

    // Rate limit friend requests to prevent spam
    if (!friendRequestRateLimiter.isAllowed(userId)) {
      const remainingTime = friendRequestRateLimiter.getRemainingTime(userId);
      set({ error: `Too many requests. Try again in ${remainingTime} seconds` });
      return false;
    }

    try {
      // Find user by username
      const { data: targetUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username.toLowerCase().trim())
        .single();

      if (userError || !targetUser) {
        set({ error: 'User not found' });
        return false;
      }

      if (targetUser.id === userId) {
        set({ error: "You can't send a friend request to yourself" });
        return false;
      }

      // Check if friendship already exists
      const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${targetUser.id}),and(requester_id.eq.${targetUser.id},addressee_id.eq.${userId})`
        )
        .single();

      if (existing) {
        if (existing.status === 'blocked') {
          set({ error: 'Unable to send friend request' });
        } else if (existing.status === 'pending') {
          set({ error: 'Friend request already pending' });
        } else {
          set({ error: 'You are already friends with this user' });
        }
        return false;
      }

      // Create friendship request
      const { error: insertError } = await supabase
        .from('friendships')
        .insert({
          requester_id: userId,
          addressee_id: targetUser.id,
          status: 'pending',
        });

      if (insertError) throw insertError;

      // Refresh friends list
      await get().fetchFriends(userId);
      return true;
    } catch (error) {
      console.error('Failed to send friend request:', error);
      set({ error: 'Failed to send friend request' });
      return false;
    }
  },

  acceptRequest: async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

      if (error) throw error;

      set((state) => {
        const request = state.pendingRequests.find((r) => r.friendship_id === friendshipId);
        if (!request) return state;

        return {
          pendingRequests: state.pendingRequests.filter((r) => r.friendship_id !== friendshipId),
          friends: [...state.friends, { ...request, friendship_status: 'accepted' as FriendshipStatus }],
        };
      });
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  },

  declineRequest: async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      set((state) => ({
        pendingRequests: state.pendingRequests.filter((r) => r.friendship_id !== friendshipId),
        outgoingRequests: state.outgoingRequests.filter((r) => r.friendship_id !== friendshipId),
      }));
    } catch (error) {
      console.error('Failed to decline friend request:', error);
    }
  },

  removeFriend: async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      set((state) => ({
        friends: state.friends.filter((f) => f.friendship_id !== friendshipId),
      }));
    } catch (error) {
      console.error('Failed to remove friend:', error);
    }
  },

  blockUser: async (userId: string, targetUserId: string) => {
    try {
      // Check if friendship exists
      const { data: existing } = await supabase
        .from('friendships')
        .select('*')
        .or(
          `and(requester_id.eq.${userId},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${userId})`
        )
        .single();

      if (existing) {
        // Update existing to blocked
        const { error } = await supabase
          .from('friendships')
          .update({ status: 'blocked', requester_id: userId, addressee_id: targetUserId })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Create blocked friendship
        const { error } = await supabase
          .from('friendships')
          .insert({
            requester_id: userId,
            addressee_id: targetUserId,
            status: 'blocked',
          });

        if (error) throw error;
      }

      await get().fetchFriends(userId);
    } catch (error) {
      console.error('Failed to block user:', error);
    }
  },

  unblockUser: async (friendshipId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;

      set((state) => ({
        blockedUsers: state.blockedUsers.filter((u) => u.friendship_id !== friendshipId),
      }));
    } catch (error) {
      console.error('Failed to unblock user:', error);
    }
  },

  updateFriendship: (friendship) => {
    // Handled by refetching
  },

  removeFriendship: (friendshipId) => {
    set((state) => ({
      friends: state.friends.filter((f) => f.friendship_id !== friendshipId),
      pendingRequests: state.pendingRequests.filter((r) => r.friendship_id !== friendshipId),
      outgoingRequests: state.outgoingRequests.filter((r) => r.friendship_id !== friendshipId),
    }));
  },
}));
