import { useState } from "react";
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
  Check,
  Volume2,
  VolumeX,
  Clock,
  Eye,
  EyeOff,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useChannelSettingsStore } from "@/stores/channelSettingsStore";
import type { Channel, ChannelCategory } from "@/types";

interface ChannelContextDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: Channel;
  isAdmin: boolean;
  categories?: ChannelCategory[];
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onMarkAsRead?: () => void;
}

const DrawerItem = ({
  icon: Icon,
  label,
  onClick,
  destructive,
  suffix,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  suffix?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-left transition-colors",
      destructive
        ? "text-destructive hover:bg-destructive/10 active:bg-destructive/10"
        : "hover:bg-secondary/40 active:bg-secondary/60",
    )}
  >
    <Icon className={cn("w-5 h-5 flex-shrink-0", destructive ? "" : "text-muted-foreground")} />
    <span className="flex-1 font-medium">{label}</span>
    {suffix}
  </button>
);

const DrawerSeparator = () => <div className="my-2 h-px bg-border" />;

/** Collapsible submenu group */
const DrawerSubmenu = ({
  icon: Icon,
  label,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-secondary/40 active:bg-secondary/60 text-left transition-colors"
      >
        <Icon className="w-5 h-5 flex-shrink-0 text-muted-foreground" />
        <span className="flex-1 font-medium">{label}</span>
        <ChevronRight
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform duration-150",
            isOpen && "rotate-90",
          )}
        />
      </button>
      {isOpen && (
        <div className="ml-4 border-l border-border/30 pl-2 space-y-0.5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
};

export const ChannelContextDrawer = ({
  open,
  onOpenChange,
  channel,
  isAdmin,
  categories = [],
  onEdit,
  onDelete,
  onCopyLink,
  onMarkAsRead,
}: ChannelContextDrawerProps) => {
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
    () => categories.filter((c) => c.id !== channel.category_id),
    [categories, channel.category_id],
  );

  const close = () => onOpenChange(false);

  const act = (fn: () => void | Promise<void> | unknown) => {
    close();
    fn();
  };

  const handleDuplicate = async () => {
    close();
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
    close();
    try {
      await moveChannelToCategory(channel.id, categoryId);
      toast.success("Channel moved!");
    } catch {
      toast.error("Failed to move channel");
    }
  };

  const handleToggleMute = async () => {
    close();
    await toggleMute(channel.id);
    toast.success(channelMuted ? "Channel unmuted" : "Channel muted");
  };

  const handleToggleHide = async () => {
    close();
    await toggleHide(channel.id);
    toast.success(channelHidden ? "Channel unhidden" : "Channel hidden from sidebar");
  };

  const handleTogglePin = async () => {
    close();
    await togglePin(channel.id);
    toast.success(channelPinned ? "Channel unpinned" : "Channel pinned to top");
  };

  const handleCopyChannelId = () => {
    close();
    navigator.clipboard.writeText(channel.id).then(
      () => toast.success("Channel ID copied!"),
      () => toast.error("Failed to copy"),
    );
  };

  const handleSetNotifLevel = async (level: "all" | "mentions" | "nothing") => {
    close();
    await setNotificationLevel(channel.id, level);
    const labels = { all: "All Messages", mentions: "@Mentions Only", nothing: "Nothing" };
    toast.success(`Notifications set to: ${labels[level]}`);
  };

  const handleMuteFor = async (minutes: number | null) => {
    close();
    await muteFor(channel.id, minutes);
    if (minutes === null) {
      toast.success("Channel muted until you turn it back on");
    } else if (minutes < 60) {
      toast.success(`Channel muted for ${minutes} minutes`);
    } else {
      toast.success(`Channel muted for ${minutes / 60} hours`);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-base font-medium">#{channel.name}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-2 pb-6 space-y-0.5">
          {isAdmin ? (
            <>
              {/* Quick actions */}
              <DrawerItem
                icon={Settings}
                label="Channel Settings"
                onClick={() => act(() => openModal("edit-channel", { channelId: channel.id }))}
              />
              {onMarkAsRead && (
                <DrawerItem icon={Check} label="Mark as Read" onClick={() => act(onMarkAsRead)} />
              )}
              <DrawerItem
                icon={channelMuted ? Volume2 : BellOff}
                label={channelMuted ? "Unmute Channel" : "Mute Channel"}
                onClick={handleToggleMute}
              />

              <DrawerSeparator />

              <DrawerItem icon={CopyPlus} label="Duplicate Channel" onClick={handleDuplicate} />
              <DrawerItem
                icon={Archive}
                label="Archive Channel"
                onClick={() => act(() => toast.info("Archive Channel — coming soon!"))}
              />

              {/* Move to Category submenu */}
              {(otherCategories.length > 0 || channel.category_id) && (
                <>
                  <DrawerSeparator />
                  <DrawerSubmenu icon={FolderInput} label="Move to Category">
                    {channel.category_id && (
                      <DrawerItem
                        icon={Hash}
                        label="Uncategorized"
                        onClick={() => handleMoveToCategory(null)}
                      />
                    )}
                    {otherCategories.map((cat) => (
                      <DrawerItem
                        key={cat.id}
                        icon={FolderInput}
                        label={cat.name}
                        onClick={() => handleMoveToCategory(cat.id)}
                      />
                    ))}
                  </DrawerSubmenu>
                </>
              )}

              <DrawerSeparator />

              {/* Sharing submenu */}
              <DrawerSubmenu icon={Link} label="Sharing">
                <DrawerItem icon={Link} label="Copy Channel Link" onClick={() => act(onCopyLink)} />
                <DrawerItem icon={Copy} label="Copy Channel ID" onClick={handleCopyChannelId} />
              </DrawerSubmenu>

              <DrawerSeparator />

              <DrawerItem icon={Trash2} label="Delete Channel" onClick={() => act(onDelete)} destructive />
            </>
          ) : (
            <>
              {/* Quick actions */}
              {onMarkAsRead && (
                <DrawerItem icon={Check} label="Mark as Read" onClick={() => act(onMarkAsRead)} />
              )}
              <DrawerItem
                icon={channelMuted ? Volume2 : BellOff}
                label={channelMuted ? "Unmute Channel" : "Mute Channel"}
                onClick={handleToggleMute}
              />
              <DrawerItem
                icon={channelPinned ? PinOff : Pin}
                label={channelPinned ? "Unpin Channel" : "Pin Channel"}
                onClick={handleTogglePin}
              />
              <DrawerItem
                icon={channelHidden ? Eye : EyeOff}
                label={channelHidden ? "Unhide Channel" : "Hide Channel"}
                onClick={handleToggleHide}
              />

              <DrawerSeparator />

              {/* Notifications submenu */}
              <DrawerSubmenu icon={Bell} label="Notifications">
                <DrawerItem
                  icon={BellRing}
                  label="All Messages"
                  onClick={() => handleSetNotifLevel("all")}
                  suffix={notifLevel === "all" ? <Check className="w-3 h-3 text-muted-foreground" /> : undefined}
                />
                <DrawerItem
                  icon={Bell}
                  label="@Mentions Only"
                  onClick={() => handleSetNotifLevel("mentions")}
                  suffix={notifLevel === "mentions" ? <Check className="w-3 h-3 text-muted-foreground" /> : undefined}
                />
                <DrawerItem
                  icon={BellOff}
                  label="Nothing"
                  onClick={() => handleSetNotifLevel("nothing")}
                  suffix={notifLevel === "nothing" ? <Check className="w-3 h-3 text-muted-foreground" /> : undefined}
                />
                <DrawerSeparator />
                <DrawerItem icon={Clock} label="15 Minutes" onClick={() => handleMuteFor(15)} />
                <DrawerItem icon={Clock} label="1 Hour" onClick={() => handleMuteFor(60)} />
                <DrawerItem icon={Clock} label="8 Hours" onClick={() => handleMuteFor(480)} />
                <DrawerItem icon={Clock} label="24 Hours" onClick={() => handleMuteFor(1440)} />
                <DrawerItem icon={VolumeX} label="Until I turn it back on" onClick={() => handleMuteFor(null)} />
              </DrawerSubmenu>

              <DrawerSeparator />

              {/* Sharing submenu */}
              <DrawerSubmenu icon={Link} label="Sharing">
                <DrawerItem icon={Link} label="Copy Channel Link" onClick={() => act(onCopyLink)} />
                <DrawerItem icon={Copy} label="Copy Channel ID" onClick={handleCopyChannelId} />
              </DrawerSubmenu>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
