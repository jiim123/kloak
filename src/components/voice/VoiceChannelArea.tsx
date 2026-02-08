import { useEffect, useMemo, useRef, useCallback } from "react";
import { Mic, MicOff, MonitorOff, MonitorUp, PhoneOff, Settings, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useVoiceStore } from "@/stores/voiceStore";
import { useFriendStore } from "@/stores/friendStore";
import { useLiveKitRoom, LiveKitParticipant } from "@/hooks/useLiveKitRoom";
import type { Channel, ServerMember } from "@/types";

// Audio player for remote participant audio
function AudioPlayer({ track, muted }: { track: MediaStreamTrack; muted: boolean }) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!ref.current || !track) return;
    const stream = new MediaStream([track]);
    ref.current.srcObject = stream;
    ref.current.muted = muted;

    const tryPlay = () => {
      const p = ref.current?.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    tryPlay();
    ref.current.addEventListener("canplay", tryPlay);
    return () => {
      ref.current?.removeEventListener("canplay", tryPlay);
    };
  }, [track]);

  useEffect(() => {
    if (ref.current) {
      ref.current.muted = muted;
    }
  }, [muted]);

  return <audio ref={ref} autoPlay playsInline muted={muted} />;
}

// Video player for screen share
function VideoPlayer({ track }: { track: MediaStreamTrack }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ref.current || !track) return;
    const stream = new MediaStream([track]);
    ref.current.srcObject = stream;
  }, [track]);

  return <video ref={ref} autoPlay playsInline className="max-w-full max-h-full w-auto h-auto" />;
}

function getMemberDisplayName(member: ServerMember | undefined, participant: LiveKitParticipant): string {
  if (member) {
    return member.nickname || member.user?.display_name || member.user?.username || participant.name;
  }
  return participant.name || participant.identity.slice(0, 8);
}

type TileProps = {
  participant: LiveKitParticipant;
  member: ServerMember | undefined;
  isYou: boolean;
  isDeafened: boolean;
};

function ParticipantTile({ participant, member, isYou, isDeafened }: TileProps) {
  const name = getMemberDisplayName(member, participant);
  const speaking = participant.isSpeaking;

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
          {isDeafened && isYou ? <VolumeX className="w-4 h-4" /> : null}
          {participant.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          {participant.isScreenSharing ? <MonitorUp className="w-4 h-4" /> : null}
        </div>
      </div>
    </div>
  );
}

