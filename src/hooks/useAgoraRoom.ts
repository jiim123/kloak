/**
 * LiveKit Room Hook (compat layer)
 * Keeps the old `useAgoraRoom` name + interface so the UI doesn’t need big changes.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  LogLevel,
  ParticipantEvent,
  Room,
  RoomEvent,
  Track,
  RemoteAudioTrack,
  setLogLevel,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoiceSettingsStore } from "@/stores/voiceSettingsStore";
import { pauseVoicePresenceWatch, resumeVoicePresenceWatch } from "@/hooks/useVoicePresenceWatchers";
import { playJoinSound, playLeaveSound } from "@/lib/voiceSounds";
import type { ScreenShareQuality } from "@/components/voice/ScreenShareQualityModal";
import type { RealtimeChannel } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgoraParticipant = {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isScreenSharing: boolean;
  audioTrack: RemoteAudioTrack | null;
  screenTrack: MediaStreamTrack | null;
  joinedAt: number;
  hideVoiceActivity: boolean;
};

type UseAgoraRoomOptions = {
  channelId: string | null;
  userId: string | null;
  displayName?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const QUALITY_PRESETS: Record<string, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

// Keep SDK logs quiet in production
setLogLevel(import.meta.env.PROD ? LogLevel.warn : LogLevel.info);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgoraRoom(opts: UseAgoraRoomOptions) {
  const { channelId, userId, displayName } = opts;

  const roomRef = useRef<Room | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const readyForSoundsRef = useRef(false);

  // Map uid → hideVoiceActivity
  const hideActivityRef = useRef<Map<string, boolean>>(new Map());

  const setJoinedChannelId = useVoiceStore((s) => s.setJoinedChannelId);
  const setConnection = useVoiceStore((s) => s.setConnection);
  const setControls = useVoiceStore((s) => s.setControls);
  const setPresence = useVoiceStore((s) => s.setPresence);
  const clearPresence = useVoiceStore((s) => s.clearPresence);

  const voiceSettings = useVoiceSettingsStore((s) => s.settings);

  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<AgoraParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareQuality, setScreenShareQuality] = useState<ScreenShareQuality | null>(null);

  // ------ participant rebuild ------
  const updateParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipants([]);
      return;
    }

    const all: AgoraParticipant[] = [];

    // Local participant
    if (userId) {
      const lp = room.localParticipant;
      const joinedAt = lp.joinedAt?.getTime?.() ?? Date.now();
      const screenPub = lp.getTrackPublication(Track.Source.ScreenShare);
      const screenTrackCandidate = (screenPub?.track as any)?.mediaStreamTrack ?? null;
      const screenTrack =
        isScreenSharing && screenTrackCandidate && screenTrackCandidate.readyState === "live"
          ? screenTrackCandidate
          : null;
      all.push({
        identity: userId,
        name: displayName || userId.slice(0, 8),
        isSpeaking: !!lp.isSpeaking,
        isMuted: !lp.isMicrophoneEnabled,
        // Use our local state as source of truth; LiveKit can lag briefly after disable.
        isScreenSharing,
        audioTrack: null, // local – no remote track
        screenTrack,
        joinedAt,
        hideVoiceActivity: hideActivityRef.current.get(userId) ?? false,
      });
    }

    // Remote participants
    for (const [, rp] of room.remoteParticipants) {
      const identity = rp.identity;
      const joinedAt = rp.joinedAt?.getTime?.() ?? Date.now();
      const micPub = rp.getTrackPublication(Track.Source.Microphone);
      const audioTrack = (micPub?.track as RemoteAudioTrack) ?? null;
      const screenPub = rp.getTrackPublication(Track.Source.ScreenShare);
      const screenTrack = (screenPub?.track as any)?.mediaStreamTrack ?? null;

      all.push({
        identity,
        name: identity.length > 8 ? identity.slice(0, 8) : identity,
        isSpeaking: !!rp.isSpeaking,
        isMuted: !rp.isMicrophoneEnabled,
        isScreenSharing: !!rp.isScreenShareEnabled,
        audioTrack,
        screenTrack,
        joinedAt,
        hideVoiceActivity: hideActivityRef.current.get(identity) ?? false,
      });
    }

    all.sort((a, b) => a.joinedAt - b.joinedAt);
    setParticipants(all);

    if (channelId) {
      setPresence(channelId, all.map((p) => p.identity));
    }
  }, [channelId, userId, displayName, isScreenSharing, setPresence]);

  // ------ JOIN ------
  const join = useCallback(async () => {
    if (!channelId || !userId) return;

    setStatus("joining");
    setError(null);
    setConnection({ channelId, status: "joining", error: null });
    pauseVoicePresenceWatch(channelId);

    try {
      // Get token from edge function
      const { data, error: fnError } = await supabase.functions.invoke("get-livekit-token", {
        body: { room: channelId, identity: userId, name: displayName },
      });

      if (fnError || !data?.token || !data?.url) {
        throw new Error(fnError?.message || data?.error || "Failed to get LiveKit token");
      }

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });
      roomRef.current = room;

      // Set up broadcast channel BEFORE connecting so privacy metadata sync is ready
      let broadcastCh: RealtimeChannel | null = null;
      try {
        broadcastCh = supabase.channel(`voice-meta:${channelId}`);

        broadcastCh.on("broadcast", { event: "hide-activity" }, ({ payload }) => {
          if (payload?.identity !== undefined && payload?.hide !== undefined) {
            hideActivityRef.current.set(payload.identity, payload.hide);
            updateParticipants();
          }
        });

        // Wait for broadcast channel to be ready before connecting
        await new Promise<void>((resolve) => {
          broadcastCh!.subscribe((s) => {
            if (s === "SUBSCRIBED") resolve();
          });
          setTimeout(resolve, 3000); // Timeout fallback
        });

        broadcastChannelRef.current = broadcastCh;
      } catch { /* non-critical */ }

      // ---- Room event listeners ----
      room
        .on(RoomEvent.ParticipantConnected, () => {
          updateParticipants();
          if (readyForSoundsRef.current) {
            const s = useVoiceSettingsStore.getState().settings;
            if (s.joinLeaveSound && !s.visualOnlyMode) playJoinSound();
          }
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          updateParticipants();
          if (readyForSoundsRef.current) {
            const s = useVoiceSettingsStore.getState().settings;
            if (s.joinLeaveSound && !s.visualOnlyMode) playLeaveSound();
          }
        })
        .on(RoomEvent.TrackSubscribed, () => updateParticipants())
        .on(RoomEvent.TrackUnsubscribed, () => updateParticipants())
        .on(RoomEvent.TrackMuted, () => updateParticipants())
        .on(RoomEvent.TrackUnmuted, () => updateParticipants())
        .on(RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub?.source === Track.Source.ScreenShare || pub?.source === Track.Source.ScreenShareAudio) {
            setIsScreenSharing(false);
            setScreenShareQuality(null);
          }
          updateParticipants();
        })
        .on(RoomEvent.ActiveSpeakersChanged, () => updateParticipants())
        .on(RoomEvent.ConnectionStateChanged, (s: ConnectionState) => {
          // Keep this log for debugging connectivity issues.
          console.log(`[LiveKit] Connection state: ${s}`);
        });

      // Local participant events
      room.localParticipant
        .on(ParticipantEvent.IsSpeakingChanged, () => updateParticipants())
        .on(ParticipantEvent.TrackMuted, () => updateParticipants())
        .on(ParticipantEvent.TrackUnmuted, () => updateParticipants());

      // Connect to LiveKit
      await room.connect(data.url, data.token);

      // Determine initial mute state
      const isPTTMode = voiceSettings.voiceMode === "push_to_talk";
      const shouldStartMuted = isPTTMode || voiceSettings.muteOnJoin;
      await room.localParticipant.setMicrophoneEnabled(!shouldStartMuted, {
        deviceId: voiceSettings.inputDeviceId || undefined,
        echoCancellation: voiceSettings.echoCancellation,
        noiseSuppression: voiceSettings.noiseSuppression,
        autoGainControl: voiceSettings.autoGainControl,
      });

      setStatus("joined");
      setConnection({ channelId, status: "joined", error: null });
      setJoinedChannelId(channelId);
      setIsMuted(shouldStartMuted);
      setControls({ muted: shouldStartMuted, deafened: false });
      updateParticipants();

      // Enable join/leave sounds after settling
      setTimeout(() => { readyForSoundsRef.current = true; }, 1500);

      // Supabase presence for sidebar
      try {
        const presenceCh = supabase.channel(`voice:${channelId}`, {
          config: { presence: { key: userId } },
        });
        presenceCh.subscribe(async (s) => {
          if (s === "SUBSCRIBED") {
            await presenceCh.track({ user_id: userId });
          }
        });
        presenceChannelRef.current = presenceCh;
      } catch { /* non-critical */ }

      // Publish hide-activity preference after connect
      if (broadcastCh) {
        broadcastCh.send({
          type: "broadcast",
          event: "hide-activity",
          payload: { identity: userId, hide: voiceSettings.hideVoiceActivity },
        }).catch(() => {});
      }
    } catch (err) {
      console.error("Failed to join LiveKit room:", err);
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      setStatus("error");
      setConnection({ channelId: null, status: "error", error: message });
      if (channelId) resumeVoicePresenceWatch(channelId);
    }
  }, [channelId, userId, displayName, updateParticipants, setConnection, setJoinedChannelId, setControls, setPresence, voiceSettings]);

  // ------ LEAVE ------
  const leave = useCallback(async () => {
    // Guard: only the instance that actually owns a room should perform
    // the full leave sequence and reset the shared Zustand store.  Without
    // this check, the always-mounted mobile VoicePersistentHost (which has
    // no room) would reset the store instantly, unmounting the desktop
    // instance before its room.disconnect() completes.
    const hadRoom = !!roomRef.current;

    readyForSoundsRef.current = false;

    // Cleanup broadcast channel
    const broadcastCh = broadcastChannelRef.current;
    if (broadcastCh) {
      try { supabase.removeChannel(broadcastCh); } catch { /* ignore */ }
      broadcastChannelRef.current = null;
    }

    // Cleanup presence
    const presenceCh = presenceChannelRef.current;
    if (presenceCh) {
      try { await presenceCh.untrack(); supabase.removeChannel(presenceCh); } catch { /* ignore */ }
      presenceChannelRef.current = null;
    }

    // Cleanup screen share tracks
    // LiveKit manages local track cleanup; we simply disconnect.
    const room = roomRef.current;
    if (room) {
      try { room.disconnect(); } catch { /* ignore */ }
      roomRef.current = null;
    }

    // Reset maps
    hideActivityRef.current.clear();

    // Only reset local state unconditionally
    setStatus("idle");
    setError(null);
    setParticipants([]);
    setIsMuted(false);
    setIsDeafened(false);
    setIsScreenSharing(false);
    setScreenShareQuality(null);

    // Only the instance that actually had an active Agora client should
    // reset the shared store – otherwise the non-connected twin resets
    // the store before the connected twin finishes client.leave().
    if (hadRoom) {
      setConnection({ channelId: null, status: "idle", error: null });
      setJoinedChannelId(null);
      setControls({ muted: false, deafened: false });

      // Immediately remove ourselves from the sidebar presence list
      if (channelId && userId) {
        const current = useVoiceStore.getState().presenceByChannel[channelId] ?? [];
        const without = current.filter((id) => id !== userId);
        if (without.length > 0) {
          setPresence(channelId, without);
        } else {
          clearPresence(channelId);
        }
      }
    }

    if (channelId) resumeVoicePresenceWatch(channelId);
  }, [channelId, userId, setConnection, setJoinedChannelId, setControls, setPresence, clearPresence]);

  // ------ MUTE / DEAFEN ------
  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const newMuted = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!newMuted);
    setIsMuted(newMuted);
    setControls({ muted: newMuted });
    updateParticipants();
  }, [isMuted, setControls, updateParticipants]);

  const toggleDeafen = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;

    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    setControls({ deafened: newDeafened });

    // When deafening, also mute
    if (newDeafened && !isMuted) {
      await room.localParticipant.setMicrophoneEnabled(false);
      setIsMuted(true);
      setControls({ muted: true, deafened: true });
    }

    // ParticipantAudioPlayer handles remote audio volume via the `muted` prop,
    // so we don't manipulate remote track volumes here to preserve per-user overrides.

    updateParticipants();
  }, [isDeafened, isMuted, setControls, updateParticipants]);

  // ------ SCREEN SHARE ------
  const startScreenShare = useCallback(async (quality: ScreenShareQuality) => {
    const room = roomRef.current;
    if (!room) return;

    try {
      const preset = QUALITY_PRESETS[quality.resolution];
      await room.localParticipant.setScreenShareEnabled(true, {
        resolution: { width: preset.width, height: preset.height },
        frameRate: quality.frameRate,
        audio: true,
      } as any);

      setIsScreenSharing(true);
      setScreenShareQuality(quality);
      updateParticipants();
    } catch (err) {
      console.error("Failed to start screen share:", err);
    }
  }, [updateParticipants]);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(false);
    } catch {
      // ignore
    }

    setIsScreenSharing(false);
    setScreenShareQuality(null);
    updateParticipants();
  }, [updateParticipants]);

  // ------ Cleanup on unmount ------
  useEffect(() => {
    return () => {
      readyForSoundsRef.current = false;
      const bc = broadcastChannelRef.current;
      if (bc) { try { supabase.removeChannel(bc); } catch {} }
      broadcastChannelRef.current = null;
      const pc = presenceChannelRef.current;
      if (pc) { try { pc.untrack(); supabase.removeChannel(pc); } catch {} }
      presenceChannelRef.current = null;
      const r = roomRef.current;
      if (r) {
        try { r.disconnect(); } catch {}
      }
      roomRef.current = null;
    };
  }, []);

  // ------ Sync input device mid-call ------
  useEffect(() => {
    const room = roomRef.current;
    if (status !== "joined" || !room) return;
    if (voiceSettings.inputDeviceId) room.switchActiveDevice("audioinput", voiceSettings.inputDeviceId).catch(() => {});
  }, [voiceSettings.inputDeviceId, status]);

  // ------ Sync output device mid-call ------
  useEffect(() => {
    const room = roomRef.current;
    if (status !== "joined" || !room) return;
    if (voiceSettings.outputDeviceId) room.switchActiveDevice("audiooutput", voiceSettings.outputDeviceId).catch(() => {});
  }, [voiceSettings.outputDeviceId, status]);

  // ------ Sync hideVoiceActivity setting ------
  useEffect(() => {
    const bc = broadcastChannelRef.current;
    if (!bc || status !== "joined" || !userId) return;
    bc.send({
      type: "broadcast",
      event: "hide-activity",
      payload: { identity: userId, hide: voiceSettings.hideVoiceActivity },
    }).catch(() => {});
    hideActivityRef.current.set(userId, voiceSettings.hideVoiceActivity);
    updateParticipants();
  }, [voiceSettings.hideVoiceActivity, status, userId, updateParticipants]);

  // ------ Expose room handle for PTT ------
  const roomHandle = useCallback(() => ({
    setMicEnabled: async (enabled: boolean) => {
      const room = roomRef.current;
      if (!room) return;
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
  }), []);

  return {
    status,
    error,
    isJoined: status === "joined",
    participants,
    localState: {
      muted: isMuted,
      deafened: isDeafened,
      sharing: isScreenSharing,
      shareQuality: screenShareQuality,
    },
    join,
    leave,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
    room: roomHandle(),
  };
}
