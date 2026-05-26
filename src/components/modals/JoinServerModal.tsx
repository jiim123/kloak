import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Frown, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
    .min(8, "Invite code must be 8 characters")
    .max(8, "Invite code must be 8 characters")
    .regex(/^[A-Z0-9]+$/i, "Invalid invite code format"),
});

type JoinServerForm = z.infer<typeof joinServerSchema>;

export const JoinServerModal = () => {
  const navigate = useNavigate();
  const { activeModal, modalData, closeModal, openModal } = useUIStore();
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
    watch,
  } = useForm<JoinServerForm>({
    resolver: zodResolver(joinServerSchema),
    defaultValues: { inviteCode: "" },
  });

  const isOpen = activeModal === "join-server";
  const inviteCode = watch("inviteCode") || "";
  const inviteError = errors.inviteCode?.message || error;
  const isJoinDisabled = isLoading || inviteCode.length !== 8;

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
    if (modalData?.fromAddServerPanel) {
      handleClose();
      return;
    }
    handleClose();
    openModal("create-server");
  };

  // Auto-uppercase input
  const handleInviteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    setValue("inviteCode", value, { shouldDirty: true, shouldValidate: true });
    if (error) setError(null);
  };

  const modalContentClass =
    "max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]";

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
          <div className="flex flex-col items-center justify-center gap-4 px-5 py-6 sm:px-6">
            <div className="flex h-11 w-11 items-center justify-center rounded-[6px] border border-red-400/20 bg-red-500/10">
              <Frown className="h-5 w-5 text-red-300" />
            </div>
            <div className="space-y-1 text-center">
              <p className="text-[17px] font-medium leading-6 text-white">Unable to join server</p>
              <p className="max-w-[300px] text-[13px] leading-5 text-muted-foreground">
                You have been banned from this server.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setShowBannedModal(false);
                handleClose();
              }}
              className="h-9 rounded-[4px] border-border px-4 text-[13px] text-[#E2E4E9] hover:bg-muted"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join server modal */}
      <Dialog open={isOpen && !showBannedModal} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={modalContentClass}>
          <form onSubmit={handleSubmit(onSubmit)} className="flex max-h-[82vh] flex-col overflow-hidden">
            <div className="border-b border-border bg-muted px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">
                Join by invite
              </div>
             
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-4">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="inviteCode"
                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Invite code
                  </Label>
                  <span className="font-mono text-xs text-muted-foreground">{inviteCode.length}/8</span>
                </div>
                <div className="relative mt-2">
                  <Input
                    id="inviteCode"
                    placeholder="ABC12XYZ"
                    {...register("inviteCode")}
                    onChange={handleInviteChange}
                    className={`h-12 rounded-none border-0 border-b border-white/80 bg-transparent px-0 pr-8 text-center font-mono text-lg font-medium uppercase tracking-[0.28em] text-foreground shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 ${
                      inviteError ? "border-red-300 focus-visible:border-red-300" : ""
                    }`}
                    autoFocus
                    maxLength={8}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {inviteError && (
                    <AlertCircle className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-red-300" />
                  )}
                </div>
                {inviteError ? (
                  <p className="mt-2 text-xs leading-5 text-red-300">{inviteError}</p>
                ) : (
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Invite codes use letters and numbers only.
                  </p>
                )}
              </div>

              <div className="border border-border bg-muted p-3">
                <p className="text-sm font-medium leading-none text-foreground">Example invite</p>
                <p className="mt-2 font-mono text-xs leading-5 tracking-[0.18em] text-muted-foreground">ABC12XYZ</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-3">
              <Button
                type="submit"
                disabled={isJoinDisabled}
                className="h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-white disabled:bg-[#454b55] disabled:text-muted-foreground disabled:opacity-100"
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Join Server
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
