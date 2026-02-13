/**
 * Agora RTC Room Hook
 * Replaces useLiveKitRoom — same interface, powered by agora-rtc-sdk-ng
 */

import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTC, {
  IAgoraRTCClient,
  IMicrophoneAudioTrack,
  ILocalVideoTrack,
  ILocalAudioTrack,
  IRemoteAudioTrack,
  IAgoraRTCRemoteUser,
  UID,
} from "agora-rtc-sdk-ng";
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
  audioTrack: IRemoteAudioTrack | null;
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

/** Deterministic numeric UID from UUID (first 8 hex chars → int32, ensure non-zero) */
function uuidToNumericUid(uuid: string): number {
  const hex = uuid.replace(/-/g, "").slice(0, 8);
  const num = parseInt(hex, 16) >>> 0; // unsigned 32-bit
  return num === 0 ? 1 : num;
}

const QUALITY_PRESETS: Record<string, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

// Disable Agora SDK logs in production
AgoraRTC.setLogLevel(3); // WARN
AgoraRTC.disableLogUpload(); // Prevent stats collector spam

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAgoraRoom(opts: UseAgoraRoomOptions) {
  const { channelId, userId, displayName } = opts;

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const screenVideoTrackRef = useRef<ILocalVideoTrack | null>(null);
  const screenAudioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null);
  const readyForSoundsRef = useRef(false);

  // Map numeric UID → user UUID for identity resolution
  const uidMapRef = useRef<Map<number, string>>(new Map());
  // Map uid → joinedAt timestamp
  const joinedAtRef = useRef<Map<number, number>>(new Map());
  // Map uid → hideVoiceActivity
  const hideActivityRef = useRef<Map<string, boolean>>(new Map());
  // Speaking map from volume indicator
  const speakingRef = useRef<Map<number, boolean>>(new Map());

  const setJoinedChannelId = useVoiceStore((s) => s.setJoinedChannelId);
  const setConnection = useVoiceStore((s) => s.setConnection);
  const setControls = useVoiceStore((s) => s.setControls);
  const setPresence = useVoiceStore((s) => s.setPresence);

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
    const client = clientRef.current;
    if (!client) {
      setParticipants([]);
      return;
    }

    const all: AgoraParticipant[] = [];

    // Local participant
    if (userId) {
      const localUid = uuidToNumericUid(userId);
      all.push({
        identity: userId,
        name: displayName || userId.slice(0, 8),
        isSpeaking: speakingRef.current.get(localUid) ?? false,
        isMuted: !(localAudioTrackRef.current?.enabled ?? false),
        isScreenSharing: !!screenVideoTrackRef.current,
        audioTrack: null, // local – no remote track
        screenTrack: screenVideoTrackRef.current?.getMediaStreamTrack() ?? null,
        joinedAt: joinedAtRef.current.get(localUid) ?? Date.now(),
        hideVoiceActivity: hideActivityRef.current.get(userId) ?? false,
      });
    }

    // Remote participants
    for (const remoteUser of client.remoteUsers) {
      const uid = remoteUser.uid as number;
      const identity = uidMapRef.current.get(uid) ?? String(uid);

      all.push({
        identity,
        name: identity.length > 8 ? identity.slice(0, 8) : identity,
        isSpeaking: speakingRef.current.get(uid) ?? false,
        isMuted: !remoteUser.hasAudio,
        isScreenSharing: remoteUser.hasVideo,
        audioTrack: (remoteUser.audioTrack as IRemoteAudioTrack) ?? null,
        screenTrack: remoteUser.videoTrack?.getMediaStreamTrack() ?? null,
        joinedAt: joinedAtRef.current.get(uid) ?? Date.now(),
        hideVoiceActivity: hideActivityRef.current.get(identity) ?? false,
      });
    }

    all.sort((a, b) => a.joinedAt - b.joinedAt);
    setParticipants(all);

    if (channelId) {
      setPresence(channelId, all.map((p) => p.identity));
    }
  }, [channelId, userId, displayName, setPresence]);

  // ------ JOIN ------
  const join = useCallback(async () => {
    if (!channelId || !userId) return;

    setStatus("joining");
    setError(null);
    setConnection({ channelId, status: "joining", error: null });
    pauseVoicePresenceWatch(channelId);

    try {
      // Get token from edge function
      const numericUid = uuidToNumericUid(userId);
      const { data, error: fnError } = await supabase.functions.invoke("agora-token", {
        body: { channelName: channelId, uid: numericUid },
      });

      if (fnError || !data?.token || !data?.appId) {
        throw new Error(fnError?.message || "Failed to get Agora token");
      }

      // Create client
      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      // Register UID mapping for local user
      uidMapRef.current.set(numericUid, userId);
      joinedAtRef.current.set(numericUid, Date.now());

      // Enable volume indicator for speaking detection
      client.enableAudioVolumeIndicator();

      // ---- Event listeners ----
      client.on("user-joined", (user: IAgoraRTCRemoteUser) => {
        const uid = user.uid as number;
        if (!joinedAtRef.current.has(uid)) {
          joinedAtRef.current.set(uid, Date.now());
        }
        updateParticipants();
        if (readyForSoundsRef.current) {
          const s = useVoiceSettingsStore.getState().settings;
          if (s.joinLeaveSound && !s.visualOnlyMode) playJoinSound();
        }
      });

      client.on("user-left", (user: IAgoraRTCRemoteUser) => {
        const uid = user.uid as number;
        uidMapRef.current.delete(uid);
        joinedAtRef.current.delete(uid);
        speakingRef.current.delete(uid);
        updateParticipants();
        if (readyForSoundsRef.current) {
          const s = useVoiceSettingsStore.getState().settings;
          if (s.joinLeaveSound && !s.visualOnlyMode) playLeaveSound();
        }
      });

      client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
        await client.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
        updateParticipants();
      });

      client.on("user-unpublished", (_user: IAgoraRTCRemoteUser, _mediaType: "audio" | "video") => {
        updateParticipants();
      });

      client.on("volume-indicator", (volumes) => {
        let changed = false;
        for (const v of volumes) {
          const wasSpeaking = speakingRef.current.get(v.uid as number) ?? false;
          const nowSpeaking = v.level > 5;
          if (wasSpeaking !== nowSpeaking) {
            speakingRef.current.set(v.uid as number, nowSpeaking);
            changed = true;
          }
        }
        if (changed) updateParticipants();
      });

      // Log connection state changes for debugging
      client.on("connection-state-change", (curState, prevState) => {
        console.log(`[Agora] Connection: ${prevState} → ${curState}`);
      });

      // Join channel
      await client.join(data.appId, channelId, data.token, numericUid);
      console.log(`[Agora] Successfully joined channel ${channelId} as UID ${numericUid}`);

      // Create mic track with audio processing settings
      const micTrack = await AgoraRTC.createMicrophoneAudioTrack({
        microphoneId: voiceSettings.inputDeviceId || undefined,
        AEC: voiceSettings.echoCancellation,
        ANS: voiceSettings.noiseSuppression,
        AGC: voiceSettings.autoGainControl,
        encoderConfig: voiceSettings.monoAudio ? { stereo: false } : undefined,
      });
      localAudioTrackRef.current = micTrack;

      // Determine initial mute state
      const isPTTMode = voiceSettings.voiceMode === "push_to_talk";
      const shouldStartMuted = isPTTMode || voiceSettings.muteOnJoin;
      if (shouldStartMuted) {
        micTrack.setEnabled(false);
      }

      await client.publish(micTrack);

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

      // Broadcast channel for hideVoiceActivity + UID mapping
      try {
        const broadcastCh = supabase.channel(`voice-meta:${channelId}`);

        broadcastCh.on("broadcast", { event: "uid-map" }, ({ payload }) => {
          if (payload?.uid && payload?.identity) {
            const isNew = !uidMapRef.current.has(payload.uid);
            uidMapRef.current.set(payload.uid, payload.identity);
            updateParticipants();
            // Handshake: if we learned a new peer, echo our own mapping so they learn ours
            if (isNew && payload.identity !== userId) {
              broadcastCh.send({
                type: "broadcast",
                event: "uid-map",
                payload: { uid: numericUid, identity: userId },
              }).catch(() => {});
            }
          }
        });

        broadcastCh.on("broadcast", { event: "hide-activity" }, ({ payload }) => {
          if (payload?.identity !== undefined && payload?.hide !== undefined) {
            hideActivityRef.current.set(payload.identity, payload.hide);
            updateParticipants();
          }
        });

        broadcastCh.subscribe(async (s) => {
          if (s === "SUBSCRIBED") {
            // Announce our UID mapping
            await broadcastCh.send({
              type: "broadcast",
              event: "uid-map",
              payload: { uid: numericUid, identity: userId },
            });
            // Announce hideVoiceActivity setting
            if (voiceSettings.hideVoiceActivity) {
              await broadcastCh.send({
                type: "broadcast",
                event: "hide-activity",
                payload: { identity: userId, hide: true },
              });
            }
          }
        });

        broadcastChannelRef.current = broadcastCh;
      } catch { /* non-critical */ }
    } catch (err) {
      console.error("Failed to join Agora channel:", err);
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      setStatus("error");
      setConnection({ channelId: null, status: "error", error: message });
      if (channelId) resumeVoicePresenceWatch(channelId);
    }
  }, [channelId, userId, displayName, updateParticipants, setConnection, setJoinedChannelId, setControls, setPresence, voiceSettings]);

  // ------ LEAVE ------
  const leave = useCallback(async () => {
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
    if (screenVideoTrackRef.current) {
      screenVideoTrackRef.current.close();
      screenVideoTrackRef.current = null;
    }
    if (screenAudioTrackRef.current) {
      screenAudioTrackRef.current.close();
      screenAudioTrackRef.current = null;
    }

    // Cleanup mic track
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }

    // Leave + destroy client
    const client = clientRef.current;
    if (client) {
      try { await client.leave(); } catch { /* ignore */ }
      clientRef.current = null;
    }

    // Reset maps
    uidMapRef.current.clear();
    joinedAtRef.current.clear();
    speakingRef.current.clear();
    hideActivityRef.current.clear();

    setStatus("idle");
    setError(null);
    setParticipants([]);
    setIsMuted(false);
    setIsDeafened(false);
    setIsScreenSharing(false);
    setScreenShareQuality(null);
    setConnection({ channelId: null, status: "idle", error: null });
    setJoinedChannelId(null);
    setControls({ muted: false, deafened: false });

    if (channelId) resumeVoicePresenceWatch(channelId);
  }, [channelId, setConnection, setJoinedChannelId, setControls]);

  // ------ MUTE / DEAFEN ------
  const toggleMute = useCallback(async () => {
    const track = localAudioTrackRef.current;
    if (!track) return;
    const newMuted = !isMuted;
    track.setEnabled(!newMuted);
    setIsMuted(newMuted);
    setControls({ muted: newMuted });
    updateParticipants();
  }, [isMuted, setControls, updateParticipants]);

  const toggleDeafen = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    setControls({ deafened: newDeafened });

    // When deafening, also mute
    if (newDeafened && !isMuted) {
      localAudioTrackRef.current?.setEnabled(false);
      setIsMuted(true);
      setControls({ muted: true, deafened: true });
    }

    // Mute/unmute all remote audio tracks
    for (const remoteUser of client.remoteUsers) {
      if (remoteUser.audioTrack) {
        remoteUser.audioTrack.setVolume(newDeafened ? 0 : 100);
      }
    }

    updateParticipants();
  }, [isDeafened, isMuted, setControls, updateParticipants]);

  // ------ SCREEN SHARE ------
  const startScreenShare = useCallback(async (quality: ScreenShareQuality) => {
    const client = clientRef.current;
    if (!client) return;

    try {
      const preset = QUALITY_PRESETS[quality.resolution];

      const screenTracks = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: {
            width: { ideal: preset.width, max: preset.width },
            height: { ideal: preset.height, max: preset.height },
            frameRate: { ideal: quality.frameRate, max: quality.frameRate },
            bitrateMax: quality.resolution === "1080p" ? 3000 : 1500,
          },
        },
        "auto" // captures system audio if available
      );

      // createScreenVideoTrack returns [video] or [video, audio]
      let videoTrack: ILocalVideoTrack;
      let audioTrack: ILocalAudioTrack | null = null;
      if (Array.isArray(screenTracks)) {
        videoTrack = screenTracks[0];
        audioTrack = screenTracks[1] ?? null;
      } else {
        videoTrack = screenTracks;
      }

      screenVideoTrackRef.current = videoTrack;
      screenAudioTrackRef.current = audioTrack;

      // Listen for browser "Stop sharing" click
      videoTrack.getMediaStreamTrack().onended = () => {
        stopScreenShare();
      };

      const tracksToPublish: (ILocalVideoTrack | ILocalAudioTrack)[] = [videoTrack];
      if (audioTrack) tracksToPublish.push(audioTrack);
      await client.publish(tracksToPublish);

      setIsScreenSharing(true);
      setScreenShareQuality(quality);
      updateParticipants();
    } catch (err) {
      console.error("Failed to start screen share:", err);
    }
  }, [updateParticipants]);

  const stopScreenShare = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    const tracksToUnpublish: (ILocalVideoTrack | ILocalAudioTrack)[] = [];
    if (screenVideoTrackRef.current) tracksToUnpublish.push(screenVideoTrackRef.current);
    if (screenAudioTrackRef.current) tracksToUnpublish.push(screenAudioTrackRef.current);

    if (tracksToUnpublish.length) {
      try { await client.unpublish(tracksToUnpublish); } catch { /* ignore */ }
    }

    screenVideoTrackRef.current?.close();
    screenVideoTrackRef.current = null;
    screenAudioTrackRef.current?.close();
    screenAudioTrackRef.current = null;

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
      screenVideoTrackRef.current?.close();
      screenAudioTrackRef.current?.close();
      localAudioTrackRef.current?.close();
      const c = clientRef.current;
      if (c) { c.leave().catch(() => {}); }
      clientRef.current = null;
    };
  }, []);

  // ------ Sync input device mid-call ------
  useEffect(() => {
    if (status !== "joined" || !localAudioTrackRef.current) return;
    if (voiceSettings.inputDeviceId) {
      localAudioTrackRef.current.setDevice(voiceSettings.inputDeviceId).catch(() => {});
    }
  }, [voiceSettings.inputDeviceId, status]);

  // ------ Sync output device mid-call ------
  useEffect(() => {
    if (status !== "joined" || !clientRef.current) return;
    if (voiceSettings.outputDeviceId) {
      for (const user of clientRef.current.remoteUsers) {
        if (user.audioTrack && "setPlaybackDevice" in user.audioTrack) {
          (user.audioTrack as any).setPlaybackDevice(voiceSettings.outputDeviceId).catch(() => {});
        }
      }
    }
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
      const track = localAudioTrackRef.current;
      if (track) track.setEnabled(enabled);
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
