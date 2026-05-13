import type { ReactNode } from "react";
import { Hash, Volume2, MessageSquare, Pin, Search, Lock, Megaphone, Film, Users, ClipboardList, Timer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { SupportUsButton } from "@/components/support/SupportUsButton";
import type { Channel } from "@/types";

interface ChannelHeaderProps {
  channel: Channel;
  extraActions?: ReactNode;
  showMessageActions?: boolean;
}

export const ChannelHeader = ({
  channel,
  extraActions,
  showMessageActions = true,
}: ChannelHeaderProps) => {
  const openModal = useUIStore((s) => s.openModal);
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
  const setMemberSidebarOpen = useUIStore((s) => s.setMemberSidebarOpen);
  const currentServer = useServerStore((s) => s.currentServer);

  const ChannelIcon =
    channel.type === "voice"
      ? Volume2
      : channel.type === "forum"
        ? MessageSquare
        : channel.type === "announcement"
          ? Megaphone
          : channel.type === "media"
            ? Film
            : channel.type === "tasks"
              ? ClipboardList
              : Hash;

  return (
    <div className="hidden w-full bg-layout-chat border-b border-border/70 md:block">
      <div className="flex h-12 items-center justify-between px-5">
      {/* Left side - Channel info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center">
          <ChannelIcon className="w-5 h-5 text-muted-foreground" />
        </div>
        <span className="font-semibold text-foreground shrink-0">{channel.name}</span>

        {channel.is_private && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs rounded-lg">
                <Lock className="w-3 h-3" />
                Private
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Only invited members can see this channel</TooltipContent>
          </Tooltip>
        )}

        {channel.is_read_only && (
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="secondary" className="flex items-center gap-1 text-xs rounded-lg">
                <Lock className="w-3 h-3" />
                Read-only
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Only admins can send messages</TooltipContent>
          </Tooltip>
        )}

        {channel.topic && (
          <>
            <Separator orientation="vertical" className="h-5 mx-2" />
            <Popover>
              <PopoverTrigger asChild>
                <button className="text-muted-foreground text-sm truncate hidden lg:inline cursor-pointer hover:text-foreground transition-colors text-left min-w-0">
                  {channel.topic}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 max-h-60 overflow-y-auto text-sm text-foreground whitespace-pre-wrap" align="start">
                {channel.topic}
              </PopoverContent>
            </Popover>
          </>
        )}

        {channel.auto_delete_seconds && (
          <Tooltip>
            <TooltipTrigger>
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-rose-400/70 ml-1">
                <Timer className="w-3 h-3" />
                Auto-delete: {channel.auto_delete_seconds === 3600 ? '1h' : channel.auto_delete_seconds === 86400 ? '24h' : channel.auto_delete_seconds === 604800 ? '7d' : '30d'}
              </span>
            </TooltipTrigger>
            <TooltipContent>Messages in this channel are automatically deleted</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {showMessageActions && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative w-8 h-8 rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  onClick={() => openModal("pinned-messages", { channelId: channel.id })}
                >
                  <Pin className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Pinned Messages</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative w-8 h-8 rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  onClick={() => openModal("search", { channelId: channel.id })}
                >
                  <Search className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search Messages</TooltipContent>
            </Tooltip>
          </>
        )}

        {extraActions}

        {currentServer && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative w-8 h-8 rounded-lg text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                onClick={() => setMemberSidebarOpen(!isMemberSidebarOpen)}
                aria-label={isMemberSidebarOpen ? "Hide member sidebar" : "Show member sidebar"}
              >
                <Users className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isMemberSidebarOpen ? "Hide Member Sidebar" : "Show Member Sidebar"}</TooltipContent>
          </Tooltip>
        )}

        <NotificationBell />
        <SupportUsButton tooltipsEnabled />
      </div>
      </div>
    </div>
  );
};
