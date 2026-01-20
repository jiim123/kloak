import { useState } from "react";
import { motion } from "framer-motion";
import { Headphones, Mic, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusSelector } from "@/components/StatusSelector";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

interface LoggedInUserPanelProps {
  containerClassName?: string;
  statusBorderClassName?: string;
}

export const LoggedInUserPanel = ({
  containerClassName,
  statusBorderClassName = "border-layout-sidebar",
}: LoggedInUserPanelProps) => {
  const { user } = useAuthStore();
  const { cycleTheme } = useUIStore();
  const [isUserAvatarHovered, setIsUserAvatarHovered] = useState(false);

  return (
    <motion.div
      className={cn(
        "h-14 px-3 flex items-center gap-3 border-t border-border/50",
        containerClassName ?? "bg-layout-sidebar",
      )}
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
    >
      {/* Avatar with status */}
      <StatusSelector side="top" align="start">
        <button className="relative flex-shrink-0 group">
          <motion.div
            className="w-8 h-8 cursor-pointer overflow-hidden rounded-full"
            onHoverStart={() => setIsUserAvatarHovered(true)}
            onHoverEnd={() => setIsUserAvatarHovered(false)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <AvatarWithDecoration user={user} className="w-8 h-8" active={isUserAvatarHovered} />
          </motion.div>
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
        </button>
      </StatusSelector>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{user?.display_name || user?.username}</p>
        <p className="text-xs text-muted-foreground truncate">
          {user?.custom_status ||
            (user?.status === "online"
              ? "Online"
              : user?.status === "idle"
                ? "Idle"
                : user?.status === "dnd"
                  ? "Do Not Disturb"
                  : "Offline")}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
              <Mic className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Mute</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground">
              <Headphones className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Deafen</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 text-muted-foreground hover:text-foreground"
              onClick={cycleTheme}
            >
              <Palette className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Theme</TooltipContent>
        </Tooltip>
      </div>
    </motion.div>
  );
};

