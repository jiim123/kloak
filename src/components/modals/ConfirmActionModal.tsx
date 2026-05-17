import { useState, useEffect } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ServerMember } from "@/types";
import { useRateLimit } from "@/hooks/useRateLimit";
import { rateLimitToast } from "@/lib/rateLimitToast";

type ActionType = "kick" | "ban" | "mute" | "unmute" | "transferOwnership" | "massBan" | "massKick";
const MODAL_CONTENT_CLASS =
  "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl sm:max-w-[448px]";

const getDisplayName = (member: ServerMember) =>
  member.nickname || member.user?.display_name || member.user?.username || "Unknown member";

export const ConfirmActionModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { kickMember, banMember, updateMember, transferOwnership, currentServer } = useServerStore();
  const { user } = useAuthStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const checkModLimit = useRateLimit(10, 30_000);

  const isOpen = activeModal === "confirmAction";
  const action = modalData?.action as ActionType | undefined;
  const member = modalData?.member as ServerMember | undefined;
  const massActionMembers = modalData?.members as ServerMember[] | undefined;
  const title = modalData?.title as string | undefined;
  const message = modalData?.message as string | undefined;
  const isStyledMemberAction = action === "kick" || action === "ban" || action === "massBan" || action === "massKick";

  const handleClose = () => {
    closeModal();
  };

  const handleConfirm = async () => {
    if (!currentServer || !action) return;
    if (!checkModLimit()) { rateLimitToast("Moderation actions too fast"); return; }

    // Mass ban flow
    if ((action === "massBan" || action === "massKick") && massActionMembers && massActionMembers.length > 0) {
      setIsSubmitting(true);
      try {
        let successCount = 0;
        let failCount = 0;
        for (const m of massActionMembers) {
          try {
            if (action === "massKick") {
              await kickMember(currentServer.id, m.user_id);
            } else {
              await banMember(currentServer.id, m.user_id);
            }
            successCount++;
          } catch {
            failCount++;
          }
        }
        const actionLabel = action === "massKick" ? "Kicked" : "Banned";
        if (failCount === 0) {
          toast.success(`${actionLabel} ${successCount} member${successCount > 1 ? "s" : ""} from the server`);
        } else {
          toast.warning(`${actionLabel} ${successCount}, failed ${failCount}`);
        }
        handleClose();
      } catch (error) {
        console.error(`Mass ${action === "massKick" ? "kick" : "ban"} failed:`, error);
        toast.error(`Mass ${action === "massKick" ? "kick" : "ban"} failed`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!member) return;

    setIsSubmitting(true);

    try {
      switch (action) {
        case "kick":
          await kickMember(currentServer.id, member.user_id);
          toast.success(`${member.nickname || member.user?.username} has been kicked from the server`);
          break;

        case "ban":
          await banMember(currentServer.id, member.user_id);
          toast.success(`${member.nickname || member.user?.username} has been banned from the server`);
          break;

        case "mute":
          await updateMember(member.id, { is_muted: true });
          toast.success(`${member.nickname || member.user?.username} has been muted`);
          break;

        case "unmute":
          await updateMember(member.id, { is_muted: false });
          toast.success(`${member.nickname || member.user?.username} has been unmuted`);
          break;

        case "transferOwnership":
          if (user) {
            await transferOwnership(currentServer.id, member.user_id);
            toast.success(`Server ownership has been transferred to ${member.nickname || member.user?.username}`);
          }
          break;
      }

      handleClose();
    } catch (error) {
      console.error("Action failed:", error);
      toast.error(`Failed to ${action} member`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getActionColor = () => {
    switch (action) {
      case "kick":
        return "bg-orange-500 hover:bg-orange-600";
      case "ban":
      case "massBan":
      case "massKick":
        return "bg-destructive hover:bg-destructive/90";
      case "transferOwnership":
        return "bg-yellow-500 hover:bg-yellow-600 text-black";
      default:
        return "";
    }
  };

  const getActionText = () => {
    switch (action) {
      case "kick":
        return "Kick";
      case "ban":
        return "Ban";
      case "massBan":
        return `Ban ${massActionMembers?.length ?? ""} Members`;
      case "massKick":
        return `Kick ${massActionMembers?.length ?? ""} Members`;
      case "mute":
        return "Mute";
      case "unmute":
        return "Unmute";

      case "transferOwnership":
        return "Transfer Ownership";
      default:
        return "Confirm";
    }
  };

  if (isStyledMemberAction && (member || ((action === "massBan" || action === "massKick") && (massActionMembers?.length ?? 0) > 0))) {
    const actionLabel = getActionText();
    const helperText =
      action === "kick" || action === "massKick"
        ? "They will be removed from this server but can rejoin with a new invite."
        : "They will be removed and won't be able to rejoin until you unban them.";
    const pendingLabel =
      action === "kick"
        ? "Kicking..."
        : action === "massKick"
          ? "Kicking members..."
          : action === "massBan"
            ? "Banning members..."
            : "Banning...";

    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={MODAL_CONTENT_CLASS} hideCloseButton>
          <div className="flex max-h-[82vh] flex-col overflow-hidden">
            <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">{title || `${actionLabel} member`}</div>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-4">
              <div className="space-y-2">
                <p className="text-sm leading-6 text-[#f3f4f7]">{message || `Are you sure you want to ${action} this member?`}</p>
                <p className="text-xs leading-5 text-[#b8bec8]">{helperText}</p>
              </div>

              {(action === "massBan" || action === "massKick") && massActionMembers ? (
                <div className="border border-[#4a4f5a] bg-[#2f343d] p-3">
                  <p className="text-sm font-medium leading-none text-[#f3f4f7]">Selected members</p>
                  <div className="mt-2 max-h-36 space-y-1 overflow-y-auto">
                    {massActionMembers.map((m) => (
                      <p key={m.user_id} className="text-sm text-[#d7dbe3]">
                        {getDisplayName(m)}
                      </p>
                    ))}
                  </div>
                </div>
              ) : member ? (
                <div className="border border-[#4a4f5a] bg-[#2f343d] p-3">
                  <p className="text-sm font-medium leading-none text-[#f3f4f7]">Selected member</p>
                  <p className="mt-2 text-sm text-[#d7dbe3]">{getDisplayName(member)}</p>
                  <p className="mt-1 text-xs text-[#9ea4af]">@{member.user?.username || "unknown"}</p>
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
                className="h-9 rounded-[3px] px-4 text-[#b9bec8] hover:bg-transparent hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="h-9 rounded-[3px] bg-[#d32f2f] px-5 font-medium text-white hover:bg-[#b71c1c]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {pendingLabel}
                  </>
                ) : (
                  actionLabel
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{message}</p>
            {action === "kick" && (
              <p className="text-muted-foreground text-sm">
                They will be able to rejoin the server with an invite link.
              </p>
            )}
            {action === "ban" && (
              <p className="text-muted-foreground text-sm">
                They will not be able to rejoin the server until unbanned.
              </p>
            )}
            {(action === "massBan" || action === "massKick") && massActionMembers && (
              <div className="space-y-2">
                <p className="text-muted-foreground text-sm">
                  {action === "massKick"
                    ? "They will be able to rejoin the server with a new invite."
                    : "They will not be able to rejoin the server until unbanned."}
                </p>
                <div className="max-h-32 overflow-y-auto rounded-lg bg-secondary/30 p-2 space-y-1">
                  {massActionMembers.map((m) => (
                    <p key={m.user_id} className="text-sm text-foreground">
                      {m.nickname || m.user?.display_name || m.user?.username}
                    </p>
                  ))}
                </div>
              </div>
            )}
            {action === "transferOwnership" && (
              <p className="text-destructive text-sm font-medium">
                Warning: This action cannot be undone! You will become an admin.
              </p>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={isSubmitting} className={getActionColor()}>
            {isSubmitting ? "Processing..." : getActionText()}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// Change Nickname Modal
export const ChangeNicknameModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { updateMember } = useServerStore();
  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOpen = activeModal === "changeNickname";
  const member = modalData?.member as ServerMember | undefined;

  // Initialize nickname when modal opens - must be in useEffect, not during render
  useEffect(() => {
    if (isOpen) {
      setNickname(member?.nickname || "");
    } else if (!isOpen) {
      setNickname("");
    }
  }, [isOpen, member?.nickname]);

  const handleClose = () => {
    setNickname("");
    closeModal();
  };

  const handleSubmit = async () => {
    if (!member) return;

    setIsSubmitting(true);

    try {
      await updateMember(member.id, { nickname: nickname.trim() || null });
      toast.success("Nickname updated");
      handleClose();
    } catch (error) {
      console.error("Failed to update nickname:", error);
      toast.error("Failed to update nickname");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!member) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className={MODAL_CONTENT_CLASS} hideCloseButton>
        <div className="flex max-h-[82vh] flex-col overflow-hidden">
          <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
            <div className="text-base font-medium leading-none tracking-tight">Change nickname</div>
          </div>

          <div className="space-y-5 overflow-y-auto px-6 py-4">
            <div>
              <Label htmlFor="nickname" className="text-xs font-medium uppercase tracking-wide text-[#c4c8d0]">
                Nickname
              </Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.slice(0, 32))}
                placeholder={member.user?.username || "Enter nickname"}
                maxLength={32}
                className="mt-2 h-9 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                autoFocus
              />
              <div className="mt-2 flex items-center justify-between gap-3 text-xs leading-5">
                <p className="text-[#b8bec8]">Leave empty to use their display name.</p>
                <span className="font-mono text-[#9ea4af]">{nickname.length}/32</span>
              </div>
            </div>

            <div className="border border-[#4a4f5a] bg-[#2f343d] p-3">
              <p className="text-sm font-medium leading-none text-[#f3f4f7]">Member</p>
              <p className="mt-2 text-sm text-[#d7dbe3]">{getDisplayName(member)}</p>
              <p className="mt-1 text-xs text-[#9ea4af]">@{member.user?.username || "unknown"}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isSubmitting}
              className="h-9 rounded-[3px] px-4 text-[#b9bec8] hover:bg-transparent hover:text-white"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="h-9 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
