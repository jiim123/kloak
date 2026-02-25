import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePollStore } from "@/stores/pollStore";

interface PollWithVotes {
  id: string;
  message_id: string;
  channel_id: string;
  created_by: string;
  question: string;
  options: string[];
  allow_multiple: boolean;
  ends_at: string;
  is_closed: boolean;
  results: number[];
  total_votes: number;
  created_at: string;
  userVotes: number[];
}

type BroadcastMutationOp = "INSERT" | "UPDATE" | "DELETE";

type PollBroadcastRow = {
  id: string;
  message_id: string;
  channel_id: string;
  created_by?: string;
  question?: string;
  options?: string[];
  allow_multiple?: boolean;
  ends_at?: string;
  is_closed?: boolean;
  results?: number[];
  total_votes?: number;
  created_at?: string;
};

type BroadcastMutationPayload<T> = {
  op?: BroadcastMutationOp;
  new?: T;
  old?: T;
};

const normalizePollRow = (row: PollBroadcastRow, existingUserVotes: number[] = []): PollWithVotes => {
  const resultsRaw = row?.results;
  const results: number[] = Array.isArray(resultsRaw)
    ? resultsRaw.map((v) => (typeof v === "number" ? v : Number(v) || 0))
    : [];

  return {
    id: row.id,
    message_id: row.message_id,
    channel_id: row.channel_id,
    created_by: row.created_by ?? "",
    question: row.question ?? "",
    options: Array.isArray(row.options) ? row.options : [],
    allow_multiple: !!row.allow_multiple,
    ends_at: row.ends_at ?? "",
    is_closed: !!row.is_closed,
    results,
    total_votes: typeof row.total_votes === "number" ? row.total_votes : Number(row.total_votes) || 0,
    created_at: row.created_at ?? "",
    userVotes: existingUserVotes,
  };
};

export const useRealtimePolls = (channelId: string | null) => {
  const isSettingUpRef = useRef(false);

  useEffect(() => {
    if (!channelId) return;

    const hasKnownOpenPollsInChannel = () => {
      const pollsById = usePollStore.getState().pollsById;
      return Object.values(pollsById).some((p) => p.channel_id === channelId && !p.is_closed);
    };

    // Close any expired polls when entering a channel (best-effort)
    const closeExpired = () => {
      if (document.visibilityState !== "visible") return;
      if (!hasKnownOpenPollsInChannel()) return;
      usePollStore
        .getState()
        .closeExpiredPolls(channelId)
        .catch(() => undefined);
    };

    // Avoid an RPC on every channel switch when the channel has no known polls.
    closeExpired();

    // Also run every 30s to catch polls that expire while user is in the channel
    // but the PollMessage component may have unmounted (e.g. scrolled away)
    const interval = setInterval(closeExpired, 30_000);

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
        .channel(`chat:${channelId}`)
        .on(
          "broadcast",
          { event: "polls" },
          ({ payload }) => {
            try {
              const eventPayload = payload as BroadcastMutationPayload<PollBroadcastRow>;
              const op = eventPayload.op;
              if (!op) return;

              if (op === "DELETE") {
                const oldRow = eventPayload.old;
                if (oldRow?.id) usePollStore.getState().removePoll(oldRow.id);
                return;
              }

              const row = eventPayload.new;
              if (!row?.id) return;
               
              // Preserve existing user votes when updating from realtime
              const existingPoll = usePollStore.getState().pollsById[row.id];
              const existingUserVotes = existingPoll?.userVotes || [];
              usePollStore.getState().upsertPoll(normalizePollRow(row, existingUserVotes));

              // If this poll just expired but wasn't closed yet, close it
              if (!row.is_closed && row.ends_at && new Date(row.ends_at).getTime() <= Date.now()) {
                usePollStore.getState().closePoll(row.id).catch(() => undefined);
              }
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
      clearInterval(interval);
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

