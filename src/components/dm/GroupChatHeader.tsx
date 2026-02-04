import { useState } from "react";
import { MoreHorizontal, LogOut, Settings, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StackedAvatars } from "@/components/ui/stacked-avatars";
import { useUIStore } from "@/stores/uiStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DMConversation, User } from "@/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface GroupChatHeaderProps {
  conversation: DMConversation;
  participants: User[];
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

export const GroupChatHeader = ({ conversation, participants }: GroupChatHeaderProps) => {
  const { setMobileSidebarOpen } = useUIStore();
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Get display name for the group
  const getGroupDisplayName = () => {
    if (conversation.name) return conversation.name;
    
    const names = participants
      .slice(0, 3)
      .map((p) => p.display_name || p.username || "Unknown");
    
    if (participants.length > 3) {
      return `${names.join(", ")} +${participants.length - 3}`;
    }
    return names.join(", ");
  };

  const handleLeaveGroup = () => {
    toast.info("Leave group feature coming soon");
    setIsMenuOpen(false);
  };

  const handleGroupSettings = () => {
    toast.info("Group settings coming soon");
    setIsMenuOpen(false);
  };

  return (
    <div className="px-4 py-2 md:py-0 md:h-12 flex items-center justify-between border-b border-border/50 flex-shrink-0 bg-background/50 backdrop-blur-sm sticky top-0 z-40">
      {/* Left side - Sidebar toggle (mobile) + Group info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-2 rounded-2xl bg-secondary text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 flex-shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Group info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <StackedAvatars users={participants} size="sm" />
          <span className="font-semibold text-foreground truncate">
            {getGroupDisplayName()}
          </span>
        </div>
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
              onClick={handleGroupSettings}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Group Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLeaveGroup}
              className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Group</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
