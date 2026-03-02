import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StackedAvatars } from "@/components/ui/stacked-avatars";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUIStore } from "@/stores/uiStore";
import { useDMStore } from "@/stores/dmStore";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DMConversation, User } from "@/types";
import { GroupSettingsModal } from "./GroupSettingsModal";

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
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setMobileSidebarOpen } = useUIStore();
  const { leaveGroup, setCurrentConversation, fetchConversations } = useDMStore();
  
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

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

  const handleLeaveGroup = async () => {
    if (!user?.id) return;
    
    setIsLeaving(true);
    const success = await leaveGroup(conversation.id, user.id);
    setIsLeaving(false);
    
    if (success) {
      toast.success("You have left the group");
      setCurrentConversation(null);
      fetchConversations(user.id);
      navigate("/app");
    } else {
      toast.error("Failed to leave group");
    }
    setShowLeaveDialog(false);
  };

  return (
    <>
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
            <span className="font-medium text-foreground truncate">
              {getGroupDisplayName()}
            </span>
          </div>
        </div>

        {/* Right side - Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0 rounded-xl border border-border/50 bg-background/70 backdrop-blur-xl p-1">
          {/* Settings Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                variants={buttonVariants}
                initial={false}
                animate="animate"
                custom={hoveredButton === "settings"}
                transition={transition}
                onMouseEnter={() => setHoveredButton("settings")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => setShowSettingsModal(true)}
                className={cn(
                  "relative flex items-center rounded-xl py-2 text-sm font-medium transition-colors duration-300",
                  hoveredButton === "settings"
                    ? "bg-muted/70 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Settings className="w-4 h-4 flex-shrink-0" />
                <AnimatePresence initial={false}>
                  {hoveredButton === "settings" && (
                    <motion.span
                      variants={spanVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={transition}
                      className="overflow-hidden whitespace-nowrap text-sm"
                    >
                      Settings
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent>Group Settings</TooltipContent>
          </Tooltip>

          {/* Leave Group Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                variants={buttonVariants}
                initial={false}
                animate="animate"
                custom={hoveredButton === "leave"}
                transition={transition}
                onMouseEnter={() => setHoveredButton("leave")}
                onMouseLeave={() => setHoveredButton(null)}
                onClick={() => setShowLeaveDialog(true)}
                className={cn(
                  "relative flex items-center rounded-xl py-2 text-sm font-medium transition-colors duration-300",
                  hoveredButton === "leave"
                    ? "bg-destructive/20 text-destructive"
                    : "text-muted-foreground hover:text-destructive"
                )}
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <AnimatePresence initial={false}>
                  {hoveredButton === "leave" && (
                    <motion.span
                      variants={spanVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                      transition={transition}
                      className="overflow-hidden whitespace-nowrap text-sm"
                    >
                      Leave
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent>Leave Group</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Group Settings Modal */}
      <GroupSettingsModal
        open={showSettingsModal}
        onOpenChange={setShowSettingsModal}
        conversation={conversation}
        participants={participants}
      />

      {/* Leave Group Confirmation */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Group</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this group? A message will be sent notifying other members that you left.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveGroup}
              disabled={isLeaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLeaving ? "Leaving..." : "Leave Group"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

