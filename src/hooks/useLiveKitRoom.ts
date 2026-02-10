import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  RemoteTrack,
  Participant,
  RemoteParticipant,
  LocalParticipant,
  ConnectionState,
  TrackPublication,
  RemoteTrackPublication,
  LocalTrackPublication,
} from "livekit-client";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoiceSettingsStore } from "@/stores/voiceSettingsStore";
import { pauseVoicePresenceWatch, resumeVoicePresenceWatch } from "@/hooks/useVoicePresenceWatchers";
import { playJoinSound, playLeaveSound } from "@/lib/voiceSounds";
import type { ScreenShareQuality } from "@/components/voice/ScreenShareQualityModal";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type LiveKitParticipant = {
  identity: string;
  name: string;
  isSpeaking: boolean;
  isMuted: boolean;
  isScreenSharing: boolean;
  audioTrack: RemoteTrack | null;
  screenTrack: MediaStreamTrack | null;
  joinedAt: number;
  hideVoiceActivity: boolean;
};

// Parse participant metadata safely
function parseParticipantMetadata(participant: Participant): { hideVoiceActivity?: boolean } {
  try {
    if (!participant.metadata) return {};
    return JSON.parse(participant.metadata);
  } catch {
    return {};
  }
}

type UseLiveKitRoomOptions = {
  channelId: string | null;
  userId: string | null;
  displayName?: string;
};

// Screen share quality presets
const QUALITY_PRESETS: Record<string, { width: number; height: number }> = {
  "720p": { width: 1280, height: 720 },
  "1080p": { width: 1920, height: 1080 },
};

