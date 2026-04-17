import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerStore } from "@/stores/serverStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { VoiceChannelArea } from "@/components/voice/VoiceChannelArea";

/**
 * Keeps an active voice connection alive while the user navigates around the app.
 *
 * - When a voice channel is joined, we keep its `VoiceChannelArea` mounted offscreen so WebRTC/audio stays active.
 * - When the user navigates back to that voice channel, we show it normally.
 * - If the user opens a different voice channel while already connected, we show a lightweight notice.
 */
export function VoicePersistentHost() {
  const navigate = useNavigate();
  const { serverId, channelId } = useParams();
  const { currentChannel, channels } = useServerStore();
  const joinedVoiceChannelId = useVoiceStore((s) => s.joinedChannelId);
  const joinedChannelSnapshot = useVoiceStore((s) => s.joinedChannel);

  const joinedChannel = useMemo(() => {
    if (!joinedVoiceChannelId) return null;
    return (
      (joinedChannelSnapshot?.id === joinedVoiceChannelId ? joinedChannelSnapshot : null) ??
      channels.find((c) => c.id === joinedVoiceChannelId) ??
      null
    );
  }, [channels, joinedChannelSnapshot, joinedVoiceChannelId]);

  // Only show voice UI *onscreen* when the user is actually on a channel route.
  // Otherwise (Home/Explore/Friends/DMs/etc), keep it mounted offscreen so audio stays alive.
  const isOnChannelRoute = !!serverId && !!channelId;

  // If we're currently browsing a voice channel but connected to a different one,
  // keep the connection alive offscreen and show a notice in the main area.
  const isViewingDifferentVoiceChannel =
    !!joinedChannel &&
    isOnChannelRoute &&
    channelId !== joinedChannel.id &&
    currentChannel?.type === "voice";

  const isViewingJoinedVoiceChannel =
    !!joinedChannel &&
    isOnChannelRoute &&
    channelId === joinedChannel.id;

  // When not connected, just render the current voice channel normally (so the join card works).
  const showCurrentVoice =
    !joinedChannel &&
    isOnChannelRoute &&
    currentChannel?.type === "voice" &&
    currentChannel.id === channelId;

  if (isViewingDifferentVoiceChannel) {
    return (
      <>
        {/* Keep the connected voice channel mounted offscreen so the call stays alive. */}
        <div className="absolute left-[-9999px] top-[-9999px] w-px h-px overflow-hidden pointer-events-none" aria-hidden>
          <VoiceChannelArea channel={joinedChannel} />
        </div>

        {/* Overlay a notice in the main area. */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-border bg-background/60 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="font-medium">You're already in a voice channel</div>
                <div className="text-sm text-muted-foreground truncate">
                  Connected to <span className="font-medium text-foreground">{joinedChannel?.name}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                className="flex-1"
                onClick={() => navigate(`/app/servers/${joinedChannel.server_id}/channels/${joinedChannel.id}`)}
              >
                Go to connected channel
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("kloak:voice:leave", { detail: { channelId: joinedChannel.id } }))
                }
              >
                Disconnect
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // When connected, keep the joined channel mounted. Show it only when user is viewing it.
  if (joinedChannel) {
    const wrapperClass = isViewingJoinedVoiceChannel
      ? "absolute inset-0"
      : "absolute left-[-9999px] top-[-9999px] w-px h-px overflow-hidden pointer-events-none";

    return (
      <div className={wrapperClass} aria-hidden={!isViewingJoinedVoiceChannel}>
        <VoiceChannelArea channel={joinedChannel} />
      </div>
    );
  }

  // Not connected: if user is viewing a voice channel, render it normally.
  if (showCurrentVoice && currentChannel) {
    return (
      <div className="absolute inset-0">
        <VoiceChannelArea channel={currentChannel} />
      </div>
    );
  }

  return null;
}
