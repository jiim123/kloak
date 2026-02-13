import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Poll } from "@/types";

type PollRow = any;

interface PollWithVotes extends Poll {
  userVotes: number[];
}

const normalizePoll = (row: PollRow, userVotes: number[] = []): PollWithVotes => {
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
    userVotes,
  };
};

interface PollState {
  pollsById: Record<string, PollWithVotes>;

  getPoll: (pollId: string) => PollWithVotes | undefined;
  upsertPoll: (poll: PollWithVotes) => void;
  removePoll: (pollId: string) => void;

  fetchPoll: (pollId: string, userId?: string) => Promise<PollWithVotes | null>;
  votePoll: (pollId: string, userId: string, optionIndexes: number[]) => Promise<PollWithVotes | null>;
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

  fetchPoll: async (pollId, userId) => {
    try {
      // Check if we have a cached poll with user votes already
      const existing = get().pollsById[pollId];
      if (existing && existing.userVotes.length > 0) return existing;

      const { data, error } = await (supabase.from("polls") as any).select("*").eq("id", pollId).maybeSingle();
      if (error || !data) return null;

      // Fetch user's votes if userId is provided
      let userVotes: number[] = [];
      if (userId) {
        const { data: votesData } = await supabase.rpc("get_user_poll_votes" as any, {
          _poll_id: pollId,
          _user_id: userId,
        });
        if (Array.isArray(votesData)) {
          userVotes = votesData;
        }
      }

      const poll = normalizePoll(data, userVotes);
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

      // After voting, the user's votes are the ones they just submitted
      const poll = normalizePoll(data, sanitized);
      get().upsertPoll(poll);
      return poll;
    } catch (e) {
      return null;
    }
  },

  closePoll: async (pollId) => {
    try {
      const { data, error } = await supabase.rpc("close_poll" as any, { _poll_id: pollId });
      if (error) {
        console.error("[closePoll] RPC error:", error.message, error);
        return false;
      }
      return !!data;
    } catch (e) {
      console.error("[closePoll] exception:", e);
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

