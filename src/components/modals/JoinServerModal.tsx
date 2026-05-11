import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Users, Frown } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { inviteCodeRateLimiter } from "@/lib/security";
import { toast } from "sonner";

const joinServerSchema = z.object({
  inviteCode: z
    .string()
    .trim()
    .min(1, "Invite code is required")
    .max(8, "Invite code must be 8 characters")
    .regex(/^[A-Z0-9]+$/i, "Invalid invite code format"),
});

type JoinServerForm = z.infer<typeof joinServerSchema>;

export const JoinServerModal = () => {
  const navigate = useNavigate();
  const { activeModal, closeModal, openModal } = useUIStore();
  const { joinServer, setCurrentServer, fetchChannels } = useServerStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBannedModal, setShowBannedModal] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<JoinServerForm>({
    resolver: zodResolver(joinServerSchema),
    defaultValues: { inviteCode: "" },
  });

  const isOpen = activeModal === "join-server";

  const onSubmit = async (data: JoinServerForm) => {
    if (!user) return;

    // Check rate limit before attempting
    if (!inviteCodeRateLimiter.isAllowed(user.id)) {
      const remainingTime = inviteCodeRateLimiter.getRemainingTime(user.id);
      setError(`Too many attempts. Try again in ${remainingTime} seconds`);
      return;
    }

    setIsLoading(true);
    setError(null);
    // Clear any previous store error so we don't show stale messages
    useServerStore.setState({ error: null });

    try {
      const joinedServer = await joinServer(data.inviteCode.toUpperCase(), user.id);
      if (joinedServer) {
        toast.success("Successfully joined server!");
        // Set the joined server as current and fetch channels
        setCurrentServer(joinedServer);
        await fetchChannels(joinedServer.id);
        navigate(`/app/servers/${joinedServer.id}`);
        reset();
        closeModal();
      } else {
        const storeError = useServerStore.getState().error;
        if (storeError?.toLowerCase().includes("banned")) {
          setShowBannedModal(true);
        } else {
          setError(storeError || "Invalid invite code or you may already be a member");
        }
      }
    } catch (error) {
      setError("Failed to join server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    closeModal();
  };

  const handleBack = () => {
    handleClose();
    openModal("create-server");
  };

  // Auto-uppercase input
  const handleInviteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    setValue("inviteCode", value);
  };

  const modalContentClass =
    "sm:max-w-md max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0";

  return (
    <>
      {/* Banned modal */}
      <Dialog
        open={showBannedModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowBannedModal(false);
            handleClose();
          }
        }}
      >
        <DialogContent className={modalContentClass} hideCloseButton>
          <div className="flex flex-col items-center justify-center gap-4 p-4 sm:p-6">
            <div className="w-12 h-12 rounded-xl bg-destructive/15 flex items-center justify-center">
              <Frown className="w-6 h-6 text-destructive" />
            </div>
            <p className="text-center text-lg font-medium text-foreground">
              Uh oh, seems that you have been banned from this server
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setShowBannedModal(false);
                handleClose();
              }}
              className="rounded-xl"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join server modal */}
      <Dialog open={isOpen && !showBannedModal} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={modalContentClass}>
          <div className="p-4 sm:p-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl font-medium">Join a Server</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-1">
                Enter an invite code to join an existing server
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Invite Code Input */}
              <div className="space-y-2">
                <Label
                  htmlFor="inviteCode"
                  className="text-xs font-medium uppercase text-muted-foreground tracking-wide"
                >
                  Invite Code
                </Label>
                <Input
                  id="inviteCode"
                  placeholder="ABC12XYZ"
                  {...register("inviteCode")}
                  onChange={handleInviteChange}
                  className={`rounded-xl text-center font-mono text-lg tracking-widest ${errors.inviteCode || error ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  autoFocus
                  maxLength={8}
                />
                {errors.inviteCode && <p className="text-xs text-destructive">{errors.inviteCode.message}</p>}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>

              <div className="p-4 bg-secondary/30 rounded-xl border border-border/30">
                <p className="font-normal text-xs text-muted-foreground">Invites should look like:</p>
                <p className="text-sm font-mono text-foreground mt-1">ABC12XYZ</p>
              </div>

              {/* Actions - same style as Create Server modal: Back left, primary right */}
              <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 sm:gap-3 pt-2 border-t border-border/30">
                <Button type="button" variant="outline" rounded="xl" onClick={handleBack} className="flex-1 sm:flex-none">
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  rounded="xl"
                  className="flex-1 sm:flex-none"
                >
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Join Server
                </Button>
              </div>
            </form>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
