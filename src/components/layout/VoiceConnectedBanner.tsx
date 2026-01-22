import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, PhoneOff, Volume2, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useServerStore } from "@/stores/serverStore";
import { useVoiceStore } from "@/stores/voiceStore";

export function VoiceConnectedBanner({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { currentServer, channels } = useServerStore();
  const joinedVoiceChannelId = useVoiceStore((s) => s.joinedChannelId);
  const connection = useVoiceStore((s) => s.connection);

  const activeChannelId = connection.channelId ?? joinedVoiceChannelId;

  const channelName = useMemo(() => {
    if (!activeChannelId) return null;
    return channels.find((c) => c.id === activeChannelId)?.name ?? "Voice";
  }, [channels, activeChannelId]);

  // Best-effort: request disconnect. The active VoiceChannelArea listens to this and leaves.
  const requestDisconnect = () => {
    if (!activeChannelId) return;
    window.dispatchEvent(new CustomEvent("kloak:voice:leave", { detail: { channelId: activeChannelId } }));
  };

  const jumpToChannel = () => {
    if (!currentServer || !activeChannelId) return;
    navigate(`/app/servers/${currentServer.id}/channels/${activeChannelId}`);
  };

  const isVisible = !!activeChannelId && connection.status !== "idle";
  const statusLabel =
    connection.status === "joining"
      ? "Connecting…"
      : connection.status === "joined"
        ? "Connected"
        : connection.status === "error"
          ? "Connection failed"
          : "Voice";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className={cn(
            "mx-2 mb-2 rounded-xl border border-border/60 bg-layout-sidebar/80 backdrop-blur px-3 py-2",
            className,
          )}
        >
          <div className="w-full flex items-center justify-between gap-3">
            <button
              onClick={jumpToChannel}
              className="min-w-0 flex-1 flex items-center gap-2 text-left rounded-lg hover:bg-secondary/40 transition-colors px-1 py-1"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {connection.status === "joining" ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin" />
                ) : connection.status === "error" ? (
                  <Wifi className="w-4 h-4 text-destructive" />
                ) : (
                  <Volume2 className="w-4 h-4 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <div
                  className={cn(
                    "text-xs font-semibold",
                    connection.status === "error" ? "text-destructive" : "text-primary",
                  )}
                >
                  {statusLabel}
                </div>
                <div className="text-sm text-foreground truncate">{channelName}</div>
              </div>
            </button>

            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="w-8 h-8 flex-shrink-0"
              onClick={() => requestDisconnect()}
              title="Disconnect"
            >
              <PhoneOff className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

