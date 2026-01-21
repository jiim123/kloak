import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Poll } from "@/types";

type PollRow = any;

const normalizePoll = (row: PollRow): Poll => {
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

interface PollState {
  pollsById: Record<string, Poll>;

  getPoll: (pollId: string) => Poll | undefined;
  upsertPoll: (poll: Poll) => void;
  removePoll: (pollId: string) => void;

  fetchPoll: (pollId: string) => Promise<Poll | null>;
  votePoll: (pollId: string, userId: string, optionIndexes: number[]) => Promise<Poll | null>;
  closePoll: (pollId: string) => Promise<boolean>;
  closeExpiredPolls: (channelId: string) => Promise<number>;
}

export const usePollStore = create<PollState>((set, get) => ({
  pollsById: {},

  getPoll: (pollId) => get().pollsById[pollId],

  upsertPoll: (poll) =>
    set((state) => ({
      pollsById: {
        ...state.pollsById,
        [poll.id]: poll,
      },
    })),

  removePoll: (pollId) =>
    set((state) => {
      const { [pollId]: _, ...rest } = state.pollsById;
      return { pollsById: rest };
    }),

  fetchPoll: async (pollId) => {
    try {
      const existing = get().pollsById[pollId];
      if (existing) return existing;

      const { data, error } = await supabase.from("polls").select("*").eq("id", pollId).maybeSingle();
      if (error || !data) return null;

      const poll = normalizePoll(data);
      get().upsertPoll(poll);
      return poll;
    } catch (e) {
      return null;
    }
  },

  votePoll: async (pollId, userId, optionIndexes) => {
    try {
      const sanitized = Array.from(new Set(optionIndexes))
        .filter((n) => Number.isFinite(n))
        .map((n) => Math.trunc(n));

      const { data, error } = await supabase.rpc("vote_poll" as any, {
        _poll_id: pollId,
        _user_id: userId,
        _option_indexes: sanitized,
      });
      if (error || !data) return null;

      const poll = normalizePoll(data);
      get().upsertPoll(poll);
      return poll;
    } catch (e) {
      return null;
    }
  },

  closePoll: async (pollId) => {
    try {
      const { data, error } = await supabase.rpc("close_poll" as any, { _poll_id: pollId });
      if (error) return false;
      return !!data;
    } catch {
      return false;
    }
  },

  closeExpiredPolls: async (channelId) => {
    try {
      const { data, error } = await supabase.rpc("close_expired_polls" as any, { _channel_id: channelId });
      if (error) return 0;
      return typeof data === "number" ? data : Number(data) || 0;
    } catch {
      return 0;
    }
  },
}));

