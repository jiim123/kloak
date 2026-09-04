import { useEffect, useMemo, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceStore } from "@/stores/voiceStore";
import { useFriendStore } from "@/stores/friendStore";
import { kloakSocket, isKloakSocketEnabled } from "@/lib/kloakSocket";

// Module-scoped watcher state so the voice join flow can temporarily pause watchers
// and avoid duplicate subscriptions to the same `voice:${channelId}` topic.
const watcherChannels = new Map<string, RealtimeChannel>();
const pausedChannelIds = new Set<string>();
let lastUserId: string | null = null;
let lastDesiredIds: Set<string> = new Set();

// ---- kloak-ws voice presence state ----
const kwsVoicePresence = new Map<string, Set<string>>(); // channelId -> Set<userId>
type KwsCleanup = () => void;
const kwsCleanups = new Map<string, KwsCleanup>();

function ensureWatcher(channelId: string, userId: string) {
  if (pausedChannelIds.has(channelId)) return;
  if (watcherChannels.has(channelId)) return;

  const ch = supabase.channel(`voice:${channelId}`, {
    config: {
      // Presence "key" is only used if we call track(); we don't.
      // Still provide a stable key so the server accepts presence config.
      presence: { key: `${userId}:watcher` },
    },
  });

  const refresh = () => {
    const state = ch.presenceState() as Record<string, unknown[]>;
    const userIds = extractUserIdsFromPresenceState(state);
    const blocked = new Set(useFriendStore.getState().visibilityBlockedUserIds);
    const filtered = blocked.size > 0 ? userIds.filter((id) => !blocked.has(id)) : userIds;
    try {
      useVoiceStore.getState().setPresence(channelId, filtered);
    } catch {
      // ignore
    }
  };

  ch.on("presence", { event: "sync" }, refresh);
  ch.on("presence", { event: "join" }, refresh);
  ch.on("presence", { event: "leave" }, refresh);

  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") refresh();
  });

  watcherChannels.set(channelId, ch);
}

function ensureKwsWatcher(channelId: string) {
  if (pausedChannelIds.has(channelId)) return;
  if (kwsCleanups.has(channelId)) return;

  const set = new Set<string>();
  kwsVoicePresence.set(channelId, set);

  const cleanup = kloakSocket.subscribe(`channel:${channelId}`, (event) => {
    if (event.event === "voice.join") {
      const payload = event.payload as { user_id?: string } | undefined;
      if (payload?.user_id) {
        set.add(payload.user_id);
        pushKwsPresence(channelId, set);
      }
    } else if (event.event === "voice.leave") {
      const payload = event.payload as { user_id?: string } | undefined;
      if (payload?.user_id) {
        set.delete(payload.user_id);
        pushKwsPresence(channelId, set);
      }
    }
  });

  kwsCleanups.set(channelId, cleanup);
}

function pushKwsPresence(channelId: string, set: Set<string>) {
  const blocked = new Set(useFriendStore.getState().visibilityBlockedUserIds);
  const arr = Array.from(set);
  const filtered = blocked.size > 0 ? arr.filter((id) => !blocked.has(id)) : arr;
  try {
    useVoiceStore.getState().setPresence(channelId, filtered);
  } catch {
    // ignore
  }
}

export function pauseVoicePresenceWatch(channelId: string) {
  pausedChannelIds.add(channelId);
  // Supabase path
  const ch = watcherChannels.get(channelId);
  if (ch) {
    try {
      supabase.removeChannel(ch);
    } catch {
      // ignore
    }
    watcherChannels.delete(channelId);
  }
  // kloak-ws path
  const kwsCleanup = kwsCleanups.get(channelId);
  if (kwsCleanup) {
    try {
      kwsCleanup();
    } catch {
      // ignore
    }
    kwsCleanups.delete(channelId);
    kwsVoicePresence.delete(channelId);
  }
}

export function resumeVoicePresenceWatch(channelId: string) {
  pausedChannelIds.delete(channelId);
  if (!lastUserId) return;
  if (!lastDesiredIds.has(channelId)) return;

  if (isKloakSocketEnabled()) {
    ensureKwsWatcher(channelId);
  } else {
    ensureWatcher(channelId, lastUserId);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function extractUserIdsFromPresenceState(state: Record<string, unknown[]>): string[] {
  const out: string[] = [];
  Object.values(state || {}).forEach((entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const last = entries[entries.length - 1];
    if (!isRecord(last)) return;
    const userId = typeof last.user_id === "string" ? last.user_id : null;
    if (userId) out.push(userId);
  });
  return out;
}

/**
 * Subscribes to voice-channel presence so the sidebar can show who is currently
 * connected, even when you are not inside the voice channel UI.
 *
 * When kloak-ws is enabled, uses kloak-ws channel events (voice.join / voice.leave).
 * Otherwise, falls back to Supabase Realtime presence.
 */
export function useVoicePresenceWatchers(opts: { channelIds: string[]; userId: string | null }) {
  const { channelIds, userId } = opts;
  const setPresence = useVoiceStore((s) => s.setPresence);
  const clearPresence = useVoiceStore((s) => s.clearPresence);

  const idsKey = useMemo(() => channelIds.slice().sort().join(","), [channelIds]);
  const useKws = isKloakSocketEnabled();

  useEffect(() => {
    // If not authed yet, don't subscribe.
    if (!userId) return;

    const desired = new Set(channelIds);
    lastUserId = userId;
    lastDesiredIds = desired;

    if (useKws) {
      // Unsubscribe removed kloak-ws watchers.
      for (const [id, cleanup] of kwsCleanups.entries()) {
        if (desired.has(id)) continue;
        try {
          cleanup();
        } catch {
          // ignore
        }
        kwsCleanups.delete(id);
        kwsVoicePresence.delete(id);
        clearPresence(id);
      }

      // Subscribe missing kloak-ws watchers.
      for (const channelId of desired) {
        ensureKwsWatcher(channelId);
      }
    } else {
      // Unsubscribe removed Supabase watchers.
      for (const [id, ch] of watcherChannels.entries()) {
        if (desired.has(id)) continue;
        try {
          supabase.removeChannel(ch);
        } catch {
          // ignore
        }
        watcherChannels.delete(id);
        clearPresence(id);
      }

      // Subscribe missing Supabase watchers.
      for (const channelId of desired) {
        ensureWatcher(channelId, userId);
      }
    }

    return () => {
      // On unmount: do nothing. These watchers are module-scoped and shared;
      // `ChannelSidebar` is expected to be mounted for the lifetime of the app shell.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, userId, useKws]);
}
