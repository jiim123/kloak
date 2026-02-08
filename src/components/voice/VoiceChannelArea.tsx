import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { 
  Mic, 
  MicOff, 
  MonitorOff, 
  MonitorUp, 
  PhoneOff, 
  Volume2, 
  VolumeX,
  Maximize2,
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
function VideoPlayer({ track, className, videoRef }: { track: MediaStreamTrack; className?: string; videoRef?: React.RefObject<HTMLVideoElement> }) {
  const internalRef = useRef<HTMLVideoElement | null>(null);
  const ref = videoRef || internalRef;

  useEffect(() => {
    if (!ref.current || !track) return;
    const stream = new MediaStream([track]);
    ref.current.srcObject = stream;
  }, [track, ref]);

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
  compact?: boolean;
};

// Discord-style participant tile
function ParticipantTile({ participant, member, isYou, isDeafened, compact }: TileProps) {
  const name = getMemberDisplayName(member, participant);
  const speaking = participant.isSpeaking;
  const bgColor = useMemo(() => stringToColor(participant.identity), [participant.identity]);

  return (
    <div
      className={cn(
        "relative rounded-lg overflow-hidden flex items-center justify-center",
        "ring-2 ring-transparent transition-all",
        speaking && "ring-primary ring-offset-2 ring-offset-background",
        compact ? "aspect-square" : "aspect-video"
      )}
      style={{ backgroundColor: bgColor }}
    >
      {/* Centered avatar */}
      <div className={cn(
        "transition-transform",
        speaking && "scale-105"
      )}>
        <AvatarWithDecoration user={member?.user} size={compact ? 40 : 80} />
      </div>

      {/* Username badge - bottom left */}
      <div className="absolute bottom-1 left-1">
        <div className={cn(
          "px-1.5 py-0.5 rounded text-xs font-medium truncate max-w-[80px]",
          speaking ? "bg-primary text-primary-foreground" : "bg-black/60 text-white"
        )}>
          {name}
        </div>
      </div>

      {/* Status icons - bottom right */}
      <div className="absolute bottom-1 right-1 flex items-center gap-0.5">
        {isDeafened && isYou && (
          <div className="w-5 h-5 rounded bg-black/60 flex items-center justify-center">
            <VolumeX className="w-3 h-3 text-white" />
          </div>
        )}
        {participant.isMuted && (
          <div className="w-5 h-5 rounded bg-black/60 flex items-center justify-center">
            <MicOff className="w-3 h-3 text-white" />
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
}: { 
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  destructive?: boolean;
  label: string;
  onClick: () => void;
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
    </button>
  );
}

export function VoiceChannelArea({ channel }: { channel: Channel }) {
  const { user } = useAuthStore();
  const { members } = useServerStore();
  const setJoinedChannel = useVoiceStore((s) => s.setJoinedChannel);

  const [showQualityModal, setShowQualityModal] = useState(false);
  const screenShareContainerRef = useRef<HTMLDivElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);

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

  // The main screen share being watched
  const watchedScreenShare = screenSharers[0] || null;

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

  const handleFullscreen = useCallback(() => {
    if (!screenShareContainerRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      screenShareContainerRef.current.requestFullscreen().catch(() => {
        // Fallback: try the video element directly
        if (screenVideoRef.current) {
          screenVideoRef.current.requestFullscreen?.();
        }
      });
    }
  }, []);

  const isReady = !!user;
  const hasScreenShare = !!watchedScreenShare;

  return (
    <div className="h-full flex flex-col min-w-0 bg-background">
      {/* Top bar */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-semibold truncate">{channel.name}</span>
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
          <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
            {/* Screen share stage */}
            {watchedScreenShare && (
              <div 
                ref={screenShareContainerRef}
                className="flex-1 min-h-0 rounded-lg overflow-hidden bg-black/90 border border-border/40 relative"
              >
                <VideoPlayer track={watchedScreenShare.track} videoRef={screenVideoRef} />
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
                  onClick={handleFullscreen}
                >
                  <Maximize2 className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Participant grid - 4 per row when screen sharing, otherwise dynamic */}
            <div 
              className={cn(
                "grid gap-2",
                hasScreenShare 
                  ? "grid-cols-4 flex-shrink-0 overflow-x-auto pb-1" 
                  : "flex-1 auto-rows-fr grid-cols-2 md:grid-cols-3"
              )}
              style={hasScreenShare ? { gridAutoRows: '80px' } : undefined}
            >
              {filteredParticipants.map((p) => (
                <ParticipantTile
                  key={p.identity}
                  participant={p}
                  member={memberByUserId.get(p.identity)}
                  isYou={p.identity === user?.id}
                  isDeafened={p.identity === user?.id ? voice.localState.deafened : false}
                  compact={hasScreenShare}
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

      {/* Bottom control bar */}
      {voice.isJoined && (
        <div className="h-16 border-t border-border/40 bg-background/90 backdrop-blur flex items-center justify-center px-4 gap-2">
          {/* Center controls */}
          <div className="flex items-center gap-2">
            {/* Screen share button */}
            <ControlButton
              icon={voice.localState.sharing ? MonitorOff : MonitorUp}
              active={voice.localState.sharing}
              label={voice.localState.sharing ? "Stop sharing" : "Share screen"}
              onClick={handleScreenShareClick}
            />

            {/* Microphone button */}
            <ControlButton
              icon={voice.localState.muted ? MicOff : Mic}
              active={!voice.localState.muted}
              label={voice.localState.muted ? "Unmute" : "Mute"}
              onClick={voice.toggleMute}
            />

            {/* Deafen button */}
            <ControlButton
              icon={voice.localState.deafened ? VolumeX : Volume2}
              active={!voice.localState.deafened}
              label={voice.localState.deafened ? "Undeafen" : "Deafen"}
              onClick={voice.toggleDeafen}
            />

            {/* Disconnect button */}
            <ControlButton
              icon={PhoneOff}
              destructive
              label="Disconnect"
              onClick={() => voice.leave()}
            />
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