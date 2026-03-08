import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { friendRequestRateLimiter } from '@/lib/security';
import type { User, Friendship, FriendWithUser, FriendshipStatus } from '@/types';

const FRIENDS_CACHE_TTL_MS = 45_000;
const friendsCachedAtByUser = new Map<string, number>();
const friendsInFlightByUser = new Map<string, Promise<void>>();

interface FriendState {
  friends: FriendWithUser[];
  pendingRequests: FriendWithUser[];
  outgoingRequests: FriendWithUser[];
  blockedUsers: FriendWithUser[];
  visibilityBlockedUserIds: string[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchFriends: (userId: string, opts?: { force?: boolean }) => Promise<void>;
  sendRequest: (userId: string, username: string) => Promise<boolean>;
  acceptRequest: (friendshipId: string, userId: string) => Promise<void>;
  declineRequest: (friendshipId: string, userId: string) => Promise<void>;
  removeFriend: (friendshipId: string, userId: string) => Promise<void>;
  blockUser: (userId: string, targetUserId: string) => Promise<void>;
  unblockUser: (userId: string, blockedUserId: string) => Promise<void>;

  // Realtime
  updateFriendship: (friendship: Friendship) => void;
  removeFriendship: (friendshipId: string) => void;
}

export const useFriendStore = create<FriendState>((set, get) => ({
  friends: [],
  pendingRequests: [],
  outgoingRequests: [],
  blockedUsers: [],
  visibilityBlockedUserIds: [],
  isLoading: false,
  error: null,

  fetchFriends: async (userId: string, opts?: { force?: boolean }) => {
    const force = opts?.force === true;
    const cachedAt = friendsCachedAtByUser.get(userId) ?? 0;
    if (!force && Date.now() - cachedAt < FRIENDS_CACHE_TTL_MS) {
      return;
    }

    const existing = friendsInFlightByUser.get(userId);
    if (existing) {
      return existing;
    }

    const p = (async () => {
      set({ isLoading: true, error: null });

      try {
        // Prefer single get_friend_dashboard RPC (1 round-trip); fallback to 5 RPCs for backward compat
        const dashboardRes = await supabase.rpc('get_friend_dashboard', { _user_id: userId });

        let friendsData: any[] = [];
        let pendingData: any[] = [];
        let outgoingData: any[] = [];
        let blockedData: any[] = [];
        let visibilityBlockedData: string[] = [];

        if (!dashboardRes.error && dashboardRes.data && typeof dashboardRes.data === 'object') {
          const d = dashboardRes.data as {
            friends?: any[];
            pending_requests?: any[];
            outgoing_requests?: any[];
            blocked_users?: any[];
            visibility_blocked_user_ids?: (string | unknown)[];
          };
          friendsData = Array.isArray(d.friends) ? d.friends : [];
          pendingData = Array.isArray(d.pending_requests) ? d.pending_requests : [];
          outgoingData = Array.isArray(d.outgoing_requests) ? d.outgoing_requests : [];
          blockedData = Array.isArray(d.blocked_users) ? d.blocked_users : [];
          const raw = Array.isArray(d.visibility_blocked_user_ids) ? d.visibility_blocked_user_ids : [];
          visibilityBlockedData = raw.filter((id: unknown): id is string => typeof id === 'string');
        } else {
          const [friendsRes, pendingRes, outgoingRes, blockedRes, visibilityBlockedRes] = await Promise.all([
            supabase.rpc('get_user_friends', { _user_id: userId }),
            supabase.rpc('get_pending_friend_requests', { _user_id: userId }),
            supabase.rpc('get_outgoing_friend_requests', { _user_id: userId }),
            supabase.rpc('get_blocked_users', { _user_id: userId }),
            supabase.rpc('get_blocked_user_ids_for_visibility', { _user_id: userId }),
          ]);
          if (friendsRes.error) throw friendsRes.error;
          if (pendingRes.error) throw pendingRes.error;
          if (outgoingRes.error) throw outgoingRes.error;
          if (blockedRes.error) throw blockedRes.error;
          if (visibilityBlockedRes.error) throw visibilityBlockedRes.error;
          friendsData = Array.isArray(friendsRes.data) ? friendsRes.data : [];
          pendingData = Array.isArray(pendingRes.data) ? pendingRes.data : [];
          outgoingData = Array.isArray(outgoingRes.data) ? outgoingRes.data : [];
          blockedData = Array.isArray(blockedRes.data) ? blockedRes.data : [];
          const visibilityBlockedDataRaw = Array.isArray(visibilityBlockedRes.data) ? visibilityBlockedRes.data : [];
          visibilityBlockedData = visibilityBlockedDataRaw.filter(
            (id: unknown): id is string => typeof id === 'string',
          );
        }

        const friends: FriendWithUser[] = friendsData.map((f: any) => ({
          ...f.user,
          friendship_id: f.id,
          friendship_status: f.status as FriendshipStatus,
          is_requester: false,
        }));

        const pendingRequests: FriendWithUser[] = pendingData.map((r: any) => ({
          ...r.user,
          friendship_id: r.id,
          friendship_status: 'pending' as FriendshipStatus,
          is_requester: false,
        }));

        const outgoingRequests: FriendWithUser[] = outgoingData.map((r: any) => ({
          ...r.user,
          friendship_id: r.id,
          friendship_status: 'pending' as FriendshipStatus,
          is_requester: true,
        }));

        const blockedUsers: FriendWithUser[] = blockedData.map((b: any) => ({
          ...b.user,
          friendship_id: b.id,
          friendship_status: 'blocked' as FriendshipStatus,
          is_requester: true,
        }));

        friendsCachedAtByUser.set(userId, Date.now());
        set({
          friends,
          pendingRequests,
          outgoingRequests,
          blockedUsers,
          visibilityBlockedUserIds: visibilityBlockedData,
          isLoading: false,
        });
      } catch (error) {
        console.error('Failed to fetch friends:', error);
        set({ error: 'Failed to load friends', isLoading: false });
      }
    })().finally(() => {
      const current = friendsInFlightByUser.get(userId);
      if (current === p) {
        friendsInFlightByUser.delete(userId);
      }
    });

    friendsInFlightByUser.set(userId, p);
    return p;
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
      // Use RPC function to send friend request
      const { data, error } = await supabase.rpc('send_friend_request', {
        _requester_id: userId,
        _addressee_username: username.toLowerCase().trim(),
      });

      if (error) {
        // Log full error details for debugging
        console.error('[sendRequest] RPC error:', JSON.stringify({ code: error.code, message: error.message, details: error.details, hint: error.hint }));
        const errorMsg = error.message || 'Failed to send friend request';
        set({ error: errorMsg });
        return false;
      }

      // Refresh friends list
      await get().fetchFriends(userId, { force: true });
      return true;
    } catch (error: any) {
      console.error('Failed to send friend request:', error);
      set({ error: error.message || 'Failed to send friend request' });
      return false;
    }
  },

  acceptRequest: async (friendshipId: string, userId: string) => {
    try {
      // Use RPC function to accept friend request
      const { error } = await supabase.rpc('accept_friend_request', {
        _friendship_id: friendshipId,
        _user_id: userId,
      });

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

  declineRequest: async (friendshipId: string, userId: string) => {
    try {
      // Use RPC function to decline friend request
      const { error } = await supabase.rpc('decline_friend_request', {
        _friendship_id: friendshipId,
        _user_id: userId,
      });

      if (error) throw error;

      set((state) => ({
        pendingRequests: state.pendingRequests.filter((r) => r.friendship_id !== friendshipId),
        outgoingRequests: state.outgoingRequests.filter((r) => r.friendship_id !== friendshipId),
      }));
    } catch (error) {
      console.error('Failed to decline friend request:', error);
    }
  },

  removeFriend: async (friendshipId: string, userId: string) => {
    try {
      // Use RPC function to remove friend
      const { error } = await supabase.rpc('remove_friend', {
        _friendship_id: friendshipId,
        _user_id: userId,
      });

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
      // Use RPC function to block user
      const { error } = await supabase.rpc('block_user', {
        _user_id: userId,
        _blocked_user_id: targetUserId,
      });

      if (error) throw error;

      await get().fetchFriends(userId, { force: true });
    } catch (error) {
      console.error('Failed to block user:', error);
    }
  },

  unblockUser: async (userId: string, blockedUserId: string) => {
    try {
      // Use RPC function to unblock user
      const { error } = await supabase.rpc('unblock_user', {
        _user_id: userId,
        _blocked_user_id: blockedUserId,
      });

      if (error) throw error;

      await get().fetchFriends(userId, { force: true });
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
