import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, ArrowLeft, ArrowRight, Frown, Link2, Loader2 } from "lucide-react";
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
    "sm:max-w-[420px] max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden border border-[#30333D] bg-[#202329] p-0 text-[#E2E4E9] shadow-[0_18px_48px_rgba(0,0,0,0.38)] sm:rounded-[8px]";

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
              <p className="max-w-[300px] text-[13px] leading-5 text-[#B2B5BE]">
                You have been banned from this server.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setShowBannedModal(false);
                handleClose();
              }}
              className="h-9 rounded-[4px] border-[#42464F] px-4 text-[13px] text-[#E2E4E9] hover:bg-[#30333D]"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join server modal */}
      <Dialog open={isOpen && !showBannedModal} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={modalContentClass}>
          <div className="border-b border-[#30333D] px-5 pb-4 pt-5 sm:px-6">
            <DialogHeader className="text-left">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#2A2E37] text-[#D7D9DF]">
                <Link2 className="h-5 w-5" />
              </div>
              <DialogTitle className="text-[20px] font-medium leading-6 text-white">Join by invite</DialogTitle>
              <DialogDescription className="mt-1 max-w-[340px] text-[13px] leading-5 text-[#B2B5BE]">
                Paste an 8 character invite code to access an existing server.
              </DialogDescription>
            </DialogHeader>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label
                  htmlFor="inviteCode"
                  className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8F949D]"
                >
                  Invite Code
                </Label>
                <span className="font-mono text-[11px] text-[#8F949D]">{inviteCode.length}/8</span>
              </div>
              <div className="relative">
                <Input
                  id="inviteCode"
                  placeholder="ABC12XYZ"
                  {...register("inviteCode")}
                  onChange={handleInviteChange}
                  className={`h-12 rounded-[4px] border-[#42464F] bg-[#30333D] pr-10 text-center font-mono text-[18px] font-medium uppercase tracking-[0.28em] text-white placeholder:text-[#767B85] focus-visible:border-white focus-visible:ring-0 ${
                    inviteError ? "border-red-400/80 focus-visible:border-red-300" : ""
                  }`}
                  autoFocus
                  maxLength={8}
                  autoComplete="off"
                  spellCheck={false}
                />
                {inviteError && (
                  <AlertCircle className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-red-300" />
                )}
              </div>
              {inviteError ? (
                <p className="text-[12px] leading-4 text-red-300">{inviteError}</p>
              ) : (
                <p className="text-[12px] leading-4 text-[#8F949D]">
                  Invite codes use letters and numbers only.
                </p>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-[4px] border border-[#3B3F49] bg-[#252932] p-3">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-[#30333D] text-[#D7D9DF]">
                <Link2 className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-5 text-[#E2E4E9]">Example invite</p>
                <p className="mt-0.5 font-mono text-[12px] leading-4 tracking-[0.18em] text-[#B2B5BE]">ABC12XYZ</p>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-[#30333D] pt-4 sm:flex-row sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                onClick={handleBack}
                className="h-9 rounded-[4px] px-3 text-[13px] text-[#B2B5BE] hover:bg-[#30333D] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
              <Button
                type="submit"
                disabled={isJoinDisabled}
                className="h-9 rounded-[4px] bg-white px-4 text-[13px] font-medium text-[#191C21] hover:bg-[#E7E9EE] disabled:bg-[#D7D9DF] disabled:text-[#6F747D] disabled:opacity-100"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Join Server
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
