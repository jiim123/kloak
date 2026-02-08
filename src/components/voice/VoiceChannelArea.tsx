import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { 
  Mic, 
  MicOff, 
  MonitorOff, 
  MonitorUp, 
  PhoneOff, 
  Volume2, 
  VolumeX,
  Video,
  VideoOff,
  Users,
  LayoutGrid,
  ExternalLink,
  Maximize2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useVoiceStore } from "@/stores/voiceStore";
import { useFriendStore } from "@/stores/friendStore";
import { useLiveKitRoom, LiveKitParticipant } from "@/hooks/useLiveKitRoom";
import { ScreenShareQualityModal, ScreenShareQuality } from "./ScreenShareQualityModal";
import type { Channel, ServerMember } from "@/types";

// Utility to generate a consistent color from a string
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 65%)`;
}

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
function VideoPlayer({ track, className }: { track: MediaStreamTrack; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!ref.current || !track) return;
    const stream = new MediaStream([track]);
    ref.current.srcObject = stream;
  }, [track]);

  return <video ref={ref} autoPlay playsInline className={cn("w-full h-full object-contain", className)} />;
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
  onWatchStream?: () => void;
};

// Discord-style participant tile
function ParticipantTile({ participant, member, isYou, isDeafened, onWatchStream }: TileProps) {
  const name = getMemberDisplayName(member, participant);
  const speaking = participant.isSpeaking;
  const bgColor = useMemo(() => stringToColor(participant.identity), [participant.identity]);

  // If participant is screen sharing, show that instead
  if (participant.isScreenSharing && participant.screenTrack && !isYou) {
    return (
      <div
        className={cn(
          "relative rounded-lg overflow-hidden aspect-video",
          "ring-2 ring-transparent transition-all",
          speaking && "ring-primary"
        )}
      >
        <VideoPlayer track={participant.screenTrack} />
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={onWatchStream}
          >
            <MonitorUp className="w-4 h-4" />
            Watch Stream
          </Button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center gap-2">
            <MonitorUp className="w-3 h-3 text-white" />
            <span className="text-xs font-medium text-white truncate">{name}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden aspect-video flex items-center justify-center",
        "ring-2 ring-transparent transition-all",
        speaking && "ring-primary ring-offset-2 ring-offset-background"
      )}
      style={{ backgroundColor: bgColor }}
    >
      {/* Large centered avatar */}
      <div className={cn(
        "transition-transform",
        speaking && "scale-105"
      )}>
        <AvatarWithDecoration user={member?.user} size={80} />
      </div>

      {/* Username badge - bottom left */}
      <div className="absolute bottom-2 left-2">
        <div className={cn(
          "px-2 py-1 rounded text-xs font-medium",
          speaking ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
        )}>
          {name}
        </div>
      </div>

      {/* Status icons - bottom right */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        {isDeafened && isYou && (
          <div className="w-6 h-6 rounded bg-black/60 flex items-center justify-center">
            <VolumeX className="w-3.5 h-3.5 text-white" />
          </div>
        )}
        {participant.isMuted && (
          <div className="w-6 h-6 rounded bg-black/60 flex items-center justify-center">
            <MicOff className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}

// Control button component for the bottom bar
function ControlButton({ 
  icon: Icon, 
  active, 
  destructive,
  label,
  onClick,
  hasDropdown,
}: { 
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  destructive?: boolean;
  label: string;
  onClick: () => void;
  hasDropdown?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "relative w-12 h-12 rounded-full flex items-center justify-center transition-colors",
        destructive 
          ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
          : active
            ? "bg-muted text-foreground hover:bg-muted/80"
            : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="w-5 h-5" />
      {hasDropdown && (
        <div className="absolute -bottom-0.5 right-1/2 translate-x-1/2">
          <ChevronDown className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}

export function VoiceChannelArea({ channel }: { channel: Channel }) {
  const { user } = useAuthStore();
  const { members } = useServerStore();
  const setJoinedChannel = useVoiceStore((s) => s.setJoinedChannel);

  const [showQualityModal, setShowQualityModal] = useState(false);
  const [focusedScreenShare, setFocusedScreenShare] = useState<string | null>(null);

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

  // Find screen sharers
  const screenSharers = useMemo(() => {
    return filteredParticipants
      .filter((p) => p.isScreenSharing && p.screenTrack)
      .map((p) => ({
        identity: p.identity,
        track: p.screenTrack!,
        name: getMemberDisplayName(memberByUserId.get(p.identity), p),
        isLocal: p.identity === user?.id,
      }));
  }, [filteredParticipants, memberByUserId, user?.id]);

  // The screen share being watched in full view
  const watchedScreenShare = useMemo(() => {
    if (!focusedScreenShare) return screenSharers[0] || null;
    return screenSharers.find((s) => s.identity === focusedScreenShare) || screenSharers[0] || null;
  }, [focusedScreenShare, screenSharers]);

  const handleScreenShareClick = useCallback(() => {
    if (voice.localState.sharing) {
      voice.stopScreenShare();
    } else {
      setShowQualityModal(true);
    }
  }, [voice]);

  const handleStartScreenShare = useCallback((quality: ScreenShareQuality) => {
    setShowQualityModal(false);
    voice.startScreenShare(quality);
  }, [voice]);

  const isReady = !!user;

  // Calculate grid columns based on participant count
  const gridCols = useMemo(() => {
    const count = filteredParticipants.length;
    if (count <= 1) return 1;
    if (count <= 2) return 2;
    if (count <= 4) return 2;
    if (count <= 6) return 3;
    return 3;
  }, [filteredParticipants.length]);

  return (
    <div className="h-full flex flex-col min-w-0 bg-[hsl(var(--background))]">
      {/* Top bar - Discord style */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-semibold truncate">{channel.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <Users className="w-4 h-4 text-muted-foreground" />
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8">
            <LayoutGrid className="w-4 h-4 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {voice.error && (
          <div className="mx-4 mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {voice.error}
          </div>
        )}

        {!voice.isJoined ? (
          /* Join card */
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="max-w-md w-full rounded-2xl border border-border/70 bg-card/60 backdrop-blur p-6 relative overflow-hidden">
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
                      <span className="italic">Powered by LiveKit</span>
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
          </div>
        ) : (
          /* Connected view */
          <div className="flex-1 min-h-0 flex flex-col p-4 gap-4">
            {/* Screen share stage (if someone is sharing) */}
            {watchedScreenShare && (
              <div className="flex-shrink-0 max-h-[50vh] rounded-lg overflow-hidden bg-black/90 border border-border/40">
                <div className="relative w-full h-full aspect-video max-h-[50vh]">
                  <VideoPlayer track={watchedScreenShare.track} />
                  <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded bg-black/70 text-white text-sm font-medium flex items-center gap-2">
                    <MonitorUp className="w-4 h-4" />
                    {watchedScreenShare.isLocal ? "Your Screen" : watchedScreenShare.name}
                    {voice.localState.shareQuality && watchedScreenShare.isLocal && (
                      <span className="text-xs text-white/70">
                        • {voice.localState.shareQuality.resolution} @ {voice.localState.shareQuality.frameRate}fps
                      </span>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="absolute top-3 right-3 w-8 h-8"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Participant grid - Discord style */}
            <div 
              className={cn(
                "flex-1 min-h-0 grid gap-2 auto-rows-fr overflow-y-auto",
                watchedScreenShare && "max-h-[30vh]"
              )}
              style={{
                gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
              }}
            >
              {filteredParticipants.map((p) => (
                <ParticipantTile
                  key={p.identity}
                  participant={p}
                  member={memberByUserId.get(p.identity)}
                  isYou={p.identity === user?.id}
                  isDeafened={p.identity === user?.id ? voice.localState.deafened : false}
                  onWatchStream={() => setFocusedScreenShare(p.identity)}
                />
              ))}
            </div>

            {/* Remote audio elements (hidden) */}
            {filteredParticipants
              .filter((p) => p.identity !== user?.id && p.audioTrack)
              .map((p) => (
                <AudioPlayer 
                  key={p.identity} 
                  track={p.audioTrack!} 
                  muted={voice.localState.deafened} 
                />
              ))}
          </div>
        )}
      </div>

      {/* Bottom control bar - Discord style */}
      {voice.isJoined && (
        <div className="h-16 border-t border-border/40 bg-background/90 backdrop-blur flex items-center justify-center px-4 gap-2">
          {/* Left spacer for symmetry */}
          <div className="flex-1 flex items-center justify-start">
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <Users className="w-4 h-4 mr-1" />
              {filteredParticipants.length}
            </Button>
          </div>

          {/* Center controls */}
          <div className="flex items-center gap-2">
            {/* Camera button (placeholder - not functional yet) */}
            <ControlButton
              icon={VideoOff}
              label="Camera"
              onClick={() => {}}
              hasDropdown
            />

            {/* Screen share button */}
            <ControlButton
              icon={voice.localState.sharing ? MonitorOff : MonitorUp}
              active={voice.localState.sharing}
              label={voice.localState.sharing ? "Stop sharing" : "Share screen"}
              onClick={handleScreenShareClick}
              hasDropdown={!voice.localState.sharing}
            />

            {/* Microphone button */}
            <ControlButton
              icon={voice.localState.muted ? MicOff : Mic}
              active={!voice.localState.muted}
              label={voice.localState.muted ? "Unmute" : "Mute"}
              onClick={voice.toggleMute}
              hasDropdown
            />

            {/* Disconnect button */}
            <ControlButton
              icon={PhoneOff}
              destructive
              label="Disconnect"
              onClick={() => voice.leave()}
            />
          </div>

          {/* Right controls */}
          <div className="flex-1 flex items-center justify-end gap-2">
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <Volume2 className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <ExternalLink className="w-4 h-4 text-muted-foreground" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8">
              <Maximize2 className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>
        </div>
      )}

      {/* Screen share quality modal */}
      <ScreenShareQualityModal
        open={showQualityModal}
        onClose={() => setShowQualityModal(false)}
        onConfirm={handleStartScreenShare}
      />
    </div>
  );
}
