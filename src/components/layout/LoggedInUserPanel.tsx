import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Headphones, Heart, MoreHorizontal, Mic, MicOff, Play, Settings, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusSelector } from "@/components/StatusSelector";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useAuthStore } from "@/stores/authStore";
import { useVoiceStore } from "@/stores/voiceStore";
import { useUIStore } from "@/stores/uiStore";

const InvisibleIndicator = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "w-3.5 h-3.5 rounded-full border-2 bg-transparent",
      className,
    )}
    style={{ borderColor: "hsl(var(--muted-foreground))" }}
    title="Invisible"
  />
);

interface LoggedInUserPanelProps {
  containerClassName?: string;
  statusBorderClassName?: string;
}

const quickLinks = [
  {
    label: "Subscribe on YouTube",
    description: "See the latest videos on our Youtube channel",
    href: "https://www.youtube.com/@kloakapp",
    icon: Play,
  },
  {
    label: "Support Us",
    description: "Help fund development through Buy Me a Coffee",
    href: "https://buymeacoffee.com/kloak",
    icon: Heart,
  },
] as const;

export const LoggedInUserPanel = ({
  containerClassName,
  statusBorderClassName = "border-layout-sidebar",
}: LoggedInUserPanelProps) => {
  const { user, manualStatus } = useAuthStore();
  const connection = useVoiceStore((s) => s.connection);
  const joinedVoiceChannelId = useVoiceStore((s) => s.joinedChannelId);
  const controls = useVoiceStore((s) => s.controls);
  const [isUserAvatarHovered, setIsUserAvatarHovered] = useState(false);
  const openModal = useUIStore((s) => s.openModal);

  const activeChannelId = connection.channelId ?? joinedVoiceChannelId;
  const isVoiceActive = !!activeChannelId && connection.status !== "idle";
  const statusLabel = user?.custom_status?.trim() || "Set a status";
  const openExternalLink = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const toggleMute = () => {
    if (!activeChannelId) return;
    window.dispatchEvent(new CustomEvent("kloak:voice:toggleMute", { detail: { channelId: activeChannelId } }));
  };

  const toggleDeafen = () => {
    if (!activeChannelId) return;
    window.dispatchEvent(new CustomEvent("kloak:voice:toggleDeafen", { detail: { channelId: activeChannelId } }));
  };

  return (
    <motion.div
      className={cn(
        "h-14 shrink-0 px-3 flex items-center gap-3 border-t border-border/30",
        containerClassName ?? "bg-sidebar-secondary/80",
      )}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      {/* Avatar with status */}
      <StatusSelector side="top" align="start">
        <button type="button" className="relative flex-shrink-0 group">
          <motion.div
            className="w-8 h-8 cursor-pointer overflow-hidden rounded-full"
            onHoverStart={() => setIsUserAvatarHovered(true)}
            onHoverEnd={() => setIsUserAvatarHovered(false)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <AvatarWithDecoration user={user} className="w-8 h-8" active={isUserAvatarHovered} />
          </motion.div>
          {manualStatus === "offline" ? (
            <div className={cn("absolute -bottom-0.5 -right-0.5", statusBorderClassName)}>
              <InvisibleIndicator />
            </div>
          ) : (
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 transition-colors",
                statusBorderClassName,
                user?.status === "online" && "bg-kloak-online",
                user?.status === "idle" && "bg-kloak-idle",
                user?.status === "dnd" && "bg-kloak-dnd",
                user?.status === "offline" && "bg-kloak-offline",
              )}
            />
          )}
        </button>
      </StatusSelector>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium leading-tight text-foreground">{user?.display_name || user?.username}</p>
        <button
          type="button"
          onClick={() => openModal("set-status")}
          className="mt-0.5 truncate text-xs text-muted-foreground transition-colors hover:text-foreground"
          title={statusLabel}
        >
          {statusLabel}
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        {isVoiceActive && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className={cn(
                    "w-8 h-8",
                    controls.muted ? "text-destructive hover:text-destructive" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {controls.muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{controls.muted ? "Unmute" : "Mute"}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDeafen}
                  className={cn(
                    "w-8 h-8",
                    controls.deafened ? "text-destructive hover:text-destructive" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {controls.deafened ? <VolumeX className="w-4 h-4" /> : <Headphones className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{controls.deafened ? "Undeafen" : "Deafen"}</TooltipContent>
            </Tooltip>
          </>
        )}

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 text-muted-foreground hover:text-foreground"
                  aria-label="Open quick links"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Quick Links</TooltipContent>
          </Tooltip>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={10}
            className="app-shell-theme-scope w-[19.5rem] rounded-[14px] p-0 shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
          >
            {quickLinks.map((link, index) => {
              const Icon = link.icon;
              return (
                <Fragment key={link.href}>
                  {index > 0 && <DropdownMenuSeparator className="mx-4" />}
                  <DropdownMenuItem
                    onClick={() => openExternalLink(link.href)}
                    className="min-h-[42px] cursor-pointer items-start gap-0 px-4 py-2"
                  >
                    <div className="mr-3 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--menu-hover))] text-[hsl(var(--menu-foreground))]">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold leading-tight text-[hsl(var(--menu-foreground))]">
                        {link.label}
                      </p>
                      <p className="mt-0.5 max-w-[228px] text-[11px] leading-[1.25] text-muted-foreground">
                        {link.description}
                      </p>
                    </div>
                    <ExternalLink className="ml-3 mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                  </DropdownMenuItem>
                </Fragment>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => openModal("user-settings")}
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>User Settings</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
};

