import { CircleNotch, PhoneSlash, WifiHigh } from "@phosphor-icons/react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useServerStore } from "@/stores/serverStore";
import { useVoiceStore } from "@/stores/voiceStore";

function VoiceBarsIcon({ className }: { className?: string }) {
 return (
 <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
 <path
 d="M4 20V19M8 20V16M12 20V12M16 20V8"
 stroke="#1adb00"
 
 strokeLinecap="round"
 strokeLinejoin="round"
 />
 </svg>
 );
}

export function VoiceConnectedBanner({ className }: { className?: string }) {
 const navigate = useNavigate();
 const { currentServer, channels } = useServerStore();
 const joinedVoiceChannelId = useVoiceStore((s) => s.joinedChannelId);
 const joinedChannelSnapshot = useVoiceStore((s) => s.joinedChannel);
 const connection = useVoiceStore((s) => s.connection);

 const activeChannelId = connection.channelId ?? joinedVoiceChannelId;

 const channelName = useMemo(() => {
 if (!activeChannelId) return null;
 if (joinedChannelSnapshot?.id === activeChannelId) return joinedChannelSnapshot.name;
 return channels.find((c) => c.id === activeChannelId)?.name ?? "Voice";
 }, [channels, activeChannelId, joinedChannelSnapshot]);

 const activeServerId = useMemo(() => {
 if (!activeChannelId) return null;
 if (joinedChannelSnapshot?.id === activeChannelId) return joinedChannelSnapshot.server_id;
 return channels.find((c) => c.id === activeChannelId)?.server_id ?? currentServer?.id ?? null;
 }, [activeChannelId, channels, currentServer?.id, joinedChannelSnapshot]);

 // Best-effort: request disconnect. The active VoiceChannelArea listens to this and leaves.
 const requestDisconnect = () => {
 if (!activeChannelId) return;
 window.dispatchEvent(new CustomEvent("kloak:voice:leave", { detail: { channelId: activeChannelId } }));
 };

 const jumpToChannel = () => {
 if (!activeServerId || !activeChannelId) return;
 navigate(`/app/servers/${activeServerId}/channels/${activeChannelId}`);
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
 // Full width like LoggedInUserPanel; inner content can wrap to multiple lines.
 "w-full",
 className,
 )}
 >
 <div className="w-full border-t border-border/50 bg-layout-sidebar/80 backdrop-blur">
 <div className="w-full flex items-center gap-2 px-3 py-2">
 <button
 onClick={jumpToChannel}
 className="min-w-0 flex-1 flex items-center gap-2 text-left hover:bg-secondary/40 transition-colors px-0 py-0 rounded-md"
 >
 <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
 {connection.status === "joining" ? (
 <CircleNotch className="w-4 h-4 text-primary animate-spin" />
 ) : connection.status === "error" ? (
 <WifiHigh className="w-4 h-4 text-destructive" />
 ) : (
 <VoiceBarsIcon className="w-5 h-5" />
 )}
 </div>
 <div className="min-w-0">
 <div
 className={cn(
 "text-[11px] font-medium leading-tight",
 connection.status === "error" ? "text-destructive" : "text-muted-foreground",
 )}
 >
 {statusLabel}
 </div>
 <div className="text-sm text-foreground whitespace-normal break-words leading-snug">{channelName}</div>
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
 <PhoneSlash className="w-4 h-4" />
 </Button>
 </div>
 </div>
 </motion.div>
 )}
 </AnimatePresence>
 );
}

