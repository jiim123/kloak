import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Settings, Users, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useVoiceRoom } from "@/hooks/useVoiceRoom";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useVoiceStore } from "@/stores/voiceStore";
import type { Channel, ServerMember } from "@/types";

function AudioPlayer({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    el.srcObject = stream;

    // Autoplay policies often block audio that starts asynchronously (e.g. when a remote track arrives).
    // Best-effort: attempt to start playback when the stream is attached.
    const tryPlay = () => {
      // Keep mute in sync (deafen).
      el.muted = muted;
      const p = el.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    tryPlay();
    el.addEventListener("canplay", tryPlay);
    el.addEventListener("loadedmetadata", tryPlay);
    return () => {
      el.removeEventListener("canplay", tryPlay);
      el.removeEventListener("loadedmetadata", tryPlay);
    };
  }, [stream]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.muted = muted;
  }, [muted]);
  return <audio ref={ref} autoPlay playsInline muted={muted} />;
}

function VideoPlayer({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay playsInline className="max-w-full max-h-full w-auto h-auto" />;
}

function useAudioLevel(stream: MediaStream | null, enabled: boolean) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !stream) {
      setLevel(0);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      setLevel(0);
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.8;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      setLevel(rms);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      try {
        source.disconnect();
      } catch {
        // ignore
      }
      ctx.close().catch(() => {});
    };
  }, [enabled, stream]);

  return level;
}

function getMemberDisplayName(member: ServerMember | undefined, userId: string): string {
  if (!member) return userId.slice(0, 8);
  return member.nickname || member.user?.display_name || member.user?.username || userId.slice(0, 8);
}

