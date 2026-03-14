import { useState, type MouseEvent } from "react";
import { MoreHorizontal, Flag, Ban, Phone, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { useUIStore } from "@/stores/uiStore";
import { useFriendStore } from "@/stores/friendStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { getEffectivePresence } from "@/lib/presence";
import { toast } from "sonner";
import type { User, UserStatus } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { openUserProfileModal } from "@/lib/userProfilePopover";

interface DMHeaderProps {
  otherUser: User | null | undefined;
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

export const DMHeader = ({ otherUser }: DMHeaderProps) => {
  const { openModal, setMobileSidebarOpen } = useUIStore();
  const { blockUser } = useFriendStore();
  const { user } = useAuthStore();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const otherPresence = getEffectivePresence(
    (otherUser?.status as UserStatus) || "offline",
    otherUser?.last_seen
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "idle":
        return "bg-yellow-500";
      case "dnd":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleReportUser = () => {
    toast.info("Report feature coming soon");
    setIsMenuOpen(false);
  };

  const handleBlockUser = async () => {
    if (!user?.id || !otherUser?.id) return;
    try {
      await blockUser(user.id, otherUser.id);
      toast.success(`Blocked ${otherUser.display_name || otherUser.username}`);
    } catch (error) {
      toast.error("Failed to block user");
    }
    setIsMenuOpen(false);
  };

  const handleCallUser = () => {
    toast.info("Voice calls coming soon");
    setIsMenuOpen(false);
  };

  const handleUserClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (otherUser?.id) {
      openUserProfileModal(openModal, otherUser.id, event.currentTarget);
    }
  };

  if (!otherUser) return null;

  return (
    <div className="px-4 py-2 md:py-0 md:h-12 flex items-center justify-between border-b border-border/50 flex-shrink-0 bg-background/50 backdrop-blur-sm sticky top-0 z-40">
      {/* Left side - Sidebar toggle (mobile) + User info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-2 rounded-2xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* User info */}
        <button
          onClick={handleUserClick}
          className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity"
        >
          <div className="relative flex-shrink-0">
            <AvatarWithDecoration
              user={otherUser}
              className="w-8 h-8"
            />
            <div
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background",
                getStatusColor(otherPresence.status)
              )}
            />
          </div>
          <span className="font-medium text-foreground truncate">
            {otherUser.display_name || otherUser.username || "Unknown"}
          </span>
        </button>
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center gap-1 flex-shrink-0 rounded-xl border border-border/50 bg-background/70 backdrop-blur-xl p-1">
        <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <motion.button
                  variants={buttonVariants}
                  initial={false}
                  animate="animate"
                  custom={hoveredButton === "more"}
                  transition={transition}
                  onMouseEnter={() => setHoveredButton("more")}
                  onMouseLeave={() => setHoveredButton(null)}
                  className={cn(
                    "relative flex items-center rounded-xl py-2 text-sm font-medium transition-colors duration-300",
                    hoveredButton === "more" || isMenuOpen
                      ? "bg-muted/70 text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <MoreHorizontal className="w-4 h-4 flex-shrink-0" />
                  <AnimatePresence initial={false}>
                    {hoveredButton === "more" && (
                      <motion.span
                        variants={spanVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={transition}
                        className="overflow-hidden whitespace-nowrap text-sm"
                      >
                        More
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>More Options</TooltipContent>
          </Tooltip>

          <DropdownMenuContent
            align="end"
            className="w-48 bg-popover border border-border shadow-lg z-50"
          >
            <DropdownMenuItem
              onClick={handleCallUser}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Call User</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleReportUser}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Flag className="w-4 h-4" />
              <span>Report User</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={handleBlockUser}
              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <Ban className="w-4 h-4" />
              <span>Block User</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
