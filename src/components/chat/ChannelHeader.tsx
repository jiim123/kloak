import { useState } from "react";
import { Hash, Volume2, MessageSquare, Pin, Search, Users, Lock, Megaphone, Film } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { cn } from "@/lib/utils";
import type { Channel } from "@/types";

interface ChannelHeaderProps {
  channel: Channel;
}

const buttonVariants = {
  initial: {
    gap: 0,
    paddingLeft: ".5rem",
    paddingRight: ".5rem",
  },
  animate: (isExpanded: boolean) => ({
    gap: isExpanded ? ".5rem" : 0,
    paddingLeft: isExpanded ? ".75rem" : ".5rem",
    paddingRight: isExpanded ? ".75rem" : ".5rem",
  }),
};

const spanVariants = {
  initial: { width: 0, opacity: 0 },
  animate: { width: "auto", opacity: 1 },
  exit: { width: 0, opacity: 0 },
};

const transition = { delay: 0.1, type: "spring" as const, bounce: 0, duration: 0.6 };

interface HeaderButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

const HeaderButton = ({ icon: Icon, label, onClick, isHovered, onMouseEnter, onMouseLeave }: HeaderButtonProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          variants={buttonVariants}
          initial={false}
          animate="animate"
          custom={isHovered}
          transition={transition}
          onClick={onClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className={cn(
            "relative flex items-center rounded-xl py-2 text-sm font-medium transition-colors duration-300",
            isHovered ? "bg-muted/70 text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <AnimatePresence initial={false}>
            {isHovered && (
              <motion.span
                variants={spanVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                className="overflow-hidden whitespace-nowrap text-sm"
              >
                {label}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

export const ChannelHeader = ({ channel }: ChannelHeaderProps) => {
  const { isMemberSidebarOpen, toggleMemberSidebar, openModal } = useUIStore();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const ChannelIcon = channel.type === "voice" ? Volume2 : channel.type === "forum" ? MessageSquare : channel.type === "announcement" ? Megaphone : channel.type === "media" ? Film : Hash;

  const buttons = [
    {
      id: "pinned",
      icon: Pin,
      label: "Pinned",
      onClick: () => openModal("pinned-messages", { channelId: channel.id }),
    },
    {
      id: "search",
      icon: Search,
      label: "Search",
      onClick: () => openModal("search", { channelId: channel.id }),
    },
    {
      id: "members",
      icon: Users,
      label: isMemberSidebarOpen ? "Hide" : "Show",
      onClick: toggleMemberSidebar,
    },
  ];

  return (
    <div className="h-12 px-4 hidden md:flex items-center justify-between border-b border-border/50 flex-shrink-0 bg-background/50 backdrop-blur-sm">
      {/* Left side - Channel info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="w-8 h-8 rounded-lg bg-secondary/50 flex items-center justify-center flex-shrink-0">
          <ChannelIcon className="w-4 h-4 text-muted-foreground" />
        </div>
        <span className="font-semibold text-foreground truncate">{channel.name}</span>

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
            <span className="text-muted-foreground text-sm truncate hidden lg:inline">{channel.topic}</span>
          </>
        )}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 rounded-xl border border-border/50 bg-background/70 backdrop-blur-xl p-1">
        <NotificationBell />

        <div className="mx-1 h-[20px] w-[1px] bg-border/50" aria-hidden="true" />

        {buttons.map((button) => (
          <HeaderButton
            key={button.id}
            icon={button.icon}
            label={button.label}
            onClick={button.onClick}
            isHovered={hoveredButton === button.id}
            onMouseEnter={() => setHoveredButton(button.id)}
            onMouseLeave={() => setHoveredButton(null)}
          />
        ))}
      </div>
    </div>
  );
};
