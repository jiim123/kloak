import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFriendStore } from "@/stores/friendStore";
import { acquireChannel, releaseChannel, subscribeChannel } from "@/lib/sharedChannel";

export interface ServerUnreadSummary {
  hasUnread: boolean;
  unreadCount: number;
  totalMentions: number;
  channelIds: string[];
}

type SummaryState = Record<string, ServerUnreadSummary>;

type ChannelReadBroadcastRow = {
  channel_id?: string;
};

type BroadcastMutationPayload<T> = {
  op?: "INSERT" | "UPDATE" | "DELETE";
  new?: T;
  old?: T;
};

const SUMMARY_POLL_INTERVAL_MS = 90_000;
const SUMMARY_FETCH_COOLDOWN_MS = 3_000;
const CHANNEL_READ_EVENT = "kloak:channel-read";

export const useServerUnreadSummary = (userId: string | null, serverIds: string[] = []) => {
  const [summaryByServerId, setSummaryByServerId] = useState<SummaryState>({});
  const [isLoading, setIsLoading] = useState(false);
  const fetchSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const lastFetchAtRef = useRef(0);
  const fetchSummaryRef = useRef<(opts?: { force?: boolean }) => Promise<void>>(async () => undefined);

  const serverIdsKey = useMemo(() => [...serverIds].sort().join(","), [serverIds]);

  const fetchSummary = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!userId || serverIds.length === 0) {
        setSummaryByServerId({});
        return;
      }

      const now = Date.now();
      if (!opts?.force && now - lastFetchAtRef.current < SUMMARY_FETCH_COOLDOWN_MS) {
        return;
      }

      lastFetchAtRef.current = now;
      const seq = ++fetchSeqRef.current;
      if (inFlightRef.current) {
        queuedRef.current = true;
        return;
      }

      inFlightRef.current = true;
      setIsLoading(true);

      try {
        const blockedUserIds = useFriendStore.getState().visibilityBlockedUserIds;
        const { data, error } = await supabase.rpc("get_user_server_unread_summary", {
          _user_id: userId,
          _blocked_user_ids: blockedUserIds.length > 0 ? blockedUserIds : [],
        });

        if (error) throw error;
        if (fetchSeqRef.current !== seq) return;

        const allowedServerIds = new Set(serverIds);
        const next: SummaryState = {};

        for (const row of Array.isArray(data) ? data : []) {
          if (!row?.server_id || !allowedServerIds.has(row.server_id)) continue;
          const unreadCount = Number(row.unread_count ?? 0);
          const totalMentions = Number(row.mention_count ?? 0);
          next[row.server_id] = {
            hasUnread: unreadCount > 0,
            unreadCount,
            totalMentions,
            channelIds: Array.isArray(row.channel_ids) ? row.channel_ids.filter((id: unknown) => typeof id === "string") : [],
          };
        }

        for (const serverId of serverIds) {
          if (!next[serverId]) {
            next[serverId] = { hasUnread: false, unreadCount: 0, totalMentions: 0, channelIds: [] };
          }
        }

        setSummaryByServerId(next);
      } catch (error) {
        console.error("Error fetching server unread summary:", error);
      } finally {
        if (fetchSeqRef.current === seq) {
          setIsLoading(false);
        }
        inFlightRef.current = false;
        if (queuedRef.current) {
          queuedRef.current = false;
          void fetchSummary({ force: true });
        }
      }
    },
    [serverIds, userId],
  );

  useEffect(() => {
    fetchSummaryRef.current = fetchSummary;
  }, [fetchSummary]);

  useEffect(() => {
    void fetchSummary();
  }, [fetchSummary, serverIdsKey]);

  useEffect(() => {
    if (!userId || serverIds.length === 0) return;
    const interval = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchSummaryRef.current();
    }, SUMMARY_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [serverIds.length, userId]);

  useEffect(() => {
    if (!userId) return;

    const topic = `user:${userId}`;
    const channel = acquireChannel(topic);
    channel.on("broadcast", { event: "channel_reads" }, ({ payload }) => {
      const eventPayload = payload as BroadcastMutationPayload<ChannelReadBroadcastRow>;
      if (!eventPayload?.op) return;
      void fetchSummaryRef.current({ force: true });
    });
    subscribeChannel(topic);

    return () => {
      releaseChannel(topic);
    };
  }, [userId]);

  useEffect(() => {
    const handler = () => {
      void fetchSummaryRef.current({ force: true });
    };

    window.addEventListener(CHANNEL_READ_EVENT, handler);
    return () => window.removeEventListener(CHANNEL_READ_EVENT, handler);
  }, []);

  useEffect(() => {
    let hiddenAt: number | null = null;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }

      if (document.visibilityState !== "visible") return;
      const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
      hiddenAt = null;
      if (hiddenFor > 0 && hiddenFor < 15_000) return;

      void fetchSummaryRef.current({ force: true });
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const clearServers = useCallback((serverIdsToClear: string[]) => {
    if (serverIdsToClear.length === 0) return;
    const clearSet = new Set(serverIdsToClear);
    setSummaryByServerId((prev) => {
      const next = { ...prev };
      for (const serverId of clearSet) {
        const current = next[serverId];
        if (!current) continue;
        next[serverId] = {
          ...current,
          hasUnread: false,
          unreadCount: 0,
          totalMentions: 0,
        };
      }
      return next;
    });
  }, []);

  const serverChannelsFromSummary = useMemo(() => {
    const result: Record<string, string[]> = {};
    for (const [serverId, summary] of Object.entries(summaryByServerId)) {
      if (summary.channelIds.length > 0) {
        result[serverId] = summary.channelIds;
      }
    }
    return result;
  }, [summaryByServerId]);

  return {
    summaryByServerId,
    serverChannelsFromSummary,
    isLoading,
    refetch: fetchSummary,
    clearServers,
  };
};
