import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendStore } from "@/stores/friendStore";

export const useRealtimeFriendships = (userId: string | null) => {
  const { fetchFriends } = useFriendStore();
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

    // Subscribe to friendship changes where this user is involved.
    // Two filtered subscriptions (requester + addressee) instead of one unfiltered
    // to avoid receiving ALL friendship changes platform-wide (massive egress).
    const debouncedRefetch = (payload: any) => {
      const data = (payload.new as any) || (payload.old as any);
      if (!data) return;
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
      }
      refetchTimerRef.current = setTimeout(() => {
        refetchTimerRef.current = null;
        fetchFriends(userId, { force: true });
      }, 250);
    };

    const channel = supabase
      .channel(`friendships:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `requester_id=eq.${userId}`,
        },
        debouncedRefetch,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${userId}`,
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
  }, [userId, fetchFriends]);
};