export function useLiveKitRoom(opts: UseLiveKitRoomOptions) {
  const { channelId, userId, displayName } = opts;

  const roomRef = useRef<Room | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const readyForSoundsRef = useRef(false);
  const setJoinedChannelId = useVoiceStore((s) => s.setJoinedChannelId);
  const setConnection = useVoiceStore((s) => s.setConnection);
  const setControls = useVoiceStore((s) => s.setControls);
  const setPresence = useVoiceStore((s) => s.setPresence);
  
  // Get voice settings
  const voiceSettings = useVoiceSettingsStore((s) => s.settings);

  const [status, setStatus] = useState<"idle" | "joining" | "joined" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<LiveKitParticipant[]>([]);

  // Local state
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareQuality, setScreenShareQuality] = useState<ScreenShareQuality | null>(null);

  const updateParticipants = useCallback(() => {
    const room = roomRef.current;
    if (!room) {
      setParticipants([]);
      return;
    }

    const buildParticipant = (p: Participant, isLocal: boolean): LiveKitParticipant => {
      let audioTrack: RemoteTrack | null = null;
      let screenTrack: MediaStreamTrack | null = null;

      p.trackPublications.forEach((pub: TrackPublication) => {
        const track = pub.track;
        if (!track) return;
        if (pub.source === Track.Source.Microphone && track.kind === "audio" && !isLocal) {
          audioTrack = track as unknown as RemoteTrack;
        }
        if (pub.source === Track.Source.ScreenShare && track.kind === "video") {
          screenTrack = track.mediaStreamTrack;
        }
      });

      // Parse metadata to check hideVoiceActivity
      const metadata = parseParticipantMetadata(p);

      return {
        identity: p.identity,
        name: p.name || p.identity,
        isSpeaking: p.isSpeaking,
        isMuted: !p.isMicrophoneEnabled,
        isScreenSharing: p.isScreenShareEnabled,
        audioTrack,
        screenTrack,
        joinedAt: p.joinedAt?.getTime() ?? Date.now(),
        hideVoiceActivity: metadata.hideVoiceActivity ?? false,
      };
    };

    const allParticipants: LiveKitParticipant[] = [];

    // Local participant
    if (room.localParticipant) {
      allParticipants.push(buildParticipant(room.localParticipant, true));
    }

    // Remote participants
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      allParticipants.push(buildParticipant(p, false));
    });

    allParticipants.sort((a, b) => a.joinedAt - b.joinedAt);
    setParticipants(allParticipants);

    // Update voice store presence for sidebar
    if (channelId) {
      setPresence(channelId, allParticipants.map((p) => p.identity));
    }
  }, [channelId, setPresence]);

  const join = useCallback(async () => {
    if (!channelId || !userId) return;

    setStatus("joining");
    setError(null);
    setConnection({ channelId, status: "joining", error: null });

    // Pause the presence watcher to avoid duplicate subscriptions
    pauseVoicePresenceWatch(channelId);

    try {
      // Get token from edge function
      const { data, error: fnError } = await supabase.functions.invoke("livekit-token", {
        body: {
          roomName: channelId,
          participantIdentity: userId,
          participantName: displayName || userId.slice(0, 8),
        },
      });

      if (fnError || !data?.token || !data?.url) {
        throw new Error(fnError?.message || "Failed to get LiveKit token");
      }

      // Create room with user's voice settings
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          deviceId: voiceSettings.inputDeviceId || undefined,
          echoCancellation: voiceSettings.echoCancellation,
          noiseSuppression: voiceSettings.noiseSuppression,
          autoGainControl: voiceSettings.autoGainControl,
          channelCount: voiceSettings.monoAudio ? 1 : undefined,
        },
        audioOutput: {
          deviceId: voiceSettings.outputDeviceId || undefined,
        },
        publishDefaults: {
          dtx: true, // Discontinuous transmission for bandwidth savings
        },
      });

      roomRef.current = room;

      // Set up event listeners
      room.on(RoomEvent.ParticipantConnected, () => {
        updateParticipants();
        // Only play join sound after initial connection is settled
        if (readyForSoundsRef.current) {
          const settings = useVoiceSettingsStore.getState().settings;
          if (settings.joinLeaveSound && !settings.visualOnlyMode) {
            playJoinSound();
          }
        }
      });
      room.on(RoomEvent.ParticipantDisconnected, () => {
        updateParticipants();
        if (readyForSoundsRef.current) {
          const settings = useVoiceSettingsStore.getState().settings;
          if (settings.joinLeaveSound && !settings.visualOnlyMode) {
            playLeaveSound();
          }
        }
      });
      room.on(RoomEvent.TrackSubscribed, updateParticipants);
      room.on(RoomEvent.TrackUnsubscribed, updateParticipants);
      room.on(RoomEvent.TrackMuted, updateParticipants);
      room.on(RoomEvent.TrackUnmuted, updateParticipants);
      room.on(RoomEvent.LocalTrackPublished, updateParticipants);
      room.on(RoomEvent.LocalTrackUnpublished, updateParticipants);
      room.on(RoomEvent.ActiveSpeakersChanged, updateParticipants);
      room.on(RoomEvent.ParticipantMetadataChanged, updateParticipants); // Listen for metadata changes (hideVoiceActivity)
      room.on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
        if (state === ConnectionState.Disconnected) {
          setStatus("idle");
          setConnection({ channelId: null, status: "idle", error: null });
          setJoinedChannelId(null);
          if (channelId) {
            resumeVoicePresenceWatch(channelId);
          }
        }
      });

      // Connect to the room with audio enabled
      await room.connect(data.url, data.token);

      // Set initial hideVoiceActivity metadata
      if (voiceSettings.hideVoiceActivity) {
        try {
          await room.localParticipant.setMetadata(JSON.stringify({ hideVoiceActivity: true }));
        } catch (err) {
          console.error('Failed to set initial metadata:', err);
        }
      }

      // Determine if mic should start enabled
      // For PTT mode, always start muted (user must press key to talk)
      // For Voice Activity mode, respect muteOnJoin setting
      const isPTTMode = voiceSettings.voiceMode === 'push_to_talk';
      const shouldStartMuted = isPTTMode || voiceSettings.muteOnJoin;
      await room.localParticipant.setMicrophoneEnabled(!shouldStartMuted);

      setStatus("joined");
      setConnection({ channelId, status: "joined", error: null });
      setJoinedChannelId(channelId);
      setIsMuted(shouldStartMuted);
      setControls({ muted: shouldStartMuted, deafened: false });
      updateParticipants();

      // Enable join/leave sounds after a short delay so existing participants don't trigger them
      setTimeout(() => { readyForSoundsRef.current = true; }, 1500);

      // Track presence on Supabase so sidebar watchers can see who's in the channel
      try {
        const presenceCh = supabase.channel(`voice:${channelId}`, {
          config: { presence: { key: userId } },
        });
        presenceCh.subscribe(async (status) => {
          if (status === "SUBSCRIBED") {
            await presenceCh.track({ user_id: userId });
          }
        });
        presenceChannelRef.current = presenceCh;
      } catch {
        // Non-critical — sidebar just won't show this user
      }
    } catch (err) {
      console.error("Failed to join LiveKit room:", err);
      const message = err instanceof Error ? err.message : "Failed to connect";
      setError(message);
      setStatus("error");
      setConnection({ channelId: null, status: "error", error: message });
      if (channelId) {
        resumeVoicePresenceWatch(channelId);
      }
    }
  }, [channelId, userId, displayName, updateParticipants, setConnection, setJoinedChannelId, setControls, setPresence]);

  const leave = useCallback(async () => {
    readyForSoundsRef.current = false;

    // Untrack Supabase presence
    const presenceCh = presenceChannelRef.current;
    if (presenceCh) {
      try {
        await presenceCh.untrack();
        supabase.removeChannel(presenceCh);
      } catch { /* ignore */ }
      presenceChannelRef.current = null;
    }

    const room = roomRef.current;
    if (room) {
      try {
        await room.disconnect();
      } catch {
        // ignore
      }
      roomRef.current = null;
    }

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

    if (channelId) {
      resumeVoicePresenceWatch(channelId);
    }
  }, [channelId, setConnection, setJoinedChannelId, setControls]);

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

    // Mute/unmute all remote audio tracks
    room.remoteParticipants.forEach((p: RemoteParticipant) => {
      p.trackPublications.forEach((pub: RemoteTrackPublication) => {
        if (pub.track && pub.track.kind === "audio") {
          if (newDeafened) {
            pub.track.mediaStreamTrack.enabled = false;
          } else {
            pub.track.mediaStreamTrack.enabled = true;
          }
        }
      });
    });

    updateParticipants();
  }, [isDeafened, isMuted, setControls, updateParticipants]);

  const startScreenShare = useCallback(async (quality: ScreenShareQuality) => {
    const room = roomRef.current;
    if (!room) return;

    try {
      const preset = QUALITY_PRESETS[quality.resolution];
      
      // Request screen share with specified quality
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: preset.width, max: preset.width },
          height: { ideal: preset.height, max: preset.height },
          frameRate: { ideal: quality.frameRate, max: quality.frameRate },
        },
        audio: true,
      });

      // Publish tracks to LiveKit
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack) {
        await room.localParticipant.publishTrack(videoTrack, {
          source: Track.Source.ScreenShare,
          videoEncoding: {
            maxBitrate: quality.resolution === "1080p" ? 3_000_000 : 1_500_000,
            maxFramerate: quality.frameRate,
          },
        });

        // Handle track ended (user clicked "Stop sharing" in browser UI)
        videoTrack.onended = () => {
          stopScreenShare();
        };
      }

      if (audioTrack) {
        await room.localParticipant.publishTrack(audioTrack, {
          source: Track.Source.ScreenShareAudio,
        });
      }

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

    // Unpublish screen share tracks
    room.localParticipant.trackPublications.forEach((pub) => {
      if (pub.source === Track.Source.ScreenShare || pub.source === Track.Source.ScreenShareAudio) {
        room.localParticipant.unpublishTrack(pub.track!);
      }
    });

    setIsScreenSharing(false);
    setScreenShareQuality(null);
    updateParticipants();
  }, [updateParticipants]);

  // Cleanup on unmount or channelId change
  useEffect(() => {
    return () => {
      readyForSoundsRef.current = false;
      const presenceCh = presenceChannelRef.current;
      if (presenceCh) {
        try { presenceCh.untrack(); supabase.removeChannel(presenceCh); } catch { /* ignore */ }
        presenceChannelRef.current = null;
      }
      const room = roomRef.current;
      if (room) {
        room.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  // Sync audio device changes mid-call
  useEffect(() => {
    const room = roomRef.current;
    if (!room || status !== "joined") return;

    // Switch input device
    if (voiceSettings.inputDeviceId) {
      room.switchActiveDevice("audioinput", voiceSettings.inputDeviceId).catch(() => {});
    }
  }, [voiceSettings.inputDeviceId, status]);

  useEffect(() => {
    const room = roomRef.current;
    if (!room || status !== "joined") return;

    // Switch output device
    if (voiceSettings.outputDeviceId) {
      room.switchActiveDevice("audiooutput", voiceSettings.outputDeviceId).catch(() => {});
    }
  }, [voiceSettings.outputDeviceId, status]);

  // Sync audio processing options mid-call
  useEffect(() => {
    const room = roomRef.current;
    if (!room || status !== "joined") return;

    // Re-publish mic with updated audio processing constraints
    const localPub = Array.from(room.localParticipant.trackPublications.values()).find(
      (pub) => pub.source === Track.Source.Microphone
    ) as LocalTrackPublication | undefined;

    if (localPub?.track?.mediaStreamTrack) {
      localPub.track.mediaStreamTrack.applyConstraints({
        echoCancellation: voiceSettings.echoCancellation,
        noiseSuppression: voiceSettings.noiseSuppression,
        autoGainControl: voiceSettings.autoGainControl,
        channelCount: voiceSettings.monoAudio ? 1 : undefined,
      }).catch(() => {});
    }
  }, [voiceSettings.echoCancellation, voiceSettings.noiseSuppression, voiceSettings.autoGainControl, voiceSettings.monoAudio, status]);

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
    room: roomRef.current,
  };
}
