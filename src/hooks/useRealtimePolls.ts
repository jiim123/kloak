import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePollStore } from "@/stores/pollStore";
import type { Poll } from "@/types";

const normalizePoll = (row: any): Poll => {
  const resultsRaw = row?.results;
  const results: number[] = Array.isArray(resultsRaw)
    ? resultsRaw.map((v: any) => (typeof v === "number" ? v : Number(v) || 0))
    : [];

  return {
    id: row.id,
    message_id: row.message_id,
    channel_id: row.channel_id,
    created_by: row.created_by,
    question: row.question,
    options: Array.isArray(row.options) ? row.options : [],
    allow_multiple: !!row.allow_multiple,
    ends_at: row.ends_at,
    is_closed: !!row.is_closed,
    results,
    total_votes: typeof row.total_votes === "number" ? row.total_votes : Number(row.total_votes) || 0,
    created_at: row.created_at,
  };
};

export const useRealtimePolls = (channelId: string | null) => {
  const isSettingUpRef = useRef(false);

  useEffect(() => {
    if (!channelId) return;

    // Close any expired polls when entering a channel (best-effort)
    usePollStore
      .getState()
      .closeExpiredPolls(channelId)
      .catch(() => undefined);

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = () => {
      if (isSettingUpRef.current) return;
      isSettingUpRef.current = true;

      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }

      channel = supabase
        .channel(`polls:${channelId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "polls",
            filter: `channel_id=eq.${channelId}`,
          },
          (payload) => {
            try {
              if (payload.eventType === "DELETE") {
                const oldRow = payload.old as any;
                if (oldRow?.id) usePollStore.getState().removePoll(oldRow.id);
                return;
              }

              const row = payload.new as any;
              if (!row?.id) return;
              usePollStore.getState().upsertPoll(normalizePoll(row));
            } catch {
              // ignore
            }
          },
        )
        .subscribe(() => {
          isSettingUpRef.current = false;
        });
    };

    setup();

    return () => {
      isSettingUpRef.current = false;
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
    };
  }, [channelId]);
};

