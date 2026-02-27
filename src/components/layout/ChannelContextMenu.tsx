import { useMemo } from "react";
import {
  Edit2,
  Trash2,
  Copy,
  Settings,
  CopyPlus,
  Archive,
  Pin,
  PinOff,
  FolderInput,
  BellOff,
  Bell,
  BellRing,
  Link,
  Hash,
  UserPlus,
  ClipboardList,
  Eye,
  EyeOff,
  BookOpen,
  Clock,
  Check,
  Volume2,
  VolumeX,
} from "lucide-react";
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
          <ContextMenuLabel className="font-normal text-xs text-muted-foreground">Channel Management</ContextMenuLabel>
          <ContextMenuItem onClick={() => openModal("edit-channel", { channelId: channel.id })}>
            <Settings className="w-4 h-4 mr-2" />
            Channel Settings
          </ContextMenuItem>
          <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Channel
          </ContextMenuItem>
          <ContextMenuItem onClick={handleDuplicateChannel}>
            <CopyPlus className="w-4 h-4 mr-2" />
            Duplicate Channel
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleNotImplemented("Archive Channel")}>
            <Archive className="w-4 h-4 mr-2" />
            Archive Channel
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuLabel className="font-normal text-xs text-muted-foreground">Organization</ContextMenuLabel>
          <ContextMenuItem onClick={handleTogglePin}>
            {channelPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
            {channelPinned ? "Unpin Channel" : "Pin Channel to Top"}
          </ContextMenuItem>

          {(otherCategories.length > 0 || channel.category_id) && (
            <ContextMenuSub>
              <ContextMenuSubTrigger>
                <FolderInput className="w-4 h-4 mr-2" />
                Move to Category
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-48">
                {channel.category_id && (
                  <ContextMenuItem onClick={() => handleMoveToCategory(null)}>
                    <Hash className="w-4 h-4 mr-2 text-muted-foreground" />
                    Uncategorized
                  </ContextMenuItem>
                )}
                {otherCategories.map((cat) => (
                  <ContextMenuItem key={cat.id} onClick={() => handleMoveToCategory(cat.id)}>
                    <FolderInput className="w-4 h-4 mr-2 text-muted-foreground" />
                    {cat.name}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          <ContextMenuSeparator />
          <ContextMenuLabel className="font-normal text-xs text-muted-foreground">
            Notifications & Visibility
          </ContextMenuLabel>
          {onMarkAsRead && (
            <ContextMenuItem onClick={onMarkAsRead}>
              <Check className="w-4 h-4 mr-2" />
              Mark as Read
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => handleNotImplemented("Mark as Unread")}>
            <BookOpen className="w-4 h-4 mr-2" />
            Mark as Unread
          </ContextMenuItem>
          <ContextMenuItem onClick={handleToggleMute}>
            {channelMuted ? <Volume2 className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
            {channelMuted ? "Unmute Channel" : "Mute Channel"}
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuLabel className="font-normal text-xs text-muted-foreground">
            Sharing & Administration
          </ContextMenuLabel>
          <ContextMenuItem onClick={onCopyLink}>
            <Link className="w-4 h-4 mr-2" />
            Copy Channel Link
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopyChannelId}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Channel ID
          </ContextMenuItem>
          <ContextMenuItem onClick={() => openModal("invite", { channelId: channel.id })}>
            <UserPlus className="w-4 h-4 mr-2" />
            Create Invite to Channel
          </ContextMenuItem>
          <ContextMenuItem onClick={() => handleNotImplemented("View Channel Audit Log")}>
            <ClipboardList className="w-4 h-4 mr-2" />
            View Channel Audit Log
          </ContextMenuItem>
        </>
      )}

      {/* ========== MEMBER SECTION ========== */}
      {!isAdmin && (
        <>
          <ContextMenuLabel className="font-normal text-xs text-muted-foreground">
            Personal Organization
          </ContextMenuLabel>
          <ContextMenuItem onClick={handleTogglePin}>
            {channelPinned ? <PinOff className="w-4 h-4 mr-2" /> : <Pin className="w-4 h-4 mr-2" />}
            {channelPinned ? "Unpin Channel" : "Pin Channel"}
          </ContextMenuItem>
          <ContextMenuItem onClick={handleToggleHide}>
            {channelHidden ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
            {channelHidden ? "Unhide Channel" : "Hide Channel"}
          </ContextMenuItem>
          {onMarkAsRead && (
            <ContextMenuItem onClick={onMarkAsRead}>
              <Check className="w-4 h-4 mr-2" />
              Mark as Read
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={() => handleNotImplemented("Mark as Unread")}>
            <BookOpen className="w-4 h-4 mr-2" />
            Mark as Unread
          </ContextMenuItem>

          <ContextMenuSeparator />
          <ContextMenuLabel className="  font-normal text-xs text-muted-foreground">Notifications</ContextMenuLabel>
          <ContextMenuItem onClick={handleToggleMute}>
            {channelMuted ? <Volume2 className="w-4 h-4 mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
            {channelMuted ? "Unmute Channel" : "Mute Channel"}
          </ContextMenuItem>

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Bell className="w-4 h-4 mr-2" />
              Notification Settings
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem onClick={() => handleSetNotifLevel("all")}>
                <BellRing className="w-4 h-4 mr-2" />
                All Messages
                {notifLevel === "all" && <Check className="w-3 h-3 ml-auto" />}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleSetNotifLevel("mentions")}>
                <Bell className="w-4 h-4 mr-2" />
                @Mentions Only
                {notifLevel === "mentions" && <Check className="w-3 h-3 ml-auto" />}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => handleSetNotifLevel("nothing")}>
                <BellOff className="w-4 h-4 mr-2" />
                Nothing
                {notifLevel === "nothing" && <Check className="w-3 h-3 ml-auto" />}
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Clock className="w-4 h-4 mr-2" />
              Mute for Duration
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem onClick={() => handleMuteFor(15)}>15 Minutes</ContextMenuItem>
              <ContextMenuItem onClick={() => handleMuteFor(60)}>1 Hour</ContextMenuItem>
              <ContextMenuItem onClick={() => handleMuteFor(480)}>8 Hours</ContextMenuItem>
              <ContextMenuItem onClick={() => handleMuteFor(1440)}>24 Hours</ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => handleMuteFor(null)}>Until I turn it back on</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>

          <ContextMenuSeparator />
          <ContextMenuLabel className="font-normal text-xs text-muted-foreground">Sharing</ContextMenuLabel>
          <ContextMenuItem onClick={onCopyLink}>
            <Link className="w-4 h-4 mr-2" />
            Copy Channel Link
          </ContextMenuItem>
          <ContextMenuItem onClick={handleCopyChannelId}>
            <Copy className="w-4 h-4 mr-2" />
            Copy Channel ID
          </ContextMenuItem>
        </>
      )}
    </ContextMenuContent>
  );
};
