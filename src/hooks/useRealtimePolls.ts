import { useEffect, useRef } from "react";
import { acquireChannel, releaseChannel, subscribeChannel } from "@/lib/sharedChannel";
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
  const listenerScopeRef = useRef(`polls-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!channelId) return;

    let expiryTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextExpiry = () => {
      if (expiryTimer) {
        clearTimeout(expiryTimer);
        expiryTimer = null;
      }

      const now = Date.now();
      const openPolls = Object.values(usePollStore.getState().pollsById).filter(
        (poll) => poll.channel_id === channelId && !poll.is_closed && poll.ends_at,
      );
      if (openPolls.length === 0) return;

      const nextExpiry = Math.min(...openPolls.map((poll) => new Date(poll.ends_at).getTime()));
      const delay = Math.max(0, nextExpiry - now + 250);
      expiryTimer = setTimeout(() => {
        if (document.visibilityState === "visible") {
          void usePollStore.getState().closeExpiredPolls(channelId).catch(() => undefined);
        }
        scheduleNextExpiry();
      }, delay);
    };

    scheduleNextExpiry();
    const unsubscribePolls = usePollStore.subscribe(scheduleNextExpiry);

    const topic = `chat:${channelId}`;
    const filter = { event: "polls", scope: listenerScopeRef.current };
    const channel = acquireChannel(topic).on(
      "broadcast",
      filter as { event: string },
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
    );
    subscribeChannel(topic);

    return () => {
      if (expiryTimer) clearTimeout(expiryTimer);
      unsubscribePolls();
      (channel as unknown as { _off?: (type: string, filter: Record<string, unknown>) => void })._off?.(
        "broadcast",
        filter,
      );
      releaseChannel(topic);
    };
  }, [channelId]);
};

