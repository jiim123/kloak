import { useEffect, useRef } from "react";
import { useFriendStore } from "@/stores/friendStore";
import { acquireChannel, subscribeChannel, releaseChannel } from '@/lib/sharedChannel';

export const useRealtimeFriendships = (userId: string | null) => {
  // FIX: Use ref for store function to stabilize effect deps.
  const fetchFriendsRef = useRef(useFriendStore.getState().fetchFriends);
  useEffect(() => {
    return useFriendStore.subscribe((state) => {
      fetchFriendsRef.current = state.fetchFriends;
    });
  }, []);

  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const topic = `user:${userId}`;

    const debouncedRefetch = (payload: any) => {
      const data = (payload.new as any) || (payload.old as any);
      if (!data) return;
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        fetchFriendsRef.current(userId, { force: true });
      }, 250);
    };

    const channel = acquireChannel(topic);
    channel.on(
      "broadcast",
      { event: "friendships" },
      debouncedRefetch,
    );
    subscribeChannel(topic);

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      releaseChannel(topic);
    };
  }, [userId]);
};
