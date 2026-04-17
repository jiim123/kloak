import { Archive, Bell, BellRinging, BellSlash, Check, ClipboardText, Clock, Copy, CopySimple, Eye, EyeSlash, FolderSimplePlus, Gear, Hash, Link as LinkIcon, PushPin, PushPinSlash, SpeakerHigh, SpeakerSlash, Trash, UserPlus } from "@phosphor-icons/react";
import { useMemo } from "react";

import { toast } from "sonner";
import {
 ContextMenuContent,
 ContextMenuItem,
 ContextMenuSeparator,
 ContextMenuSub,
 ContextMenuSubContent,
 ContextMenuSubTrigger,
 ContextMenuLabel,
} from "@/components/ui/context-menu";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useChannelSettingsStore } from "@/stores/channelSettingsStore";
import type { Channel, ChannelCategory } from "@/types";

interface ChannelContextMenuProps {
 channel: Channel;
 isAdmin: boolean;
 categories: ChannelCategory[];
 onEdit: () => void;
 onDelete: () => void;
 onCopyLink: () => void;
 onMarkAsRead?: () => void;
}

export const ChannelContextMenu = ({
 channel,
 isAdmin,
 categories,
 onEdit,
 onDelete,
 onCopyLink,
 onMarkAsRead,
}: ChannelContextMenuProps) => {
 const { user } = useAuthStore();
 const { currentServer, createChannel, moveChannelToCategory } = useServerStore();
 const { openModal } = useUIStore();
 const {
 isMuted,
 isHidden,
 isPinned,
 getNotificationLevel,
 toggleMute,
 toggleHide,
 togglePin,
 setNotificationLevel,
 muteFor,
 } = useChannelSettingsStore();

 const channelMuted = isMuted(channel.id);
 const channelHidden = isHidden(channel.id);
 const channelPinned = isPinned(channel.id);
 const notifLevel = getNotificationLevel(channel.id);

 const otherCategories = useMemo(
 () => (categories ?? []).filter((c) => c.id !== channel.category_id),
 [categories, channel.category_id],
 );

 const handleCopyChannelId = () => {
 navigator.clipboard.writeText(channel.id).then(
 () => toast.success("Channel ID copied!"),
 () => toast.error("Failed to copy"),
 );
 };

 const handleDuplicateChannel = async () => {
 if (!user || !currentServer) return;
 try {
 const newChannel = await createChannel(
 currentServer.id,
 `${channel.name}-copy`,
 channel.type,
 user.id,
 channel.category_id ?? undefined,
 channel.icon ?? undefined,
 channel.is_private,
 channel.ghost_mode,
 );
 if (newChannel) toast.success(`Channel duplicated as #${newChannel.name}`);
 } catch {
 toast.error("Failed to duplicate channel");
 }
 };

 const handleMoveToCategory = async (categoryId: string | null) => {
 try {
 await moveChannelToCategory(channel.id, categoryId);
 toast.success("Channel moved!");
 } catch {
 toast.error("Failed to move channel");
 }
 };

 const handleToggleMute = async () => {
 await toggleMute(channel.id);
 toast.success(channelMuted ? "Channel unmuted" : "Channel muted");
 };

 const handleToggleHide = async () => {
 await toggleHide(channel.id);
 toast.success(channelHidden ? "Channel unhidden" : "Channel hidden from sidebar");
 };

 const handleTogglePin = async () => {
 await togglePin(channel.id);
 toast.success(channelPinned ? "Channel unpinned" : "Channel pinned to top");
 };

 const handleSetNotifLevel = async (level: "all" | "mentions" | "nothing") => {
 await setNotificationLevel(channel.id, level);
 const labels = { all: "All Messages", mentions: "@Mentions Only", nothing: "Nothing" };
 toast.success(`Notifications set to: ${labels[level]}`);
 };

 const handleMuteFor = async (minutes: number | null) => {
 await muteFor(channel.id, minutes);
 if (minutes === null) {
 toast.success("Channel muted until you turn it back on");
 } else if (minutes < 60) {
 toast.success(`Channel muted for ${minutes} minutes`);
 } else {
 toast.success(`Channel muted for ${minutes / 60} hours`);
 }
 };

 const handleNotImplemented = (feature: string) => {
 toast.info(`${feature} — coming soon!`);
 };

 return (
 <ContextMenuContent className="w-56">
 {/* ========== ADMIN SECTION ========== */}
 {isAdmin && (
 <>
 <ContextMenuItem onClick={() => openModal("edit-channel", { channelId: channel.id })}>
 <Gear className="w-4 h-4" />
 Channel Gear
 </ContextMenuItem>
 {onMarkAsRead && (
 <ContextMenuItem onClick={onMarkAsRead}>
 <Check className="w-4 h-4" />
 Mark as Read
 </ContextMenuItem>
 )}
 <ContextMenuItem onClick={handleToggleMute}>
 {channelMuted ? <SpeakerHigh className="w-4 h-4" /> : <BellSlash className="w-4 h-4" />}
 {channelMuted ? "Unmute Channel" : "Mute Channel"}
 </ContextMenuItem>

 <ContextMenuSeparator />

 <ContextMenuItem onClick={handleDuplicateChannel}>
 <CopySimple className="w-4 h-4" />
 Duplicate Channel
 </ContextMenuItem>
 <ContextMenuItem onClick={() => handleNotImplemented("Archive Channel")}>
 <Archive className="w-4 h-4" />
 Archive Channel
 </ContextMenuItem>

 {/* Change Category submenu */}
 {(otherCategories.length > 0 || channel.category_id) && (
 <ContextMenuSub>
 <ContextMenuSubTrigger>
 <FolderSimplePlus className="w-4 h-4" />
 Change Category
 </ContextMenuSubTrigger>
 <ContextMenuSubContent className="w-48">
 {channel.category_id && (
 <ContextMenuItem onClick={() => handleMoveToCategory(null)}>
 <Hash className="w-4 h-4 text-muted-foreground" />
 Uncategorized
 </ContextMenuItem>
 )}
 {otherCategories.map((cat) => (
 <ContextMenuItem key={cat.id} onClick={() => handleMoveToCategory(cat.id)}>
 <FolderSimplePlus className="w-4 h-4 text-muted-foreground" />
 {cat.name}
 </ContextMenuItem>
 ))}
 </ContextMenuSubContent>
 </ContextMenuSub>
 )}

 {/* Administration submenu */}
 <ContextMenuSub>
 <ContextMenuSubTrigger>
 <Link className="w-4 h-4" />
 Administration
 </ContextMenuSubTrigger>
 <ContextMenuSubContent className="w-52">
 <ContextMenuItem onClick={onCopyLink}>
 <Link className="w-4 h-4" />
 Copy Channel Link
 </ContextMenuItem>
 <ContextMenuItem onClick={handleCopyChannelId}>
 <Copy className="w-4 h-4" />
 Copy Channel ID
 </ContextMenuItem>
 </ContextMenuSubContent>
 </ContextMenuSub>

 <ContextMenuSeparator />

 <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
 <Trash className="w-4 h-4" />
 Delete Channel
 </ContextMenuItem>
 </>
 )}

 {/* ========== MEMBER SECTION ========== */}
 {!isAdmin && (
 <>
 {/* Top-level quick actions */}
 {onMarkAsRead && (
 <ContextMenuItem onClick={onMarkAsRead}>
 <Check className="w-4 h-4" />
 Mark as Read
 </ContextMenuItem>
 )}
 <ContextMenuItem onClick={handleToggleMute}>
 {channelMuted ? <SpeakerHigh className="w-4 h-4" /> : <BellSlash className="w-4 h-4" />}
 {channelMuted ? "Unmute Channel" : "Mute Channel"}
 </ContextMenuItem>
 <ContextMenuItem onClick={handleTogglePin}>
 {channelPinned ? <PushPinSlash className="w-4 h-4" /> : <PushPin className="w-4 h-4" />}
 {channelPinned ? "Unpin Channel" : "PushPin Channel"}
 </ContextMenuItem>
 <ContextMenuItem onClick={handleToggleHide}>
 {channelHidden ? <Eye className="w-4 h-4" /> : <EyeSlash className="w-4 h-4" />}
 {channelHidden ? "Unhide Channel" : "Hide Channel"}
 </ContextMenuItem>

 <ContextMenuSeparator />

 {/* Notifications submenu */}
 <ContextMenuSub>
 <ContextMenuSubTrigger>
 <Bell className="w-4 h-4" />
 Notifications
 </ContextMenuSubTrigger>
 <ContextMenuSubContent className="w-48">
 <ContextMenuLabel className="font-normal text-xs text-muted-foreground">Notification Level</ContextMenuLabel>
 <ContextMenuItem onClick={() => handleSetNotifLevel("all")}>
 <BellRinging className="w-4 h-4" />
 All Messages
 {notifLevel === "all" && <Check className="w-3 h-3 ml-auto" />}
 </ContextMenuItem>
 <ContextMenuItem onClick={() => handleSetNotifLevel("mentions")}>
 <Bell className="w-4 h-4" />
 @Mentions Only
 {notifLevel === "mentions" && <Check className="w-3 h-3 ml-auto" />}
 </ContextMenuItem>
 <ContextMenuItem onClick={() => handleSetNotifLevel("nothing")}>
 <BellSlash className="w-4 h-4" />
 Nothing
 {notifLevel === "nothing" && <Check className="w-3 h-3 ml-auto" />}
 </ContextMenuItem>
 <ContextMenuSeparator />
 <ContextMenuLabel className="font-normal text-xs text-muted-foreground">Mute for Duration</ContextMenuLabel>
 <ContextMenuItem onClick={() => handleMuteFor(15)}>
 <Clock className="w-4 h-4" />
 15 Minutes
 </ContextMenuItem>
 <ContextMenuItem onClick={() => handleMuteFor(60)}>
 <Clock className="w-4 h-4" />
 1 Hour
 </ContextMenuItem>
 <ContextMenuItem onClick={() => handleMuteFor(480)}>
 <Clock className="w-4 h-4" />
 8 Hours
 </ContextMenuItem>
 <ContextMenuItem onClick={() => handleMuteFor(1440)}>
 <Clock className="w-4 h-4" />
 24 Hours
 </ContextMenuItem>
 <ContextMenuSeparator />
 <ContextMenuItem onClick={() => handleMuteFor(null)}>
 <SpeakerSlash className="w-4 h-4" />
 Until I turn it back on
 </ContextMenuItem>
 </ContextMenuSubContent>
 </ContextMenuSub>

 {/* Sharing submenu */}
 <ContextMenuSub>
 <ContextMenuSubTrigger>
 <Link className="w-4 h-4" />
 Sharing
 </ContextMenuSubTrigger>
 <ContextMenuSubContent className="w-48">
 <ContextMenuItem onClick={onCopyLink}>
 <Link className="w-4 h-4" />
 Copy Channel Link
 </ContextMenuItem>
 <ContextMenuItem onClick={handleCopyChannelId}>
 <Copy className="w-4 h-4" />
 Copy Channel ID
 </ContextMenuItem>
 </ContextMenuSubContent>
 </ContextMenuSub>
 </>
 )}
 </ContextMenuContent>
 );
};
