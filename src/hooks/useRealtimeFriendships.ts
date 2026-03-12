import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendStore } from "@/stores/friendStore";

export const useRealtimeFriendships = (userId: string | null) => {
  // FIX: Use ref for store function to stabilize effect deps.
  // Previously, fetchFriends in deps caused the effect to re-run every render,
  // tearing down and recreating the channel subscription unnecessarily.
  const fetchFriendsRef = useRef(useFriendStore.getState().fetchFriends);
  useEffect(() => {
    return useFriendStore.subscribe((state) => {
      fetchFriendsRef.current = state.fetchFriends;
    });
  }, []);

  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

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

    const channel = supabase
      .channel(`user:${userId}`)
      .on(
        "broadcast",
        {
          event: "friendships",
        },
        debouncedRefetch,
      )
      .subscribe();

    return () => {
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [userId]);
};
