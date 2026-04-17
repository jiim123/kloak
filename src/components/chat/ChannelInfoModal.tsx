import { ChatTeardrop, CheckCircle, ClipboardText, Eye, FilmStrip, Ghost, Hash, Link as LinkIcon, Lock, Megaphone, SpeakerHigh, Timer, Trash } from "@phosphor-icons/react";
import { useMemo } from "react";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getServerInitials } from "@/lib/serverUtils";

const channelIcons: Record<string, typeof Hash> = {
 text: Hash,
 voice: SpeakerHigh,
 forum: ChatTeardrop,
 announcement: Megaphone,
 media: FilmStrip,
 tasks: ClipboardText,
};

function formatAutoDelete(seconds: number) {
 if (seconds === 3600) return "1h";
 if (seconds === 86400) return "24h";
 if (seconds === 604800) return "7d";
 return "30d";
}

export const ChannelInfoModal = () => {
 const activeModal = useUIStore((s) => s.activeModal);
 const closeModal = useUIStore((s) => s.closeModal);
 const channel = useServerStore((s) => s.currentChannel);
 const server = useServerStore((s) => s.currentServer);

 const isOpen = activeModal === "channel-info";

 const Icon = channelIcons[channel?.type ?? "text"] ?? Hash;

 const settings = useMemo(() => {
 if (!channel) return [];
 const items: { label: string }[] = [];

 if (channel.is_private) items.push({ label: "Private Channel" });
 if (channel.is_read_only) items.push({ label: "Read-only" });
 if (channel.ghost_mode) items.push({ label: "Ghost Mode" });
 if (channel.block_links) {
 const domains = channel.allowed_link_domains;
 items.push({
 label: domains?.length
 ? `Link Blocking (allowed: ${domains.join(", ")})`
 : "Link Blocking",
 });
 }
 if (channel.block_attachments) items.push({ label: "Attachments Disabled" });
 if (channel.disable_reactions) items.push({ label: "Reactions Disabled" });
 if (channel.disable_polls) items.push({ label: "Polls Disabled" });
 if (channel.slowmode_seconds && channel.slowmode_seconds > 0)
 items.push({ label: `Slowmode: ${channel.slowmode_seconds}s` });
 if (channel.auto_delete_seconds)
 items.push({ label: `Auto-delete: ${formatAutoDelete(channel.auto_delete_seconds)}` });
 if (channel.is_nsfw) items.push({ label: "NSFW" });

 return items;
 }, [channel]);

 if (!channel) return null;

 return (
 <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
 <DialogContent className="max-w-sm bg-card border-border">
 <DialogHeader className="text-left">
 {server && (
 <div className="flex items-center gap-2 mb-3">
 <Avatar className="w-5 h-5 rounded">
 <AvatarImage src={server.icon_url || undefined} alt={server.name} />
 <AvatarFallback className="text-[10px] rounded bg-muted">{getServerInitials(server.name)}</AvatarFallback>
 </Avatar>
 <span className="text-xs text-muted-foreground font-medium">{server.name}</span>
 </div>
 )}
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
 <Icon className="w-4 h-4 text-muted-foreground" />
 </div>
 <DialogTitle className="text-foreground">{channel.name}</DialogTitle>
 </div>
 {channel.topic ? (
 <DialogDescription className="text-muted-foreground text-sm mt-2 whitespace-pre-wrap text-left">
 {channel.topic}
 </DialogDescription>
 ) : (
 <DialogDescription className="text-muted-foreground/50 text-sm mt-2 text-left">
 No description set.
 </DialogDescription>
 )}
 </DialogHeader>

 {settings.length > 0 && (
 <div className="mt-2 space-y-2">
 <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
 Channel Settings
 </span>
 <div className="space-y-1.5">
 {settings.map((s) => (
 <div key={s.label} className="flex items-center gap-2 text-sm text-foreground">
 <CheckCircle className="w-4 h-4 shrink-0 text-[hsl(var(--kloak-online))]" />
 <span>{s.label}</span>
 </div>
 ))}
 </div>
 </div>
 )}
 </DialogContent>
 </Dialog>
 );
};
