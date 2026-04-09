import { useState, type MouseEvent } from "react";
import { MoreHorizontal, Flag, Ban, Phone, ChevronLeft } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
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
import { openUserProfileModal, SIDE_ALIGNED_USER_PROFILE_POPOVER } from "@/lib/userProfilePopover";

interface DMHeaderProps {
  otherUser: User | null | undefined;
}




export const DMHeader = ({ otherUser }: DMHeaderProps) => {
  const { openModal, setMobileSidebarOpen } = useUIStore();
  const { blockUser } = useFriendStore();
  const { user } = useAuthStore();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const otherPresence = getEffectivePresence(
    (otherUser?.status as UserStatus) || "offline",
    otherUser?.last_seen,
    otherUser?.id,
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
      openUserProfileModal(openModal, otherUser.id, event.currentTarget, SIDE_ALIGNED_USER_PROFILE_POPOVER);
    }
  };

  if (!otherUser) return null;

  return (
    <div className="w-full bg-card rounded-[10px] border border-border/50 sticky top-0 z-40" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left side - Back button (mobile) + User info */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={handleUserClick}
            className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity"
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
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="relative w-8 h-8 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>More Options</TooltipContent>
            </Tooltip>

            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem
                onClick={handleCallUser}
                className="cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                Call User
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={handleReportUser}
                className="cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                Report User
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={handleBlockUser}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <Ban className="w-4 h-4" />
                Block User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
};
