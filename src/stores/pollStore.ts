import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { Poll } from "@/types";

type PollRow = any;

// Avoid spamming `close_expired_polls` when rapidly switching channels / resubscribing.
const CLOSE_EXPIRED_COOLDOWN_MS = 60_000;
const closeExpiredInFlight = new Map<string, Promise<number>>();
const closeExpiredLastRunAt = new Map<string, number>();

// -----------------------------------------------------------------------------
// Poll fetch micro-batching (prevents N+1 `polls` + `get_user_poll_votes` requests)
// -----------------------------------------------------------------------------
type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
const pollFetchInflight = new Map<string, Deferred<PollWithVotes | null>>(); // key: `${pollId}:${userIdKey}`
const pendingPollIdsByUser = new Map<string, Set<string>>(); // userIdKey -> pollIds
let pollFlushTimer: ReturnType<typeof setTimeout> | null = null;

function userKey(userId?: string) {
  return userId ?? "__anon__";
}

function schedulePollFlush() {
  if (pollFlushTimer) return;
  pollFlushTimer = setTimeout(() => {
    pollFlushTimer = null;
    flushPendingPollFetches().catch(() => undefined);
  }, 25);
}

async function flushPendingPollFetches() {
  const entries = Array.from(pendingPollIdsByUser.entries());
  pendingPollIdsByUser.clear();
  if (entries.length === 0) return;

  // Process each user bucket independently (votes are user-specific).
  await Promise.all(
    entries.map(async ([uKey, idsSet]) => {
      const ids = Array.from(idsSet);
      if (ids.length === 0) return;

      try {
        // 1) Fetch polls in one query
        const { data: pollRows, error: pollErr } = await (supabase.from("polls") as any).select("*").in("id", ids);
        if (pollErr) throw pollErr;

        const rows: PollRow[] = Array.isArray(pollRows) ? pollRows : [];
        const rowById = new Map<string, PollRow>();
        for (const row of rows) {
          if (row?.id) rowById.set(row.id, row);
        }

        // 2) Fetch this user's votes for all polls in one query (instead of N RPCs)
        const votesByPollId = new Map<string, number[]>();
        if (uKey !== "__anon__") {
          const { data: voteRows, error: voteErr } = await supabase
            .from("poll_votes")
            .select("poll_id, option_index")
            .eq("user_id", uKey)
            .in("poll_id", ids);
          if (voteErr) throw voteErr;

          for (const r of (voteRows ?? []) as any[]) {
            const pollId = r?.poll_id as string | undefined;
            const idx = typeof r?.option_index === "number" ? r.option_index : Number(r?.option_index);
            if (!pollId || !Number.isFinite(idx)) continue;
            const cur = votesByPollId.get(pollId) ?? [];
            cur.push(idx);
            votesByPollId.set(pollId, cur);
          }

          // sort and de-dupe
          for (const [pid, arr] of votesByPollId) {
            votesByPollId.set(pid, Array.from(new Set(arr)).sort((a, b) => a - b));
          }
        }

        // Resolve all deferreds for this bucket
        for (const pollId of ids) {
          const key = `${pollId}:${uKey}`;
          const deferred = pollFetchInflight.get(key);
          if (!deferred) continue;

          const row = rowById.get(pollId);
          if (!row) {
            deferred.resolve(null);
            pollFetchInflight.delete(key);
            continue;
          }

          const votes = votesByPollId.get(pollId) ?? [];
          const poll = normalizePoll(row, votes);
          // mark that votes were fetched for this user context (even if empty)
          (poll as any).userVotesFetched = uKey !== "__anon__";

          deferred.resolve(poll);
          pollFetchInflight.delete(key);
        }
      } catch (e) {
        // Fail closed: resolve inflight polls as null (don't poison cache)
        for (const pollId of ids) {
          const key = `${pollId}:${uKey}`;
          const deferred = pollFetchInflight.get(key);
          if (!deferred) continue;
          deferred.resolve(null);
          pollFetchInflight.delete(key);
        }
      }
    }),
  );
}

interface PollWithVotes extends Poll {
  userVotes: number[];
  /** internal: whether we've fetched this user's votes (even if empty) */
  userVotesFetched?: boolean;
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
      const uKey = userKey(userId);

      // Check if we have a cached poll. If userId is provided, only skip refetch
      // once we know votes were fetched for this user (even if there were none).
      const existing = get().pollsById[pollId];
      if (existing) {
        if (!userId) return existing;
        if ((existing as any).userVotesFetched) return existing;
      }

      // In-flight dedup / micro-batching
      const key = `${pollId}:${uKey}`;
      const inflight = pollFetchInflight.get(key);
      if (inflight) return await inflight.promise;

      let resolve!: (v: PollWithVotes | null) => void;
      let reject!: (e: unknown) => void;
      const promise = new Promise<PollWithVotes | null>((res, rej) => {
        resolve = res;
        reject = rej;
      });

      pollFetchInflight.set(key, { promise, resolve, reject });
      const setIds = pendingPollIdsByUser.get(uKey) ?? new Set<string>();
      setIds.add(pollId);
      pendingPollIdsByUser.set(uKey, setIds);
      schedulePollFlush();

      const poll = await promise;
      if (poll) get().upsertPoll(poll);
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
      (poll as any).userVotesFetched = true;
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
    if (!channelId) return 0;

    const existing = closeExpiredInFlight.get(channelId);
    if (existing) return existing;

    const now = Date.now();
    const lastRun = closeExpiredLastRunAt.get(channelId) ?? 0;
    if (now - lastRun < CLOSE_EXPIRED_COOLDOWN_MS) return 0;
    closeExpiredLastRunAt.set(channelId, now);

    const p = (async () => {
      try {
        const { data, error } = await supabase.rpc("close_expired_polls" as any, { _channel_id: channelId });
        if (error) return 0;
        return typeof data === "number" ? data : Number(data) || 0;
      } catch {
        return 0;
      } finally {
        const cur = closeExpiredInFlight.get(channelId);
        if (cur === p) closeExpiredInFlight.delete(channelId);
      }
    })();

    closeExpiredInFlight.set(channelId, p);
    return p;
  },
}));

