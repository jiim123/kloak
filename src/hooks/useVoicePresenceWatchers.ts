import { useEffect, useMemo } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceStore } from "@/stores/voiceStore";
import type { VoiceParticipantMeta } from "@/stores/voiceStore";
import { useFriendStore } from "@/stores/friendStore";

// Module-scoped watcher state so the voice join flow can temporarily pause watchers
// and avoid duplicate subscriptions to the same `voice:${channelId}` topic.
const watcherChannels = new Map<string, RealtimeChannel>();
const pausedChannelIds = new Set<string>();
let lastUserId: string | null = null;
let lastDesiredIds: Set<string> = new Set();

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
    const { userIds, meta } = extractPresenceData(state);
    const blocked = new Set(useFriendStore.getState().visibilityBlockedUserIds);
    const filtered = blocked.size > 0 ? userIds.filter((id) => !blocked.has(id)) : userIds;
    try {
      useVoiceStore.getState().setPresence(channelId, filtered);
      // Sync participant meta (muted/deafened) from presence payload
      const filteredMeta: Record<string, VoiceParticipantMeta> = {};
      for (const id of filtered) {
        if (meta[id]) filteredMeta[id] = meta[id];
      }
      useVoiceStore.getState().setParticipantMeta(channelId, filteredMeta);
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

export function pauseVoicePresenceWatch(channelId: string) {
  pausedChannelIds.add(channelId);
  const ch = watcherChannels.get(channelId);
  if (ch) {
    try {
      supabase.removeChannel(ch);
    } catch {
      // ignore
    }
    watcherChannels.delete(channelId);
  }
}

export function resumeVoicePresenceWatch(channelId: string) {
  pausedChannelIds.delete(channelId);
  if (!lastUserId) return;
  if (!lastDesiredIds.has(channelId)) return;
  ensureWatcher(channelId, lastUserId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function extractPresenceData(state: Record<string, unknown[]>): {
  userIds: string[];
  meta: Record<string, VoiceParticipantMeta>;
} {
  const userIds: string[] = [];
  const meta: Record<string, VoiceParticipantMeta> = {};
  Object.values(state || {}).forEach((entries) => {
    if (!Array.isArray(entries) || entries.length === 0) return;
    const last = entries[entries.length - 1];
    if (!isRecord(last)) return;
    const userId = typeof last.user_id === "string" ? last.user_id : null;
    if (userId) {
      userIds.push(userId);
      meta[userId] = {
        isMuted: last.is_muted === true,
        isDeafened: last.is_deafened === true,
      };
    }
  });
  return { userIds, meta };
}

/**
 * Subscribes to Supabase Realtime presence for voice channels so the sidebar can show
 * who is currently connected, even when you are not inside the voice channel UI.
 *
 * This does NOT call `track()` (so you won't show up as a participant just by viewing the sidebar).
 */
export function useVoicePresenceWatchers(opts: { channelIds: string[]; userId: string | null }) {
  const { channelIds, userId } = opts;
  const setPresence = useVoiceStore((s) => s.setPresence);
  const clearPresence = useVoiceStore((s) => s.clearPresence);

  const idsKey = useMemo(() => channelIds.slice().sort().join(","), [channelIds]);

  useEffect(() => {
    // If not authed yet, don't subscribe.
    if (!userId) return;

    const desired = new Set(channelIds);
    lastUserId = userId;
    lastDesiredIds = desired;

    // Unsubscribe removed watchers.
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

    // Subscribe missing watchers.
    for (const channelId of desired) {
      ensureWatcher(channelId, userId);
    }

    return () => {
      // On unmount: do nothing. These watchers are module-scoped and shared;
      // `ChannelSidebar` is expected to be mounted for the lifetime of the app shell.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, userId]);
}

