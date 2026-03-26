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
  type VideoTrack,
  setLogLevel,
} from "livekit-client";
import { getKeyHash, supabase } from "@/integrations/supabase/client";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoiceSettingsStore } from "@/stores/voiceSettingsStore";
import { pauseVoicePresenceWatch, resumeVoicePresenceWatch } from "@/hooks/useVoicePresenceWatchers";
import { playJoinSound, playLeaveSound } from "@/lib/voiceSounds";
import type {
  ScreenShareFrameRate,
  ScreenShareQuality,
  ScreenShareResolution,
} from "@/components/voice/ScreenShareQualityModal";
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
  isCameraSharing: boolean;
  audioTrack: RemoteAudioTrack | null;
  screenTrack: VideoTrack | null;
  cameraTrack: VideoTrack | null;
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

const QUALITY_PRESETS: Record<ScreenShareResolution, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

const SCREEN_SHARE_BITRATES: Record<ScreenShareResolution, Record<ScreenShareFrameRate, number>> = {
  "720p": {
    15: 1_500_000,
    30: 2_000_000,
    60: 3_500_000,
  },
  "1080p": {
    15: 2_500_000,
    30: 5_000_000,
    60: 8_000_000,
  },
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
  const cameraOpInFlightRef = useRef<Promise<void> | null>(null);

  // Map uid → hideVoiceActivity
  const hideActivityRef = useRef<Map<string, boolean>>(new Map());

  const setJoinedChannelId = useVoiceStore((s) => s.setJoinedChannelId);
  const setConnection = useVoiceStore((s) => s.setConnection);
  const setControls = useVoiceStore((s) => s.setControls);
  const setPresence = useVoiceStore((s) => s.setPresence);
  const setParticipantMeta = useVoiceStore((s) => s.setParticipantMeta);
  const clearPresence = useVoiceStore((s) => s.clearPresence);

  const voiceSettings = useVoiceSettingsStore((s) => s.settings);

  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<AgoraParticipant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraSharing, setIsCameraSharing] = useState(false);
  const [screenShareQuality, setScreenShareQuality] = useState<ScreenShareQuality | null>(null);

  // Helper to re-track presence with current mute/deafen state
  const retrackPresence = useCallback(async (muted: boolean, deafened: boolean) => {
    const ch = presenceChannelRef.current;
    if (!ch || !userId) return;
    try {
      await ch.track({ user_id: userId, is_muted: muted, is_deafened: deafened });
    } catch { /* non-critical */ }
  }, [userId]);

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
      const screenTrackCandidate = screenPub?.videoTrack ?? null;
      const localScreenActive =
        (isScreenSharing || !!lp.isScreenShareEnabled) &&
        !!screenTrackCandidate &&
        screenTrackCandidate.mediaStreamTrack.readyState === "live" &&
        !screenPub?.isMuted &&
        !screenTrackCandidate.isMuted;
      const screenTrack =
        localScreenActive
          ? screenTrackCandidate
          : null;
      const cameraPub = lp.getTrackPublication(Track.Source.Camera);
      const cameraTrackCandidate = cameraPub?.videoTrack ?? null;
      const localCameraActive =
        (isCameraSharing || !!lp.isCameraEnabled) &&
        !!cameraTrackCandidate &&
        cameraTrackCandidate.mediaStreamTrack.readyState === "live" &&
        !cameraPub?.isMuted &&
        !cameraTrackCandidate.isMuted;
      const cameraTrack =
        localCameraActive
          ? cameraTrackCandidate
          : null;
      all.push({
        identity: userId,
        name: displayName || userId.slice(0, 8),
        isSpeaking: !!lp.isSpeaking,
        isMuted: !lp.isMicrophoneEnabled,
        // Blend local intent with participant flags to survive transient republish/unpublish churn.
        isScreenSharing: localScreenActive,
        isCameraSharing: localCameraActive,
        audioTrack: null, // local - no remote track
        screenTrack,
        cameraTrack,
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
      const screenTrackCandidate = screenPub?.videoTrack ?? null;
      const isTrackLive = !!screenTrackCandidate && screenTrackCandidate.mediaStreamTrack.readyState === "live";
      const isTrackUsable =
        isTrackLive &&
        !screenPub?.isMuted &&
        !!screenPub?.isSubscribed &&
        !screenTrackCandidate.isMuted;
      const screenTrack =
        isTrackUsable
          ? screenTrackCandidate
          : null;
      const cameraPub = rp.getTrackPublication(Track.Source.Camera);
      const cameraTrackCandidate = cameraPub?.videoTrack ?? null;
      const isCameraTrackLive = !!cameraTrackCandidate && cameraTrackCandidate.mediaStreamTrack.readyState === "live";
      const isCameraTrackUsable =
        isCameraTrackLive &&
        !cameraPub?.isMuted &&
        !!cameraPub?.isSubscribed &&
        !cameraTrackCandidate.isMuted;
      const cameraTrack =
        isCameraTrackUsable
          ? cameraTrackCandidate
          : null;

      all.push({
        identity,
        name: identity.length > 8 ? identity.slice(0, 8) : identity,
        isSpeaking: !!rp.isSpeaking,
        isMuted: !rp.isMicrophoneEnabled,
        isScreenSharing: !!rp.isScreenShareEnabled && isTrackUsable,
        isCameraSharing: !!rp.isCameraEnabled && isCameraTrackUsable,
        audioTrack,
        screenTrack,
        cameraTrack,
        joinedAt,
        hideVoiceActivity: hideActivityRef.current.get(identity) ?? false,
      });
    }

    all.sort((a, b) => a.joinedAt - b.joinedAt);
    setParticipants(all);

    if (channelId) {
      setPresence(channelId, all.map((p) => p.identity));
      // Sync participant muted/deafened meta to voiceStore for sidebar display
      const meta: Record<string, { isMuted: boolean; isDeafened: boolean }> = {};
      for (const p of all) {
        meta[p.identity] = { isMuted: p.isMuted, isDeafened: false };
      }
      // Local user deafened state
      if (userId && meta[userId]) {
        meta[userId].isDeafened = isDeafened;
      }
      setParticipantMeta(channelId, meta);
    }
  }, [channelId, userId, displayName, isScreenSharing, isCameraSharing, setPresence, setParticipantMeta, isDeafened]);

  // ------ JOIN ------
  const join = useCallback(async () => {
    if (!channelId || !userId) return;

    setStatus("joining");
    setError(null);
    setConnection({ channelId, status: "joining", error: null });
    pauseVoicePresenceWatch(channelId);

    try {
      // Get token from edge function
      const keyHash = getKeyHash();
      if (!keyHash) {
        throw new Error("Missing auth credentials for voice token");
      }

      const { data, error: fnError } = await supabase.functions.invoke("get-livekit-token", {
        body: { room: channelId, identity: userId, name: displayName },
        headers: { "x-key-hash": keyHash },
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
        .on(RoomEvent.TrackPublished, () => updateParticipants())
        .on(RoomEvent.TrackUnpublished, () => updateParticipants())
        .on(RoomEvent.TrackSubscribed, () => updateParticipants())
        .on(RoomEvent.TrackUnsubscribed, () => updateParticipants())
        .on(RoomEvent.TrackMuted, () => updateParticipants())
        .on(RoomEvent.TrackUnmuted, () => updateParticipants())
        .on(RoomEvent.LocalTrackUnpublished, (pub) => {
          if (pub?.source === Track.Source.ScreenShare || pub?.source === Track.Source.ScreenShareAudio) {
            setIsScreenSharing(false);
            setScreenShareQuality(null);
          }
          if (pub?.source === Track.Source.Camera) {
            setIsCameraSharing(false);
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
      let joinedMuted = shouldStartMuted;
      let micWarning: string | null = null;
      const micOptions = {
        deviceId: voiceSettings.inputDeviceId || undefined,
        echoCancellation: voiceSettings.echoCancellation,
        noiseSuppression: voiceSettings.noiseSuppression,
        autoGainControl: voiceSettings.autoGainControl,
      };

      const toMicWarningMessage = (micErr: unknown) => {
        if (micErr instanceof DOMException) {
          if (micErr.name === "NotAllowedError") {
            return "Connected, but microphone permission is blocked. Enable mic access in your browser/OS settings.";
          }
          if (micErr.name === "NotFoundError") {
            return "Connected, but no microphone was found. Plug one in or choose another input device.";
          }
          if (micErr.name === "NotReadableError") {
            return "Connected, but microphone is busy or unavailable. Close other apps using it and try again.";
          }
        }
        return "Connected, but failed to start microphone. You joined muted.";
      };

      if (shouldStartMuted) {
        try {
          await room.localParticipant.setMicrophoneEnabled(false);
        } catch {
          // Ignore muted-start failures; user is still joined and can retry unmuting later.
        }
      } else {
        try {
          await room.localParticipant.setMicrophoneEnabled(true, micOptions);
        } catch (micErr) {
          let fallbackErr: unknown = micErr;

          // Common failure path: stale saved device ID after unplugging/changing devices.
          if (voiceSettings.inputDeviceId) {
            try {
              await room.localParticipant.setMicrophoneEnabled(true, {
                ...micOptions,
                deviceId: undefined,
              });
              fallbackErr = null;
              useVoiceSettingsStore.getState().updateSetting("inputDeviceId", null);
              console.warn("[LiveKit] Selected input device failed; fell back to default microphone");
            } catch (retryErr) {
              fallbackErr = retryErr;
            }
          }

          if (fallbackErr) {
            console.warn("[LiveKit] Failed to start microphone; staying connected and muted", fallbackErr);
            joinedMuted = true;
            micWarning = toMicWarningMessage(fallbackErr);
            try {
              await room.localParticipant.setMicrophoneEnabled(false);
            } catch {
              // Ignore cleanup failure.
            }
          }
        }
      }

      setStatus("joined");
      setConnection({ channelId, status: "joined", error: null });
      setJoinedChannelId(channelId);
      setIsMuted(joinedMuted);
      setControls({ muted: joinedMuted, deafened: false });
      if (micWarning) {
        setError(micWarning);
      }
      updateParticipants();

      // Enable join/leave sounds after settling
      setTimeout(() => { readyForSoundsRef.current = true; }, 1500);

      // Supabase presence for sidebar
      try {
        const presenceCh = supabase.channel(`voice:${channelId}`, {
          config: { presence: { key: userId } },
        });

        // Listen for presence changes so the sidebar updates live for the joiner too
        // (the watcher is paused while we're connected)
        const refreshPresence = () => {
          const state = presenceCh.presenceState() as Record<string, unknown[]>;
          const userIds: string[] = [];
          const metaMap: Record<string, { isMuted: boolean; isDeafened: boolean }> = {};
          Object.values(state || {}).forEach((entries) => {
            if (!Array.isArray(entries) || entries.length === 0) return;
            const last = entries[entries.length - 1] as Record<string, unknown> | undefined;
            if (!last || typeof last !== "object") return;
            const uid = typeof last.user_id === "string" ? last.user_id : null;
            if (uid) {
              userIds.push(uid);
              metaMap[uid] = {
                isMuted: last.is_muted === true,
                isDeafened: last.is_deafened === true,
              };
            }
          });
          const blocked = new Set(useFriendStore.getState().visibilityBlockedUserIds);
          const filtered = blocked.size > 0 ? userIds.filter((id) => !blocked.has(id)) : userIds;
          useVoiceStore.getState().setPresence(channelId, filtered);
          const filteredMeta: Record<string, { isMuted: boolean; isDeafened: boolean }> = {};
          for (const id of filtered) {
            if (metaMap[id]) filteredMeta[id] = metaMap[id];
          }
          useVoiceStore.getState().setParticipantMeta(channelId, filteredMeta);
        };

        presenceCh.on("presence", { event: "sync" }, refreshPresence);
        presenceCh.on("presence", { event: "join" }, refreshPresence);
        presenceCh.on("presence", { event: "leave" }, refreshPresence);

        presenceCh.subscribe(async (s) => {
          if (s === "SUBSCRIBED") {
            await presenceCh.track({ user_id: userId, is_muted: joinedMuted, is_deafened: false });
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
    setIsCameraSharing(false);
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
    retrackPresence(newMuted, isDeafened);
  }, [isMuted, isDeafened, setControls, updateParticipants, retrackPresence]);

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
      retrackPresence(true, true);
    } else {
      retrackPresence(isMuted, newDeafened);
    }

    // ParticipantAudioPlayer handles remote audio volume via the `muted` prop,
    // so we don't manipulate remote track volumes here to preserve per-user overrides.

    updateParticipants();
  }, [isDeafened, isMuted, setControls, updateParticipants, retrackPresence]);

  // ------ SCREEN SHARE ------
  const startScreenShare = useCallback(async (quality: ScreenShareQuality) => {
    const room = roomRef.current;
    if (!room) return;

    try {
      const preset = QUALITY_PRESETS[quality.resolution];
      await room.localParticipant.setScreenShareEnabled(
        true,
        {
          audio: true,
          contentHint: "detail",
          resolution: {
            width: preset.width,
            height: preset.height,
            frameRate: quality.frameRate,
          },
        },
        {
          screenShareEncoding: {
            maxBitrate: SCREEN_SHARE_BITRATES[quality.resolution][quality.frameRate],
            maxFramerate: quality.frameRate,
            priority: "medium",
          },
        }
      );

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

  // ------ CAMERA SHARE ------
  const toCameraWarningMessage = (cameraErr: unknown) => {
    if (cameraErr instanceof DOMException) {
      if (cameraErr.name === "NotAllowedError") {
        return "Camera permission is blocked. Enable camera access in your browser/OS settings.";
      }
      if (cameraErr.name === "NotFoundError") {
        return "No camera was found. Connect one and try again.";
      }
      if (cameraErr.name === "NotReadableError") {
        return "Camera is busy or unavailable. Close other apps using it and try again.";
      }
      if (cameraErr.name === "OverconstrainedError") {
        return "Camera constraints are not supported on this device. Try another camera.";
      }
    }
    return "Failed to start camera. Please try again.";
  };

  const isCameraPublishTimeoutError = (cameraErr: unknown): boolean => {
    if (!(cameraErr instanceof Error)) return false;
    return /pending publication promise timed out/i.test(cameraErr.message);
  };

  const startCameraShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (cameraOpInFlightRef.current) {
      await cameraOpInFlightRef.current;
      return;
    }

    const op = (async () => {
      try {
        await room.localParticipant.setCameraEnabled(true);
        setError(null);
        setIsCameraSharing(true);
        updateParticipants();
        return;
      } catch (initialErr) {
        try {
          // Retry with an explicit default videoinput to recover from stale browser device state.
          await room.switchActiveDevice("videoinput", "default");
        } catch {
          // Best effort only.
        }

        try {
          await room.localParticipant.setCameraEnabled(true, { deviceId: "default" });
          setError(null);
          setIsCameraSharing(true);
          updateParticipants();
          return;
        } catch (fallbackErr) {
          const finalErr = fallbackErr ?? initialErr;

          // LiveKit may keep a stale pending camera publication; clear and retry once.
          if (isCameraPublishTimeoutError(finalErr)) {
            try { await room.localParticipant.setCameraEnabled(false); } catch { /* ignore */ }
            await new Promise((resolve) => setTimeout(resolve, 150));
            try {
              await room.localParticipant.setCameraEnabled(true, { deviceId: "default" });
              setError(null);
              setIsCameraSharing(true);
              updateParticipants();
              return;
            } catch (retryErr) {
              setIsCameraSharing(false);
              setError(toCameraWarningMessage(retryErr));
              console.error("Failed to recover camera publish after timeout:", retryErr);
              return;
            }
          }

          setIsCameraSharing(false);
          setError(toCameraWarningMessage(finalErr));
          console.error("Failed to start camera share:", finalErr);
        }
      }
    })();

    cameraOpInFlightRef.current = op;
    try {
      await op;
    } finally {
      if (cameraOpInFlightRef.current === op) {
        cameraOpInFlightRef.current = null;
      }
    }
  }, [updateParticipants]);

  const stopCameraShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    if (cameraOpInFlightRef.current) {
      await cameraOpInFlightRef.current;
    }

    const op = (async () => {
      try {
        await room.localParticipant.setCameraEnabled(false);
      } catch {
        // ignore
      }
      setIsCameraSharing(false);
      updateParticipants();
    })();

    cameraOpInFlightRef.current = op;
    try {
      await op;
    } finally {
      if (cameraOpInFlightRef.current === op) {
        cameraOpInFlightRef.current = null;
      }
    }
  }, [updateParticipants]);

  // ------ Cleanup on unmount ------
  useEffect(() => {
    return () => {
      readyForSoundsRef.current = false;
      const bc = broadcastChannelRef.current;
      if (bc) {
        try { supabase.removeChannel(bc); } catch { /* ignore */ }
      }
      broadcastChannelRef.current = null;
      const pc = presenceChannelRef.current;
      if (pc) {
        try { pc.untrack(); supabase.removeChannel(pc); } catch { /* ignore */ }
      }
      presenceChannelRef.current = null;
      const r = roomRef.current;
      if (r) {
        try { r.disconnect(); } catch { /* ignore */ }
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
      cameraSharing: isCameraSharing,
      shareQuality: screenShareQuality,
    },
    join,
    leave,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
    startCameraShare,
    stopCameraShare,
    room: roomHandle(),
  };
}

