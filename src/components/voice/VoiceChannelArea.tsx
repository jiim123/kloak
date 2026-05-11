import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Maximize2,
  MessageSquareText,
  Clock3,
  X,
  Mic,
  MicOff,
  Minimize2,
  MonitorOff,
  MonitorUp,
  PhoneOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocation, useParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useVoiceStore } from "@/stores/voiceStore";
import { useVoiceSettingsStore } from "@/stores/voiceSettingsStore";
import { useFriendStore } from "@/stores/friendStore";
import { useAgoraRoom, AgoraParticipant } from "@/hooks/useAgoraRoom";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import { useHideVoiceActivity } from "@/hooks/useHideVoiceActivity";
import { ScreenShareQualityModal, ScreenShareQuality } from "@/components/voice/ScreenShareQualityModal";
import { ParticipantAudioPlayer } from "@/components/voice/ParticipantAudioPlayer";
import { UserVolumeControl, VolumeIndicator } from "@/components/voice/UserVolumeControl";
import { useAutoDisconnect } from "@/hooks/useAutoDisconnect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MessageList } from "@/components/chat/MessageList";
import { MessageInput } from "@/components/chat/MessageInput";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { useTyping } from "@/hooks/useTyping";
import { useIsMobile } from "@/hooks/use-mobile";
import { fetchAndCacheUser, getUserFromCache, useUserCacheStore } from "@/stores/userCacheStore";
import type { Channel, ServerMember } from "@/types";
import type { VideoTrack } from "livekit-client";

function formatSlowmodeDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

// Video player for screen share
function VideoPlayer({ track, className }: { track: VideoTrack; className?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !track) return;

    try {
      track.attach(el);
    } catch (error) {
      console.warn("[VoiceChannelArea] Failed to attach video track:", error);
    }

    return () => {
      try {
        track.detach(el);
      } catch {
        // Track may already be cleaned up.
      }
    };
  }, [track]);

  return <video ref={ref} autoPlay playsInline className={className} />;
}

function getMemberDisplayName(member: ServerMember | undefined, participant: AgoraParticipant): string {
  const cachedUser = getUserFromCache(participant.identity);
  const resolvedUser = member?.user ?? cachedUser;
  if (member) {
    return member.nickname || resolvedUser?.display_name || resolvedUser?.username || participant.name;
  }
  return resolvedUser?.display_name || resolvedUser?.username || participant.name || participant.identity.slice(0, 8);
}

const PARTICIPANT_TILE_COLORS = [
  "#2b3440",
  "#243b53",
  "#2f3e2f",
  "#3d3226",
  "#2f2d49",
  "#3a2f3f",
  "#2b3e45",
  "#384252",
];

function getParticipantTileColor(identity: string): string {
  let hash = 0;
  for (let i = 0; i < identity.length; i += 1) {
    hash = (hash * 31 + identity.charCodeAt(i)) >>> 0;
  }
  return PARTICIPANT_TILE_COLORS[hash % PARTICIPANT_TILE_COLORS.length];
}

function hasActiveScreenShare(participant: Pick<AgoraParticipant, "isScreenSharing" | "screenTrack">): boolean {
  const track = participant.screenTrack;
  return (
    !!participant.isScreenSharing &&
    !!track &&
    track.mediaStreamTrack.readyState === "live" &&
    !track.isMuted
  );
}

function hasActiveCameraShare(participant: Pick<AgoraParticipant, "isCameraSharing" | "cameraTrack">): boolean {
  const track = participant.cameraTrack;
  return (
    !!participant.isCameraSharing &&
    !!track &&
    track.mediaStreamTrack.readyState === "live" &&
    !track.isMuted
  );
}

type TileProps = {
  participant: AgoraParticipant;
  member: ServerMember | undefined;
  avatarUser?: ServerMember["user"];
  isYou: boolean;
  isDeafened: boolean;
  backgroundColor: string;
  onWatchShare?: (() => void) | null;
  isWatchingShare?: boolean;
};