export function VoiceChannelArea({ channel }: { channel: Channel }) {
  const { user } = useAuthStore();
  const { members } = useServerStore();
  const setJoinedChannel = useVoiceStore((s) => s.setJoinedChannel);

  const voice = useVoiceRoom({ channelId: channel.id, userId: user?.id || null });

  // Persist the joined voice channel metadata so the session survives switching servers/home/DMs
  // even if `useServerStore().channels` no longer contains this channel.
  useEffect(() => {
    if (voice.isJoined) {
      setJoinedChannel(channel);
    } else {
      // Clear only if we were the persisted channel.
      const prev = useVoiceStore.getState().joinedChannel;
      if (prev?.id === channel.id) setJoinedChannel(null);
    }
  }, [channel, setJoinedChannel, voice.isJoined]);

  // Allow the sidebar banner to request a disconnect without tight coupling.
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string }>;
      const id = e.detail?.channelId;
      if (!id || id !== channel.id) return;
      voice.leave();
    };
    window.addEventListener("kloak:voice:leave", handler as EventListener);
    return () => window.removeEventListener("kloak:voice:leave", handler as EventListener);
  }, [channel.id, voice]);

  // Allow sidebar banner to toggle mute/deafen while voice UI is offscreen.
  useEffect(() => {
    const onMute = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (e.detail?.channelId !== channel.id) return;
      voice.toggleMute();
    };
    const onDeafen = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (e.detail?.channelId !== channel.id) return;
      voice.toggleDeafen();
    };
    window.addEventListener("kloak:voice:toggleMute", onMute as EventListener);
    window.addEventListener("kloak:voice:toggleDeafen", onDeafen as EventListener);
    return () => {
      window.removeEventListener("kloak:voice:toggleMute", onMute as EventListener);
      window.removeEventListener("kloak:voice:toggleDeafen", onDeafen as EventListener);
    };
  }, [channel.id, voice]);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, ServerMember>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  const participantList = useMemo(() => {
    return Object.values(voice.participants).sort((a, b) => a.joinedAt - b.joinedAt);
  }, [voice.participants]);

  const screenSharers = useMemo(() => {
    return Object.values(voice.participants)
      .filter((p) => p.sharing && p.userId !== user?.id)
      .map((p) => {
        const stream = voice.remoteMedia[p.userId]?.screenStream;
        return stream ? { userId: p.userId, stream } : null;
      })
      .filter(Boolean) as Array<{ userId: string; stream: MediaStream }>;
  }, [voice.participants, voice.remoteMedia, user?.id]);

  const localMicLevel = useAudioLevel(voice.localStreams?.mic ?? null, voice.isJoined && !voice.localState.muted);
  const isReady = !!user;
  const localStage =
    voice.localState.sharing && voice.localStreams?.screen && user?.id
      ? { userId: user.id, stream: voice.localStreams.screen, isLocal: true as const }
      : null;
  const remoteStage = screenSharers[0] ? { ...screenSharers[0], isLocal: false as const } : null;
  const stage = localStage || remoteStage;

  const Tile = ({
    userId,
    member,
    muted,
    deafened,
    sharing,
    speaking,
    isYou,
  }: {
    userId: string;
    member: ServerMember | undefined;
    muted: boolean;
    deafened: boolean;
    sharing: boolean;
    speaking: boolean;
    isYou: boolean;
  }) => {
    const name = getMemberDisplayName(member, userId);
    return (
      <div
        className={cn(
          "relative rounded-xl border bg-card/30 overflow-hidden",
          speaking ? "border-primary/70" : "border-border/60",
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />

        <div className="p-4 flex items-center justify-center">
          <div className={cn("rounded-full p-1", speaking ? "bg-primary/20" : "bg-secondary/20")}>
            <AvatarWithDecoration user={member?.user} size={64} />
          </div>
        </div>

        <div className="px-3 pb-3 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{name}</div>
            <div className="text-xs text-muted-foreground truncate">{isYou ? "You" : "Member"}</div>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            {deafened ? <VolumeX className="w-4 h-4" /> : null}
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {sharing ? <MonitorUp className="w-4 h-4" /> : null}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col min-w-0 bg-layout-chat">
      {/* Discord-like top bar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border/60 bg-background/40 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{channel.name}</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {voice.isJoined ? "Voice connected" : "Not connected"}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="w-9 h-9">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Button>
      </div>

      {/* Main (no right sidebar) */}
      <div className="flex-1 min-h-0">
        {/* Stage / tiles */}
        <div className={cn("min-h-0 p-4", voice.isJoined ? "overflow-y-auto" : "h-full flex items-center justify-center")}>
          {voice.error && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {voice.error}
            </div>
          )}

          {!voice.isJoined ? (
            <div className="max-w-md w-full rounded-2xl border border-border/70 bg-background/60 backdrop-blur p-6 relative overflow-hidden">
              {/* Subtle backdrop */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />

              <div className="relative">
                <div className="flex items-start gap-3">
                  

                  <div className="min-w-0 flex-1">
                    

                    <div className="mt-2 text-lg font-semibold text-foreground">
                      Join <span className="text-primary">#{channel.name}</span>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      Talk with friends and share your screen seamlessly
                    </div>

                    <div className="mt-2 text-xs text-muted-foreground">
                      <span className="italic">Best experience:</span> 2–6 users
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <Button className="w-full" disabled={!isReady || voice.status === "joining"} onClick={() => voice.join()}>
                    {voice.status === "joining" ? "Connecting…" : "Join voice"}
                  </Button>
                </div>
              </div>
            </div>
          ) : stage ? (
            <div className="grid gap-4">
              <div className="mx-auto w-full max-w-[1100px] rounded-2xl border border-border bg-black/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60 bg-background/10 flex items-center justify-between">
                  <div className="text-sm font-semibold truncate">
                    {stage.isLocal
                      ? "Your Screen"
                      : `${getMemberDisplayName(memberByUserId.get(stage.userId), stage.userId)} • Screen`}
                  </div>
                  <div className="text-xs text-muted-foreground">Live</div>
                </div>
                <div className="aspect-video flex items-center justify-center max-h-[60vh]">
                  <VideoPlayer stream={stage.stream} />
                </div>
              </div>

              <div className="mx-auto w-full max-w-[1100px] grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {participantList.map((p) => {
                  const member = memberByUserId.get(p.userId);
                  const isYou = p.userId === user?.id;
                  const speaking = isYou ? localMicLevel > 0.06 : p.speaking;
                  return (
                    <Tile
                      key={p.userId}
                      userId={p.userId}
                      member={member}
                      muted={p.muted}
                      deafened={p.deafened}
                      sharing={p.sharing}
                      speaking={speaking}
                      isYou={isYou}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[1100px] grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {participantList.map((p) => {
                const member = memberByUserId.get(p.userId);
                const isYou = p.userId === user?.id;
                const speaking = isYou ? localMicLevel > 0.06 : p.speaking;
                return (
                  <Tile
                    key={p.userId}
                    userId={p.userId}
                    member={member}
                    muted={p.muted}
                    deafened={p.deafened}
                    sharing={p.sharing}
                    speaking={speaking}
                    isYou={isYou}
                  />
                );
              })}
            </div>
          )}

          {/* Remote audio elements (hidden) */}
          {Object.entries(voice.remoteMedia).map(([remoteId, media]) => {
            if (!media.audioStream) return null;
            return <AudioPlayer key={remoteId} stream={media.audioStream} muted={voice.localState.deafened} />;
          })}
        </div>

      </div>

      {/* Discord-like bottom control bar */}
      {voice.isJoined && (
        <div className="h-14 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-between px-3 gap-3">
          {/* Left spacer (we show user identity in the sidebar already) */}
          <div className="w-[140px] hidden sm:block" />

          <div className="flex items-center gap-2">
            <Button
              variant={voice.localState.muted ? "destructive" : "secondary"}
              size="icon"
              className="w-10 h-10"
              onClick={voice.toggleMute}
              title={voice.localState.muted ? "Unmute" : "Mute"}
            >
              {voice.localState.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              variant={voice.localState.deafened ? "destructive" : "secondary"}
              size="icon"
              className="w-10 h-10"
              onClick={voice.toggleDeafen}
              title={voice.localState.deafened ? "Undeafen" : "Deafen"}
            >
              {voice.localState.deafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>

            <Button
              variant={voice.localState.sharing ? "destructive" : "secondary"}
              size="icon"
              className="w-10 h-10"
              onClick={() => (voice.localState.sharing ? voice.stopScreenShare() : voice.startScreenShare())}
              title={voice.localState.sharing ? "Stop sharing" : "Share screen"}
            >
              {voice.localState.sharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            </Button>

            <Button variant="destructive" size="icon" className="w-10 h-10" onClick={() => voice.leave()} title="Disconnect">
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>

          <div className="w-[140px] hidden sm:block" />
        </div>
      )}
    </div>
  );
}