export function VoiceChannelArea({ channel }: { channel: Channel }) {
  const { user } = useAuthStore();
  const { members } = useServerStore();
  const setJoinedChannel = useVoiceStore((s) => s.setJoinedChannel);

  const voice = useLiveKitRoom({
    channelId: channel.id,
    userId: user?.id || null,
    displayName: user?.display_name || user?.username,
  });

  // Persist the joined voice channel metadata
  useEffect(() => {
    if (voice.isJoined) {
      setJoinedChannel(channel);
    } else {
      const prev = useVoiceStore.getState().joinedChannel;
      if (prev?.id === channel.id) setJoinedChannel(null);
    }
  }, [channel, setJoinedChannel, voice.isJoined]);

  // Listen for disconnect request from sidebar banner
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (e.detail?.channelId !== channel.id) return;
      voice.leave();
    };
    window.addEventListener("kloak:voice:leave", handler as EventListener);
    return () => window.removeEventListener("kloak:voice:leave", handler as EventListener);
  }, [channel.id, voice]);

  // Listen for mute/deafen toggle from sidebar banner
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

  // Filter out blocked users
  const filteredParticipants = useMemo(() => {
    const blocked = new Set(useFriendStore.getState().visibilityBlockedUserIds);
    return voice.participants.filter((p) => !blocked.has(p.identity));
  }, [voice.participants]);

  // Find screen sharers (not the local user)
  const screenSharers = useMemo(() => {
    return filteredParticipants
      .filter((p) => p.isScreenSharing && p.identity !== user?.id && p.screenTrack)
      .map((p) => ({ identity: p.identity, track: p.screenTrack! }));
  }, [filteredParticipants, user?.id]);

  // Local screen share
  const localScreenShare = useMemo(() => {
    const localP = filteredParticipants.find((p) => p.identity === user?.id);
    if (localP?.isScreenSharing && localP.screenTrack) {
      return { identity: localP.identity, track: localP.screenTrack, isLocal: true as const };
    }
    return null;
  }, [filteredParticipants, user?.id]);

  const remoteScreenShare = screenSharers[0] ? { ...screenSharers[0], isLocal: false as const } : null;

  const stage = localScreenShare || remoteScreenShare;
  const isReady = !!user;

  return (
    <div className="h-full flex flex-col min-w-0 bg-layout-chat">
      {/* Top bar */}
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

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <div
          className={cn("min-h-0 p-4", voice.isJoined ? "overflow-y-auto" : "h-full flex items-center justify-center")}
        >
          {voice.error && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {voice.error}
            </div>
          )}

          {!voice.isJoined ? (
            <div className="max-w-md w-full rounded-2xl border border-border/70 bg-background/60 backdrop-blur p-6 relative overflow-hidden">
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
                      <span className="italic">Voice channels are still beta</span>
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  <Button
                    className="w-full"
                    disabled={!isReady || voice.status === "joining"}
                    onClick={() => voice.join()}
                  >
                    {voice.status === "joining" ? "Connecting…" : "Join voice"}
                  </Button>
                </div>
              </div>
            </div>
          ) : stage ? (
            <div className="grid gap-4">
              {/* Screen share stage */}
              <div className="mx-auto w-full max-w-[1100px] rounded-2xl border border-border bg-black/40 overflow-hidden">
                <div className="px-4 py-3 border-b border-border/60 bg-background/10 flex items-center justify-between">
                  <div className="text-sm font-semibold truncate">
                    {stage.isLocal
                      ? "Your Screen"
                      : `${getMemberDisplayName(memberByUserId.get(stage.identity), { identity: stage.identity, name: stage.identity } as LiveKitParticipant)} • Screen`}
                  </div>
                  <div className="text-xs text-muted-foreground">Live</div>
                </div>
                <div className="aspect-video flex items-center justify-center max-h-[60vh]">
                  <VideoPlayer track={stage.track} />
                </div>
              </div>

              {/* Participant tiles */}
              <div className="mx-auto w-full max-w-[1100px] grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {filteredParticipants.map((p) => (
                  <ParticipantTile
                    key={p.identity}
                    participant={p}
                    member={memberByUserId.get(p.identity)}
                    isYou={p.identity === user?.id}
                    isDeafened={p.identity === user?.id ? voice.localState.deafened : false}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[1100px] grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {filteredParticipants.map((p) => (
                <ParticipantTile
                  key={p.identity}
                  participant={p}
                  member={memberByUserId.get(p.identity)}
                  isYou={p.identity === user?.id}
                  isDeafened={p.identity === user?.id ? voice.localState.deafened : false}
                />
              ))}
            </div>
          )}

          {/* Remote audio elements (hidden) */}
          {filteredParticipants
            .filter((p) => p.identity !== user?.id && p.audioTrack)
            .map((p) => (
              <AudioPlayer key={p.identity} track={p.audioTrack!} muted={voice.localState.deafened} />
            ))}
        </div>
      </div>

      {/* Bottom control bar */}
      {voice.isJoined && (
        <div className="h-14 border-t border-border/60 bg-background/60 backdrop-blur flex items-center justify-between px-3 gap-3">
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

            <Button
              variant="destructive"
              size="icon"
              className="w-10 h-10"
              onClick={() => voice.leave()}
              title="Disconnect"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>

          <div className="w-[140px] hidden sm:block" />
        </div>
      )}
    </div>
  );
}
