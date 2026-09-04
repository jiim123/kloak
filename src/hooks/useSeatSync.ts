import { useCallback, useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceStore } from "@/stores/voiceStore";

/**
 * Syncs living-room seat assignments between voice-channel participants
 * via a dedicated Supabase Realtime broadcast channel.
 */
export function useSeatSync(channelId: string | null, userId: string | null) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const setSeatAssignment = useVoiceStore((s) => s.setSeatAssignment);

  // Create / subscribe to the seat-sync channel
  useEffect(() => {
    if (!channelId || !userId) return;

    const ch = supabase.channel(`voice-seats:${channelId}`);

    ch.on("broadcast", { event: "seat-update" }, ({ payload }) => {
      if (payload?.userId && payload?.seatId !== undefined) {
        setSeatAssignment(channelId, payload.userId, payload.seatId || null);
      }
    });

    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channelRef.current = ch;
      }
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [channelId, userId, setSeatAssignment]);

  /** Broadcast a seat assignment to all other participants. */
  const broadcastSeat = useCallback(
    (seatId: string | null) => {
      const ch = channelRef.current;
      if (!ch || !userId || !channelId) return;

      // Update local store immediately
      setSeatAssignment(channelId, userId, seatId);

      // Broadcast to others
      ch.send({
        type: "broadcast",
        event: "seat-update",
        payload: { userId, seatId },
      }).catch(() => {});
    },
    [channelId, userId, setSeatAssignment],
  );

  return { broadcastSeat };
}
