import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Settings } from "lucide-react";
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
import { toast } from "sonner";
import type { DMConversation, User } from "@/types";
import { GroupSettingsModal } from "./GroupSettingsModal";

interface GroupChatHeaderProps {
  conversation: DMConversation;
  participants: User[];
}

export const GroupChatHeader = ({ conversation, participants }: GroupChatHeaderProps) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { leaveGroup, setCurrentConversation, fetchConversations } = useDMStore();
  
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
      <div className="hidden w-full bg-layout-members md:block">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left side - Group info */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <StackedAvatars users={participants} size="sm" />
            <span className="font-normal text-foreground truncate">
              {getGroupDisplayName()}
            </span>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative w-8 h-8 rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground"
                  onClick={() => setShowSettingsModal(true)}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Group Settings</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative w-8 h-8 rounded-lg text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => setShowLeaveDialog(true)}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Leave Group</TooltipContent>
            </Tooltip>
          </div>
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

