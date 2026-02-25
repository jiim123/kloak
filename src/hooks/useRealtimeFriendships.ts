import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendStore } from "@/stores/friendStore";

export const useRealtimeFriendships = (userId: string | null) => {
  const { fetchFriends } = useFriendStore();
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId) return;

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
        (payload) => {
          const data = (payload.new as any) || (payload.old as any);
          // Check if this friendship involves the current user
          if (data?.requester_id === userId || data?.addressee_id === userId) {
            // Coalesce bursts (e.g. insert/update/delete sequences) into one forced refresh.
            if (refetchTimerRef.current) {
              clearTimeout(refetchTimerRef.current);
            }
            refetchTimerRef.current = setTimeout(() => {
              refetchTimerRef.current = null;
              fetchFriends(userId, { force: true });
            }, 250);
          }
        },
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