function ParticipantTile({
  participant,
  member,
  avatarUser,
  isYou,
  isDeafened,
  backgroundColor,
  onWatchShare,
  isWatchingShare,
}: TileProps) {
  const name = getMemberDisplayName(member, participant);
  const visualVoiceIndicators = useVoiceSettingsStore((s) => s.settings.visualVoiceIndicators);
  const speaking = participant.isSpeaking && !participant.hideVoiceActivity && visualVoiceIndicators;
  const [volumeOpen, setVolumeOpen] = useState(false);
  const isScreenSharing = hasActiveScreenShare(participant);
  const isCameraSharing = hasActiveCameraShare(participant);
  const isSharing = isScreenSharing || isCameraSharing;

  const tileContent = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border min-h-[170px] sm:min-h-[210px] transition-transform",
        speaking ? "border-primary/70" : "border-white/15",
        !isYou && "cursor-pointer hover:scale-[1.01]"
      )}
    >
      <div className="absolute inset-0" style={{ backgroundColor }} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/20" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className={cn("rounded-full bg-black/10 p-1.5 backdrop-blur-[1px]", isSharing && "ring-2 ring-white/25")}>
          <AvatarWithDecoration user={avatarUser} size={78} freezeGifUntilHover />
        </div>
      </div>

      {!isYou && isSharing && onWatchShare ? (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="pointer-events-auto h-9 px-4 rounded-full bg-black/55 text-white border border-white/25 hover:bg-black/70"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onWatchShare();
            }}
          >
            <Eye className="w-3.5 h-3.5 mr-1.5" />
            {isWatchingShare ? "Watching" : "Watch Stream"}
          </Button>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 p-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0 rounded-md bg-black/40 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
          <div className="truncate">{name}</div>
        </div>

        <div className="shrink-0 flex items-center gap-1.5 rounded-md bg-black/35 px-2 py-1 text-white/90 backdrop-blur">
          {!isYou && <VolumeIndicator userId={participant.identity} />}
          {isDeafened && isYou ? <VolumeX className="w-3.5 h-3.5" /> : null}
          {participant.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          {isScreenSharing ? <MonitorUp className="w-3.5 h-3.5" /> : null}
          {!isScreenSharing && isCameraSharing ? <Video className="w-3.5 h-3.5" /> : null}
        </div>
      </div>

      {speaking ? <div className="absolute inset-0 ring-2 ring-primary/80 pointer-events-none" /> : null}
    </div>
  );

  // Only wrap in popover for other users (not yourself)
  if (isYou) {
    return tileContent;
  }

  return (
    <Popover open={volumeOpen} onOpenChange={setVolumeOpen}>
      <PopoverTrigger asChild>{tileContent}</PopoverTrigger>
      <PopoverContent
        className="w-56 p-0"
        side="top"
        align="center"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <UserVolumeControl
          userId={participant.identity}
          userName={name}
          onClose={() => setVolumeOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}

export function VoiceChannelArea({ channel }: { channel: Channel }) {
  const isMobile = useIsMobile();
  const location = useLocation();
  const { channelId: routeChannelId } = useParams();
  const { user } = useAuthStore();
  const { members, channels } = useServerStore();
  const setJoinedChannel = useVoiceStore((s) => s.setJoinedChannel);
  const connectionStatus = useVoiceStore((s) => s.connection.status);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [watchingStreamKey, setWatchingStreamKey] = useState<string | null>(null);
  const [isTextPanelOpen, setIsTextPanelOpen] = useState(false);
  const [isStageFullscreen, setIsStageFullscreen] = useState(false);
  const [slowmodeStatus, setSlowmodeStatus] = useState<{ enabled: boolean; blocked: boolean; immune: boolean; remainingSeconds: number }>({
    enabled: false,
    blocked: false,
    immune: false,
    remainingSeconds: 0,
  });
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const userCacheVersion = useUserCacheStore((s) => s._version);

  const voice = useAgoraRoom({
    channelId: channel.id,
    userId: user?.id || null,
    displayName: user?.display_name || user?.username,
  });

  // Connect Push-to-Talk hook
  const effectivelyJoined = voice.isJoined && connectionStatus === "joined";
  const leaveVoice = voice.leave;
  const toggleVoiceMute = voice.toggleMute;
  const toggleVoiceDeafen = voice.toggleDeafen;

  usePushToTalk({
    room: voice.room,
    isConnected: effectivelyJoined,
    onMuteChange: (muted) => {
      // Sync mute state from PTT to voice controls
      useVoiceStore.getState().setControls({ muted });
    },
  });

  // Connect hide voice activity hook (syncs setting to LiveKit metadata)
  useHideVoiceActivity({
    room: voice.room,
    isConnected: effectivelyJoined,
  });

  // Check if local user is speaking (for auto-disconnect)
  const localParticipant = voice.participants.find((p) => p.identity === user?.id);
  const isLocalSpeaking = localParticipant?.isSpeaking ?? false;

  // Auto-disconnect timer
  useAutoDisconnect({
    isJoined: effectivelyJoined,
    isSpeaking: isLocalSpeaking,
    onDisconnect: leaveVoice,
  });

  const handleStartScreenShare = (quality: ScreenShareQuality) => {
    setShowQualityModal(false);
    voice.startScreenShare(quality);
  };

  // Persist the joined voice channel metadata
  useEffect(() => {
    if (effectivelyJoined) {
      setJoinedChannel(channel);
    } else {
      const prev = useVoiceStore.getState().joinedChannel;
      if (prev?.id === channel.id) setJoinedChannel(null);
    }
  }, [channel, setJoinedChannel, effectivelyJoined]);

  // Listen for disconnect request from sidebar banner
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (e.detail?.channelId !== channel.id) return;
      leaveVoice();
    };
    window.addEventListener("kloak:voice:leave", handler as EventListener);
    return () => window.removeEventListener("kloak:voice:leave", handler as EventListener);
  }, [channel.id, leaveVoice]);

  // Listen for mute/deafen toggle from sidebar banner
  useEffect(() => {
    const onMute = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (e.detail?.channelId !== channel.id) return;
      toggleVoiceMute();
    };
    const onDeafen = (ev: Event) => {
      const e = ev as CustomEvent<{ channelId?: string }>;
      if (e.detail?.channelId !== channel.id) return;
      toggleVoiceDeafen();
    };
    window.addEventListener("kloak:voice:toggleMute", onMute as EventListener);
    window.addEventListener("kloak:voice:toggleDeafen", onDeafen as EventListener);
    return () => {
      window.removeEventListener("kloak:voice:toggleMute", onMute as EventListener);
      window.removeEventListener("kloak:voice:toggleDeafen", onDeafen as EventListener);
    };
  }, [channel.id, toggleVoiceMute, toggleVoiceDeafen]);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, ServerMember>();
    for (const m of members) map.set(m.user_id, m);
    return map;
  }, [members]);

  useEffect(() => {
    void userCacheVersion;
    const uniqueIds = Array.from(new Set(voice.participants.map((p) => p.identity)));
    for (const userId of uniqueIds) {
      if (memberByUserId.get(userId)?.user) continue;
      if (getUserFromCache(userId)) continue;
      fetchAndCacheUser(userId).catch(() => {});
    }
  }, [voice.participants, memberByUserId, userCacheVersion]);

  const linkedTextChannel = useMemo(() => {
    return (
      channels.find(
        (c) => c.type === "text" && c.linked_voice_channel_id === channel.id && c.server_id === channel.server_id
      ) || null
    );
  }, [channels, channel.id, channel.server_id]);
  const isLinkedTextGhostMode = linkedTextChannel?.ghost_mode ?? false;
  const showTextPanel =
    isTextPanelOpen && !!linkedTextChannel && (!isMobile || routeChannelId === channel.id);
  const { typingUsers, startTyping, stopTyping } = useTyping(
    showTextPanel && linkedTextChannel && !isLinkedTextGhostMode ? linkedTextChannel.id : null
  );

  // Filter out blocked users
  const filteredParticipants = useMemo(() => {
    const blocked = new Set(useFriendStore.getState().visibilityBlockedUserIds);
    return voice.participants.filter((p) => !blocked.has(p.identity));
  }, [voice.participants]);

  const remoteStreams = useMemo(() => {
    const streams: Array<{
      streamKey: string;
      identity: string;
      kind: "screen" | "camera";
      track: VideoTrack;
      name: string;
    }> = [];

    for (const p of filteredParticipants) {
      if (p.identity === user?.id) continue;
      const name = getMemberDisplayName(memberByUserId.get(p.identity), p);
      if (hasActiveScreenShare(p) && p.screenTrack) {
        streams.push({
          streamKey: `${p.identity}:screen`,
          identity: p.identity,
          kind: "screen",
          track: p.screenTrack,
          name,
        });
      }
      if (hasActiveCameraShare(p) && p.cameraTrack) {
        streams.push({
          streamKey: `${p.identity}:camera`,
          identity: p.identity,
          kind: "camera",
          track: p.cameraTrack,
          name,
        });
      }
    }

    return streams;
  }, [filteredParticipants, user?.id, memberByUserId]);

  const localStream = useMemo(() => {
    const localP = filteredParticipants.find((p) => p.identity === user?.id);
    if (!localP) return null;

    // Use local state as source of truth so stage disappears immediately on stop.
    if (voice.localState.sharing && hasActiveScreenShare(localP)) {
      return {
        streamKey: `${localP.identity}:screen`,
        identity: localP.identity,
        kind: "screen" as const,
        track: localP.screenTrack!,
        name: getMemberDisplayName(memberByUserId.get(localP.identity), localP),
        isLocal: true as const,
      };
    }
    if (voice.localState.cameraSharing && hasActiveCameraShare(localP)) {
      return {
        streamKey: `${localP.identity}:camera`,
        identity: localP.identity,
        kind: "camera" as const,
        track: localP.cameraTrack!,
        name: getMemberDisplayName(memberByUserId.get(localP.identity), localP),
        isLocal: true as const,
      };
    }
    return null;
  }, [filteredParticipants, memberByUserId, user?.id, voice.localState.sharing, voice.localState.cameraSharing]);

  const watchedRemoteStream = useMemo(() => {
    if (!watchingStreamKey) return null;
    const selected = remoteStreams.find((p) => p.streamKey === watchingStreamKey);
    return selected ? { ...selected, isLocal: false as const } : null;
  }, [remoteStreams, watchingStreamKey]);

  const stage = watchedRemoteStream || localStream;
  const hasRemoteShares = remoteStreams.length > 0;
  const isReady = !!user;

  useEffect(() => {
    if (!watchingStreamKey) return;
    if (!remoteStreams.some((p) => p.streamKey === watchingStreamKey)) {
      setWatchingStreamKey(null);
    }
  }, [remoteStreams, watchingStreamKey]);

  useEffect(() => {
    const onFullScreenChange = () => {
      const stageEl = stageContainerRef.current;
      setIsStageFullscreen(!!stageEl && document.fullscreenElement === stageEl);
    };
    document.addEventListener("fullscreenchange", onFullScreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullScreenChange);
  }, []);

  useEffect(() => {
    setIsTextPanelOpen(false);
  }, [channel.id]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("voiceChat") === "1" && linkedTextChannel) {
      setIsTextPanelOpen(true);
    }
  }, [location.search, linkedTextChannel]);

  // On mobile, never auto-open linked text when entering a voice route.
  useEffect(() => {
    if (!isMobile) return;
    if (routeChannelId === channel.id) {
      setIsTextPanelOpen(false);
    }
  }, [isMobile, routeChannelId, channel.id]);

  const handleOpenLinkedText = () => {
    if (!linkedTextChannel) return;
    setIsTextPanelOpen(true);
  };

  const handleToggleStageFullscreen = async () => {
    const stageEl = stageContainerRef.current;
    if (!stageEl) return;
    try {
      if (document.fullscreenElement === stageEl) {
        await document.exitFullscreen();
      } else {
        await stageEl.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen API failures (browser policy / unsupported context).
    }
  };

  const textPanelToggle = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        "h-8 w-8 rounded-lg text-muted-foreground hover:bg-white/10 hover:text-white",
        showTextPanel && "bg-white/10 text-white"
      )}
      onClick={() => (showTextPanel ? setIsTextPanelOpen(false) : handleOpenLinkedText())}
      disabled={!linkedTextChannel}
      title={
        !linkedTextChannel
          ? "No attached text chat yet"
          : "Open attached text chat"
      }
    >
      <MessageSquareText className="w-4 h-4" />
    </Button>
  );

  return (
    <div className="h-full flex flex-col min-w-0 bg-black text-white relative overflow-hidden md:gap-2">
      <ChannelHeader channel={channel} extraActions={textPanelToggle} showMessageActions={false} />

      <div className="flex h-11 items-center justify-between border-b border-white/10 bg-black/95 px-3 sm:px-4 md:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Volume2 className="h-4 w-4 flex-shrink-0 text-white/70" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{channel.name}</div>
            <div className="truncate text-[11px] text-white/55">
              {effectivelyJoined ? "Voice connected" : "Not connected"}
            </div>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-8 w-8 text-white/70 hover:bg-white/10 hover:text-white",
            showTextPanel && "bg-white/10 text-white"
          )}
          onClick={() => (showTextPanel ? setIsTextPanelOpen(false) : handleOpenLinkedText())}
          disabled={!linkedTextChannel}
          title={
            !linkedTextChannel
              ? "No attached text chat yet"
              : "Open attached text chat"
          }
        >
          <MessageSquareText className="h-4 w-4" />
        </Button>
      </div>

      {/* Main content */}
      <div
        className={cn(
          "flex-1 min-h-0 flex relative overflow-hidden transition-[padding] duration-200",
          showTextPanel && "lg:pr-[420px]"
        )}
      >
        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 p-2.5 sm:p-3",
            effectivelyJoined ? "overflow-y-auto" : "h-full flex items-center justify-center"
          )}
        >
          {voice.error && (
            <div className="mb-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {voice.error}
            </div>
          )}

          {!effectivelyJoined ? (
            <div className="relative w-full h-full min-h-[460px] flex items-center justify-center">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute -inset-24 sm:-inset-28 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.18)_0%,rgba(59,130,246,0.14)_34%,rgba(99,102,241,0.1)_54%,rgba(0,0,0,0)_82%)]" />
                <div className="absolute -inset-16 sm:-inset-20 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_28%,rgba(0,0,0,0)_72%)]" />
              </div>

              <div className="relative z-10 flex max-w-[560px] flex-col items-center text-center px-5">
                <h2 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  Join <span className="text-primary">#{channel.name}</span>
                </h2>

                <p className="mt-2 text-base sm:text-lg text-white/75 leading-relaxed">
                  Talk with friends and share your screen seamlessly.
                </p>

                <p className="mt-2 text-sm text-white/50 italic">Voice channels are still beta</p>

                <Button
                  className="mt-7 h-11 px-10 rounded-xl bg-white text-black hover:bg-white/90 text-base font-normal"
                  disabled={!isReady || voice.status === "joining"}
                  onClick={() => voice.join()}
                >
                  {voice.status === "joining" ? "Connecting..." : "Join voice"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[1240px]">
              {stage ? (
                <div
                  ref={stageContainerRef}
                  className={cn(
                    "mb-3 overflow-hidden border border-white/15 bg-black flex flex-col rounded-xl",
                    isStageFullscreen && "h-full w-full rounded-none border-0 mb-0"
                  )}
                >
                  <div
                    className={cn(
                      "px-3 py-2 border-b border-white/15 bg-black/70 flex items-center justify-between gap-2",
                      isStageFullscreen && "absolute inset-x-0 top-0 z-10 border-white/20 bg-black/45 backdrop-blur"
                    )}
                  >
                    <div className="text-sm font-medium truncate text-white">
                      {stage.isLocal
                        ? `Your Live ${stage.kind === "screen" ? "Screen" : "Camera"}`
                        : `${stage.name} - Live ${stage.kind === "screen" ? "Screen" : "Camera"}`}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs rounded-full text-white/90 bg-white/10 hover:bg-white/20"
                        onClick={handleToggleStageFullscreen}
                      >
                        {isStageFullscreen ? (
                          <Minimize2 className="w-3 h-3 mr-1" />
                        ) : (
                          <Maximize2 className="w-3 h-3 mr-1" />
                        )}
                        {isStageFullscreen ? "Exit" : "Full Screen"}
                      </Button>
                      {!stage.isLocal ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs rounded-full text-white/90 bg-white/10 hover:bg-white/20"
                          onClick={() => setWatchingStreamKey(null)}
                        >
                          Stop watching
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-center bg-black",
                      isStageFullscreen ? "h-full w-full" : "aspect-video max-h-[68vh]"
                    )}
                  >
                    <VideoPlayer
                      track={stage.track}
                      className={cn(
                        isStageFullscreen
                          ? "h-full w-full max-h-none max-w-none object-contain"
                          : "h-full w-full object-contain"
                      )}
                    />
                  </div>
                </div>
              ) : null}

              {!stage && hasRemoteShares ? (
                <div className="mb-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-white/75">
                  A participant is sharing video. Click <span className="font-medium text-white">Watch Stream</span> on
                  their tile.
                </div>
              ) : null}

              {filteredParticipants.length === 0 ? (
                <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent p-6 sm:p-8">
                  <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                    <div className="relative shrink-0">
                      <div className="absolute inset-0 rounded-full bg-primary/20 blur-2xl" />
                      <div className="absolute -left-3 -top-2 h-14 w-14 rounded-full bg-cyan-400/20 blur-xl" />
                      <div className="absolute -right-2 -bottom-2 h-16 w-16 rounded-full bg-blue-500/20 blur-xl" />
                      <div className="relative h-28 w-28 sm:h-32 sm:w-32 rounded-full bg-black/35 border border-white/15 flex items-center justify-center">
                        <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-primary/45 via-cyan-400/35 to-blue-500/30 blur-[1px]" />
                      </div>
                    </div>

                    <div className="min-w-0 text-center sm:text-left">
                      <h3 className="text-xl sm:text-2xl font-semibold text-white">It is quiet in here</h3>
                      <p className="mt-2 text-sm sm:text-base text-white/70">
                        You are connected to <span className="text-white font-medium">#{channel.name}</span>. Invite
                        others to join, or start sharing your screen to kick things off.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-2 text-xs">
                        <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-white/80">
                          Voice ready
                        </span>
                        <span className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-white/80">
                          Screen share ready
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "grid gap-2.5 sm:gap-3",
                    filteredParticipants.length <= 1
                      ? "grid-cols-1 max-w-[460px] mx-auto w-full"
                      : "grid-cols-1 sm:grid-cols-2"
                  )}
                >
                  {filteredParticipants.map((p) => (
                    <ParticipantTile
                      key={p.identity}
                      participant={p}
                      member={memberByUserId.get(p.identity)}
                      avatarUser={memberByUserId.get(p.identity)?.user ?? getUserFromCache(p.identity) ?? undefined}
                      isYou={p.identity === user?.id}
                      isDeafened={p.identity === user?.id ? voice.localState.deafened : false}
                      backgroundColor={getParticipantTileColor(p.identity)}
                      isWatchingShare={
                        watchingStreamKey === `${p.identity}:screen` ||
                        watchingStreamKey === `${p.identity}:camera`
                      }
                      onWatchShare={
                        p.identity !== user?.id && (hasActiveScreenShare(p) || hasActiveCameraShare(p))
                          ? () =>
                              setWatchingStreamKey((current) => {
                                const next =
                                  hasActiveScreenShare(p) && p.screenTrack
                                    ? `${p.identity}:screen`
                                    : hasActiveCameraShare(p) && p.cameraTrack
                                      ? `${p.identity}:camera`
                                      : null;
                                return current === next ? null : next;
                              })
                          : null
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Remote audio elements (hidden) - using Web Audio API with per-user volume */}
          {filteredParticipants
            .filter((p) => p.identity !== user?.id && p.audioTrack)
            .map((p) => (
              <ParticipantAudioPlayer
                key={p.identity}
                participantId={p.identity}
                track={p.audioTrack!}
                muted={voice.localState.deafened}
              />
            ))}
        </div>
      </div>

      {/* Bottom control bar */}
      {effectivelyJoined && (
        <div
          className={cn(
            "h-20 border-t border-white/10 bg-black flex items-center justify-center px-3 relative transition-[padding] duration-200",
            showTextPanel && "lg:pr-[420px]"
          )}
        >
          <div className="hidden md:flex absolute left-4 items-center gap-2 text-xs text-white/60">
            <Volume2 className="w-3.5 h-3.5" />
            <span>{filteredParticipants.length} connected</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className={cn(
                "h-12 w-12 rounded-full border border-white/15 flex items-center justify-center transition-colors",
                voice.localState.sharing
                  ? "bg-red-500 text-white border-red-400 hover:bg-red-500/90"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
              onClick={() => (voice.localState.sharing ? voice.stopScreenShare() : setShowQualityModal(true))}
              title={voice.localState.sharing ? "Stop sharing" : "Share screen"}
            >
              {voice.localState.sharing ? <MonitorOff className="w-5 h-5" /> : <MonitorUp className="w-5 h-5" />}
            </button>

            <button
              type="button"
              className={cn(
                "h-12 w-12 rounded-full border border-white/15 flex items-center justify-center transition-colors",
                voice.localState.cameraSharing
                  ? "bg-red-500 text-white border-red-400 hover:bg-red-500/90"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
              onClick={() =>
                voice.localState.cameraSharing ? voice.stopCameraShare() : voice.startCameraShare()
              }
              title={voice.localState.cameraSharing ? "Stop camera" : "Share camera"}
            >
              {voice.localState.cameraSharing ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>

            <button
              type="button"
              className={cn(
                "h-12 w-12 rounded-full border border-white/15 flex items-center justify-center transition-colors",
                voice.localState.deafened
                  ? "bg-red-500 text-white border-red-400 hover:bg-red-500/90"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
              onClick={voice.toggleDeafen}
              title={voice.localState.deafened ? "Undeafen" : "Deafen"}
            >
              {voice.localState.deafened ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            <button
              type="button"
              className={cn(
                "h-12 w-12 rounded-full border border-white/15 flex items-center justify-center transition-colors",
                voice.localState.muted
                  ? "bg-red-500 text-white border-red-400 hover:bg-red-500/90"
                  : "bg-white/10 text-white hover:bg-white/20"
              )}
              onClick={voice.toggleMute}
              title={voice.localState.muted ? "Unmute" : "Mute"}
            >
              {voice.localState.muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            <button
              type="button"
              className="h-12 w-12 rounded-full border border-red-400 bg-red-500 text-white hover:bg-red-500/90 flex items-center justify-center transition-colors"
              onClick={() => voice.leave()}
              title="Disconnect"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Voice-attached text panel */}
      {showTextPanel && (
        <aside className="absolute bottom-0 right-0 top-11 z-30 w-full overflow-hidden border-l border-white/15 bg-background/95 backdrop-blur md:top-0 sm:w-[420px]">
          <div className="h-full flex flex-col min-h-0">
            <div className="h-14 px-3 border-b border-border/70 flex items-center justify-between bg-background">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {linkedTextChannel ? `#${linkedTextChannel.name}` : "Attached text"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">Voice channel text chat</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8"
                onClick={() => setIsTextPanelOpen(false)}
                title="Close text panel"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {linkedTextChannel ? (
              <>
                <MessageList
                  channelId={linkedTextChannel.id}
                  channelName={linkedTextChannel.name}
                  manageCurrentChannel={false}
                />
                <div className="shrink-0">
                  {!isLinkedTextGhostMode && (
                    <TypingIndicator
                      typingUsers={typingUsers}
                      reserveSpace
                      rightContent={
                        slowmodeStatus.enabled ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/80">
                            <Clock3 className="h-3.5 w-3.5" />
                            <span>
                              {slowmodeStatus.immune
                                ? "Slowmode Immune"
                                : `slow mode${slowmodeStatus.blocked ? ` ${formatSlowmodeDuration(slowmodeStatus.remainingSeconds)}` : ""}`}
                            </span>
                          </span>
                        ) : null
                      }
                    />
                  )}
                  <MessageInput
                    channelId={linkedTextChannel.id}
                    channelName={linkedTextChannel.name}
                    onTyping={startTyping}
                    onStopTyping={stopTyping}
                    onSlowmodeStatusChange={setSlowmodeStatus}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 text-sm text-muted-foreground">
                No attached text channel found.
              </div>
            )}
          </div>
        </aside>
      )}

      <ScreenShareQualityModal
        open={showQualityModal}
        onClose={() => setShowQualityModal(false)}
        onConfirm={handleStartScreenShare}
      />
    </div>
  );
}
