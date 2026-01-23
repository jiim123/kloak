import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getWebRTCIceServers } from "@/lib/webrtc";
import { useVoiceStore } from "@/stores/voiceStore";
import { useFriendStore } from "@/stores/friendStore";
import { pauseVoicePresenceWatch, resumeVoicePresenceWatch } from "@/hooks/useVoicePresenceWatchers";

type VoiceRoomStatus = "idle" | "joining" | "joined" | "error";

export type VoiceParticipantMeta = {
  user_id: string;
  muted: boolean;
  deafened: boolean;
  sharing: boolean;
  speaking: boolean;
  joined_at: number;
};

export type VoiceParticipant = {
  userId: string;
  muted: boolean;
  deafened: boolean;
  sharing: boolean;
  speaking: boolean;
  joinedAt: number;
};

type SignalMessage =
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "hangup"; from: string; to: string };

type VoiceBroadcastMessage = { kind: "speaking"; from: string; speaking: boolean; ts: number };

type RemoteMediaState = {
  audioStream?: MediaStream;
  screenStream?: MediaStream;
};

type PcNegotiationState = {
  polite: boolean;
  makingOffer: boolean;
  ignoreOffer: boolean;
  isSettingRemoteAnswerPending: boolean;
};

function isInitiator(localUserId: string, remoteUserId: string): boolean {
  // Deterministic offerer selection to avoid glare.
  return localUserId < remoteUserId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function getLatestMetaForPresenceKey(entries: unknown[]): VoiceParticipantMeta | null {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  const last = entries[entries.length - 1];
  if (!isRecord(last)) return null;

  const user_id = typeof last.user_id === "string" ? last.user_id : null;
  if (!user_id) return null;
  return {
    user_id,
    muted: !!last.muted,
    deafened: !!last.deafened,
    sharing: !!last.sharing,
    speaking: !!last.speaking,
    joined_at: typeof last.joined_at === "number" ? last.joined_at : Date.now(),
  };
}

export function useVoiceRoom(opts: { channelId: string | null; userId: string | null }) {
  const { channelId, userId } = opts;

  const iceServers = useMemo(() => getWebRTCIceServers(), []);
  const setJoinedChannelId = useVoiceStore((s) => s.setJoinedChannelId);
  const setPresence = useVoiceStore((s) => s.setPresence);
  const clearPresence = useVoiceStore((s) => s.clearPresence);
  const setConnection = useVoiceStore((s) => s.setConnection);
  const setControls = useVoiceStore((s) => s.setControls);

  const [status, setStatus] = useState<VoiceRoomStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const [isJoined, setIsJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const [participants, setParticipants] = useState<Record<string, VoiceParticipant>>({});
  const [remoteMedia, setRemoteMedia] = useState<Record<string, RemoteMediaState>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const negotiationRef = useRef<Map<string, PcNegotiationState>>(new Map());
  const joinTokenRef = useRef(0);

  const localMicStreamRef = useRef<MediaStream | null>(null);
  const localScreenStreamRef = useRef<MediaStream | null>(null);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);
  const joinedAtRef = useRef<number | null>(null);
  const remoteSpeakingRef = useRef<Map<string, { speaking: boolean; ts: number }>>(new Map());
  const lastSpeakBroadcastRef = useRef<{ speaking: boolean; ts: number } | null>(null);

  const updatePresenceMeta = useCallback(async () => {
    if (!channelRef.current || !userId) return;
    try {
      await channelRef.current.track({
        user_id: userId,
        muted,
        deafened,
        sharing,
        speaking,
        // Keep joined_at stable so other clients can sort reliably and we don't "jump" around.
        joined_at: joinedAtRef.current ?? Date.now(),
      } satisfies VoiceParticipantMeta);
    } catch {
      // best-effort
    }
  }, [userId, muted, deafened, sharing, speaking]);

  const cleanupPeer = useCallback((remoteUserId: string) => {
    const pc = pcsRef.current.get(remoteUserId);
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.onnegotiationneeded = null;
        pc.close();
      } catch {
        // ignore
      }
    }
    pcsRef.current.delete(remoteUserId);
    pendingIceRef.current.delete(remoteUserId);
    negotiationRef.current.delete(remoteUserId);
    setRemoteMedia((prev) => {
      if (!prev[remoteUserId]) return prev;
      const next = { ...prev };
      delete next[remoteUserId];
      return next;
    });
  }, []);

  const cleanupAllPeers = useCallback(() => {
    const ids = Array.from(pcsRef.current.keys());
    ids.forEach((id) => cleanupPeer(id));
  }, [cleanupPeer]);

  const stopLocalStreams = useCallback(() => {
    const mic = localMicStreamRef.current;
    const screen = localScreenStreamRef.current;

    if (screen) {
      screen.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
    }
    if (mic) {
      mic.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
    }
    localMicStreamRef.current = null;
    localScreenStreamRef.current = null;
    setMicStream(null);
    setSpeaking(false);
    joinedAtRef.current = null;
  }, []);

  const sendSignal = useCallback(async (msg: SignalMessage) => {
    const ch = channelRef.current;
    if (!ch) return;
    try {
      await ch.send({ type: "broadcast", event: "signal", payload: msg });
    } catch {
      // best-effort
    }
  }, []);

  const sendVoiceBroadcast = useCallback(async (msg: VoiceBroadcastMessage) => {
    const ch = channelRef.current;
    if (!ch) return;
    try {
      await ch.send({ type: "broadcast", event: "voice", payload: msg });
    } catch {
      // best-effort
    }
  }, []);

  const attachLocalTracksToPeer = useCallback((pc: RTCPeerConnection) => {
    const mic = localMicStreamRef.current;
    if (mic) {
      for (const track of mic.getAudioTracks()) {
        try {
          pc.addTrack(track, mic);
        } catch {
          // ignore
        }
      }
    }
    const screen = localScreenStreamRef.current;
    if (screen) {
      for (const track of screen.getVideoTracks()) {
        try {
          pc.addTrack(track, screen);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const attachLocalTracksToAllPeers = useCallback(() => {
    const mic = localMicStreamRef.current;
    if (!mic) return;
    const audioTracks = mic.getAudioTracks();
    if (!audioTracks.length) return;

    pcsRef.current.forEach((pc) => {
      // Only add if this pc doesn't already have an audio sender.
      const hasAudioSender = pc.getSenders().some((s) => s.track && s.track.kind === "audio");
      if (hasAudioSender) return;

      for (const track of audioTracks) {
        try {
          pc.addTrack(track, mic);
        } catch {
          // ignore
        }
      }
    });
  }, []);

  const flushPendingIce = useCallback(async (remoteUserId: string, pc: RTCPeerConnection) => {
    const pending = pendingIceRef.current.get(remoteUserId) || [];
    if (!pending.length) return;
    pendingIceRef.current.delete(remoteUserId);
    for (const c of pending) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        // ignore
      }
    }
  }, []);

  const negotiate = useCallback(
    async (remoteUserId: string) => {
      if (!userId) return;
      const pc = pcsRef.current.get(remoteUserId);
      const st = negotiationRef.current.get(remoteUserId);
      if (!pc || !st) return;

      try {
        st.makingOffer = true;
        // setLocalDescription() without args creates an offer when needed.
        await pc.setLocalDescription();
        const local = pc.localDescription;
        if (!local) return;
        await sendSignal({
          kind: "offer",
          from: userId,
          to: remoteUserId,
          sdp: local.toJSON(),
        });
      } catch {
        // ignore
      } finally {
        st.makingOffer = false;
      }
    },
    [sendSignal, userId],
  );

  const ensurePeerConnection = useCallback(
    (remoteUserId: string) => {
      if (!userId) return null;
      if (remoteUserId === userId) return null;

      const existing = pcsRef.current.get(remoteUserId);
      if (existing) return existing;

      const pc = new RTCPeerConnection({ iceServers });
      pcsRef.current.set(remoteUserId, pc);

      // Perfect negotiation state (MDN).
      const polite = !isInitiator(userId, remoteUserId);
      negotiationRef.current.set(remoteUserId, {
        polite,
        makingOffer: false,
        ignoreOffer: false,
        isSettingRemoteAnswerPending: false,
      });

      attachLocalTracksToPeer(pc);

      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        sendSignal({
          kind: "ice",
          from: userId,
          to: remoteUserId,
          candidate: event.candidate.toJSON(),
        });
      };

      pc.ontrack = (event) => {
        const track = event.track;
        // Create a dedicated MediaStream per kind so we can render cleanly.
        if (track.kind === "audio") {
          const stream = new MediaStream([track]);
          setRemoteMedia((prev) => ({
            ...prev,
            [remoteUserId]: { ...(prev[remoteUserId] || {}), audioStream: stream },
          }));
        } else if (track.kind === "video") {
          const stream = new MediaStream([track]);
          setRemoteMedia((prev) => ({
            ...prev,
            [remoteUserId]: { ...(prev[remoteUserId] || {}), screenStream: stream },
          }));

          const clearScreen = () => {
            setRemoteMedia((prev) => {
              const existing = prev[remoteUserId];
              if (!existing?.screenStream) return prev;
              const nextEntry: RemoteMediaState = { ...existing };
              delete nextEntry.screenStream;
              if (!nextEntry.audioStream) {
                const nextAll = { ...prev };
                delete nextAll[remoteUserId];
                return nextAll;
              }
              return { ...prev, [remoteUserId]: nextEntry };
            });
          };

          // When the remote stops sharing, browsers may keep the last frame; clear it.
          track.addEventListener("ended", clearScreen, { once: true });
          track.addEventListener("mute", clearScreen);
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "failed" || st === "closed") {
          cleanupPeer(remoteUserId);
        }
      };

      pc.onnegotiationneeded = async () => {
        // This fires when tracks are added/removed; we renegotiate.
        await negotiate(remoteUserId);
      };

      return pc;
    },
    [attachLocalTracksToPeer, cleanupPeer, iceServers, negotiate, sendSignal, userId],
  );

  const handleSignal = useCallback(
    async (msg: SignalMessage) => {
      if (!userId) return;
      if (msg.to !== userId) return;

      if (msg.kind === "hangup") {
        cleanupPeer(msg.from);
        return;
      }

      const pc = ensurePeerConnection(msg.from);
      if (!pc) return;
      const nego = negotiationRef.current.get(msg.from);
      if (!nego) return;

      try {
        if (msg.kind === "offer") {
          const offerCollision = nego.makingOffer || pc.signalingState !== "stable";
          nego.ignoreOffer = !nego.polite && offerCollision;
          if (nego.ignoreOffer) return;

          await Promise.all([
            offerCollision ? pc.setLocalDescription({ type: "rollback" }) : Promise.resolve(),
            pc.setRemoteDescription(msg.sdp),
          ]);
          await flushPendingIce(msg.from, pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal({
            kind: "answer",
            from: userId,
            to: msg.from,
            sdp: pc.localDescription?.toJSON() ?? answer,
          });
          return;
        }

        if (msg.kind === "answer") {
          nego.isSettingRemoteAnswerPending = true;
          await pc.setRemoteDescription(msg.sdp);
          nego.isSettingRemoteAnswerPending = false;
          await flushPendingIce(msg.from, pc);
          return;
        }

        if (msg.kind === "ice") {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(msg.candidate);
          } else {
            const arr = pendingIceRef.current.get(msg.from) || [];
            arr.push(msg.candidate);
            pendingIceRef.current.set(msg.from, arr);
          }
        }
      } catch {
        // ignore
      }
    },
    [cleanupPeer, ensurePeerConnection, flushPendingIce, sendSignal, userId],
  );

  const refreshParticipantsFromPresence = useCallback(() => {
    const ch = channelRef.current;
    if (!ch) return;
    const state = ch.presenceState() as Record<string, unknown[]>;
    const next: Record<string, VoiceParticipant> = {};

    Object.entries(state || {}).forEach(([presenceKey, entries]) => {
      const meta = getLatestMetaForPresenceKey(entries);
      if (!meta) return;
      const id = meta.user_id || presenceKey;
      const override = remoteSpeakingRef.current.get(id);
      // Presence updates are sometimes delayed/batched; a recent broadcast is more "realtime".
      const speakingNow = override && Date.now() - override.ts < 2500 ? override.speaking : meta.speaking;
      next[id] = {
        userId: id,
        muted: meta.muted,
        deafened: meta.deafened,
        sharing: meta.sharing,
        speaking: speakingNow,
        joinedAt: meta.joined_at,
      };
    });

    setParticipants(next);

    // If someone is no longer sharing, clear their remote screen stream to avoid "stuck" frames.
    setRemoteMedia((prev) => {
      let changed = false;
      const out: Record<string, RemoteMediaState> = { ...prev };
      Object.entries(out).forEach(([id, media]) => {
        const p = next[id];
        if (media?.screenStream && (!p || !p.sharing)) {
          const nextMedia: RemoteMediaState = { ...media };
          delete nextMedia.screenStream;
          if (!nextMedia.audioStream) {
            delete out[id];
          } else {
            out[id] = nextMedia;
          }
          changed = true;
        }
      });
      return changed ? out : prev;
    });

    // Cleanup peer connections for users no longer present.
    const presentIds = new Set(Object.keys(next));
    Array.from(pcsRef.current.keys()).forEach((remoteId) => {
      if (!presentIds.has(remoteId)) cleanupPeer(remoteId);
    });

    // Ensure peer connections for all other participants.
    if (userId) {
      Object.keys(next)
        .filter((id) => id !== userId)
        .forEach((remoteId) => {
          ensurePeerConnection(remoteId);
        });
    }
  }, [cleanupPeer, ensurePeerConnection, userId]);

  const join = useCallback(async () => {
    if (!channelId || !userId) return;
    if (channelRef.current) return;

    const joinToken = (joinTokenRef.current += 1);
    setStatus("joining");
    setError(null);
    setConnection({ channelId, status: "joining", error: null });

    // Avoid duplicate subscriptions to `voice:${channelId}` (sidebar watcher + voice join).
    pauseVoicePresenceWatch(channelId);

    const ch = supabase.channel(`voice:${channelId}`, {
      config: {
        presence: { key: userId },
      },
    });
    channelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => refreshParticipantsFromPresence());
    ch.on("presence", { event: "join" }, () => refreshParticipantsFromPresence());
    ch.on("presence", { event: "leave" }, () => refreshParticipantsFromPresence());

    ch.on("broadcast", { event: "signal" }, (payload) => {
      const msg = payload.payload as SignalMessage | undefined;
      if (!msg) return;
      handleSignal(msg);
    });

    // Realtime "who is speaking" hints (best-effort).
    ch.on("broadcast", { event: "voice" }, (payload) => {
      const msg = payload.payload as VoiceBroadcastMessage | undefined;
      if (!msg || !userId) return;
      if (msg.kind !== "speaking") return;
      if (msg.from === userId) return;

      remoteSpeakingRef.current.set(msg.from, { speaking: !!msg.speaking, ts: msg.ts || Date.now() });
      setParticipants((prev) => {
        const existing = prev[msg.from];
        if (!existing) return prev;
        const nextSpeaking = !!msg.speaking;
        if (existing.speaking === nextSpeaking) return prev;
        return { ...prev, [msg.from]: { ...existing, speaking: nextSpeaking } };
      });
    });

    ch.subscribe(async (subStatus, err) => {
      if (joinTokenRef.current !== joinToken) return;
      if (subStatus === "SUBSCRIBED") {
        try {
          const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
          localMicStreamRef.current = mic;
          setMicStream(mic);
          joinedAtRef.current = Date.now();

          // Apply mute state to mic immediately.
          mic.getAudioTracks().forEach((t) => {
            t.enabled = !muted && !deafened;
          });

          // If any peer connections were created before mic acquisition (e.g. via early presence sync),
          // ensure the mic tracks are attached and trigger renegotiation so remote peers can hear us.
          attachLocalTracksToAllPeers();
          Array.from(pcsRef.current.keys()).forEach((remoteId) => {
            negotiate(remoteId);
          });

          setIsJoined(true);
          setStatus("joined");
          setConnection({ channelId, status: "joined", error: null });

          await updatePresenceMeta();
          refreshParticipantsFromPresence();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Failed to access microphone");
          setStatus("error");
          setConnection({
            channelId,
            status: "error",
            error: e instanceof Error ? e.message : "Failed to access microphone",
          });
          resumeVoicePresenceWatch(channelId);
          try {
            supabase.removeChannel(ch);
          } catch {
            // ignore
          }
          channelRef.current = null;
        }
      } else if (subStatus === "CHANNEL_ERROR" || subStatus === "CLOSED" || subStatus === "TIMED_OUT") {
        // Treat these as disconnected; cleanup so user can rejoin cleanly.
        setStatus("error");
        setError(err?.message || "Voice signaling connection failed");
        setConnection({ channelId, status: "error", error: err?.message || "Voice signaling connection failed" });
        setIsJoined(false);
        cleanupAllPeers();
        stopLocalStreams();
        resumeVoicePresenceWatch(channelId);
        // Only remove ourselves locally; keep showing other users until watcher refreshes.
        if (userId) {
          const existing = useVoiceStore.getState().presenceByChannel[channelId] || [];
          setPresence(
            channelId,
            existing.filter((id) => id !== userId),
          );
        } else {
          clearPresence(channelId);
        }
      }
    });
  }, [
    attachLocalTracksToAllPeers,
    channelId,
    clearPresence,
    cleanupAllPeers,
    deafened,
    handleSignal,
    muted,
    negotiate,
    refreshParticipantsFromPresence,
    setConnection,
    setPresence,
    stopLocalStreams,
    updatePresenceMeta,
    userId,
  ]);

  const leave = useCallback(async () => {
    const ch = channelRef.current;
    if (!ch) return;

    if (channelId) resumeVoicePresenceWatch(channelId);
    if (channelId) {
      // Only remove ourselves locally; keep showing other users until watcher refreshes.
      if (userId) {
        const existing = useVoiceStore.getState().presenceByChannel[channelId] || [];
        setPresence(
          channelId,
          existing.filter((id) => id !== userId),
        );
      } else {
        clearPresence(channelId);
      }
    }

    // Invalidate any pending subscribe callbacks.
    joinTokenRef.current += 1;
    setIsJoined(false);
    setStatus("idle");
    setError(null);
    setConnection({ channelId: null, status: "idle", error: null });

    cleanupAllPeers();
    stopLocalStreams();

    try {
      await ch.untrack();
    } catch {
      // ignore
    }
    try {
      supabase.removeChannel(ch);
    } catch {
      // ignore
    }
    channelRef.current = null;
    setParticipants({});
    setRemoteMedia({});
    setSharing(false);
  }, [channelId, cleanupAllPeers, clearPresence, setConnection, setPresence, stopLocalStreams, userId]);

  // Track which voice channel we are actually joined to (global), so the sidebar can avoid
  // duplicating Realtime subscriptions for that one channel while still showing presence for others.
  useEffect(() => {
    if (!channelId || !userId) {
      setJoinedChannelId(null);
      setConnection({ channelId: null, status: "idle", error: null });
      return;
    }
    setJoinedChannelId(isJoined ? channelId : null);
  }, [channelId, isJoined, setJoinedChannelId, userId]);

  // Keep presence meta in sync with local UI toggles.
  useEffect(() => {
    if (!isJoined) return;
    updatePresenceMeta();
  }, [deafened, isJoined, muted, sharing, speaking, updatePresenceMeta]);

  // When muting/deafening, update mic track enabled flag.
  useEffect(() => {
    const mic = localMicStreamRef.current;
    if (!mic) return;
    mic.getAudioTracks().forEach((t) => {
      t.enabled = !muted && !deafened;
    });
  }, [muted, deafened]);

  // Detect local speaking and publish it via presence meta (boolean), so others can render it.
  useEffect(() => {
    if (!isJoined || !micStream || muted || deafened) {
      setSpeaking(false);
      return;
    }

    const audioTrack = micStream.getAudioTracks()[0];
    if (!audioTrack) {
      setSpeaking(false);
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    const source = ctx.createMediaStreamSource(micStream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    let raf: number | null = null;
    let last = false;

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);

      // Simple hysteresis to avoid flapping.
      const next = last ? rms > 0.04 : rms > 0.06;
      if (next !== last) {
        last = next;
        setSpeaking(next);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      try {
        source.disconnect();
      } catch {
        // ignore
      }
      ctx.close().catch(() => {});
    };
  }, [deafened, isJoined, micStream, muted]);

  // Broadcast speaking edge changes quickly so other clients can animate "pulsing" reliably.
  // (Presence updates can be delayed/batched.)
  useEffect(() => {
    if (!isJoined || !channelId || !userId) return;
    const now = Date.now();
    const last = lastSpeakBroadcastRef.current;
    // Only send on change and no more often than ~4/s.
    if (last && last.speaking === speaking) return;
    if (last && now - last.ts < 250) return;
    lastSpeakBroadcastRef.current = { speaking, ts: now };
    sendVoiceBroadcast({ kind: "speaking", from: userId, speaking, ts: now });
  }, [channelId, isJoined, sendVoiceBroadcast, speaking, userId]);

  // Publish presence to the global voice store for the voice channel we are actively joined to.
  // The sidebar watcher intentionally does not subscribe to this channel while we're joined,
  // to avoid duplicate Realtime subscriptions.
  useEffect(() => {
    if (!channelId || !isJoined) return;
    const blocked = new Set(useFriendStore.getState().visibilityBlockedUserIds);
    const ids = Object.keys(participants);
    const filtered = blocked.size > 0 ? ids.filter((id) => !blocked.has(id)) : ids;
    setPresence(channelId, filtered);
  }, [channelId, isJoined, participants, setPresence]);

  // NOTE: Do not write to the global sidebar presence store from here.
  // Presence for the sidebar is driven by lightweight presence subscriptions (watchers) so it works
  // even when you are not on the voice channel page.

  // Auto-leave if channel changes while joined.
  useEffect(() => {
    return () => {
      // On unmount.
      leave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => setMuted((v) => !v), []);
  const toggleDeafen = useCallback(() => setDeafened((v) => !v), []);

  const stopScreenShare = useCallback(() => {
    const screen = localScreenStreamRef.current;
    if (!screen) return;
    const track = screen.getVideoTracks()[0];

    // Remove from all peer connections.
    pcsRef.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === "video");
      if (sender) {
        try {
          pc.removeTrack(sender);
        } catch {
          // ignore
        }
      }
    });

    screen.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        // ignore
      }
    });
    localScreenStreamRef.current = null;
    setSharing(false);
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!isJoined) return;
    if (localScreenStreamRef.current) return;

    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      localScreenStreamRef.current = screen;
      setSharing(true);

      // Add track to all peers.
      const track = screen.getVideoTracks()[0];
      if (track) {
        pcsRef.current.forEach((pc) => {
          try {
            pc.addTrack(track, screen);
          } catch {
            // ignore
          }
        });
      }

      // If the user stops sharing via browser UI, clean up.
      track?.addEventListener("ended", () => stopScreenShare(), { once: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start screen share");
    }
  }, [isJoined, stopScreenShare]);

  const localState = useMemo(
    () => ({
      muted,
      deafened,
      sharing,
      speaking,
    }),
    [deafened, muted, sharing, speaking],
  );

  // Publish local mute/deafen into the global store so the sidebar banner can reflect and control it.
  useEffect(() => {
    setControls({ muted, deafened });
  }, [deafened, muted, setControls]);

  return {
    status,
    error,
    isJoined,

    participants,
    remoteMedia,

    localStreams: {
      mic: localMicStreamRef.current,
      screen: localScreenStreamRef.current,
    },

    localState,

    join,
    leave,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
  };
}

