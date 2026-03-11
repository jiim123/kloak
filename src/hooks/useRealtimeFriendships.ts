import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendStore } from "@/stores/friendStore";

export const useRealtimeFriendships = (userId: string | null) => {
  const { fetchFriends } = useFriendStore();
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
        fetchFriends(userId, { force: true });
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
  }, [userId, fetchFriends]);
};
