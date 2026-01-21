import { useState } from "react";
import { Check, Copy, RefreshCw, Users, Loader2, Zap, Link2, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const InviteModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { currentServer, servers } = useServerStore();
  const { user } = useAuthStore();

  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const isOpen = activeModal === "invite";

  // Get server from modal data or use current server
  const serverId = modalData?.serverId as string | undefined;
  const server = serverId ? servers.find((s) => s.id === serverId) || currentServer : currentServer;

  // Check if current user can manage invites
  const { hasPermission } = useMemberPermissions();
  const isAdmin = hasPermission("manage_invites");

  const displayCode = inviteCode || server?.invite_code || "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true);
      toast.success("Invite code copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleRegenerate = async () => {
    if (!server || !user) return;

    setIsRegenerating(true);
    try {
      // Generate new invite code and update directly
      const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
      let newCode = "";
      for (let i = 0; i < 8; i++) {
        newCode += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const { error } = await supabase.from("servers").update({ invite_code: newCode }).eq("id", server.id);

      if (error) throw error;

      setInviteCode(newCode);
      toast.success("New invite code generated!");
      setShowRegenerateConfirm(false);
    } catch (error) {
      console.error("Failed to regenerate invite code:", error);
      toast.error("Failed to regenerate code");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleClose = () => {
    setCopied(false);
    setInviteCode(null);
    closeModal();
  };

  const steps = [
    {
      icon: <Zap className="h-4 w-4" />,
      title: "Open server menu",
      text: "Click the + button in the server sidebar",
    },
    {
      icon: <Users className="h-4 w-4" />,
      title: "Join option",
      text: 'Select "Join a Server" from the menu',
    },
    {
      icon: <Link2 className="h-4 w-4" />,
      title: "Enter code",
      text: "Paste or type this invite code",
    },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] overflow-hidden p-0 rounded-2xl gap-0">
          {/* Header with gradient accent */}
          <div className="relative px-6 pt-6 pb-4">
            {/* Decorative gradient blob */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-kloak-success/20 rounded-full blur-3xl pointer-events-none" />

            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-kloak-success/10 px-3 py-1 text-xs font-medium text-kloak-success mb-4">
              <Users className="w-3 h-3" />
              Share with friends
            </div>

            {/* Title & Description */}
            <h2 className="text-xl font-semibold pr-8">Invite to {server?.name}</h2>
            <p className="text-sm text-muted-foreground mt-1">Share this code to grant access to your server</p>
          </div>

          {/* Content */}
          <div className="px-6 pb-6 space-y-6">
            {/* Invite Code Display */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Invite Code
              </Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-14 flex items-center justify-center rounded-xl border-2 border-kloak-success/20 bg-kloak-success/5">
                  <span className="font-mono text-xl tracking-[0.25em] font-bold text-kloak-success">
                    {displayCode}
                  </span>
                </div>
                <Button
                  size="icon"
                  onClick={handleCopy}
                  className="h-14 w-14 rounded-xl bg-kloak-success hover:bg-kloak-success/90 flex-shrink-0"
                >
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </Button>
              </div>
            </div>

            {/* How it works section */}
            <div className="space-y-4">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                How to join
              </Label>
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 p-3 rounded-xl bg-secondary/50 border border-border/50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-kloak-success/10 flex items-center justify-center flex-shrink-0 text-kloak-success">
                      {step.icon}
                    </div>
                    <div className="min-w-0 pt-0.5 flex-1">
                      <p className="text-sm font-medium">{step.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{step.text}</p>
                    </div>
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-muted-foreground">
                      {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Regenerate button (admin only) */}
            {isAdmin && (
              <Button
                variant="outline"
                onClick={() => setShowRegenerateConfirm(true)}
                className="w-full h-11 rounded-xl border-dashed"
                disabled={isRegenerating}
              >
                {isRegenerating ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Regenerate Code
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirmation */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-sm rounded-2xl">
          <AlertDialogHeader>
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-2">
              <RefreshCw className="w-6 h-6 text-amber-500" />
            </div>
            <AlertDialogTitle>Regenerate Invite Code?</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              This will invalidate the current invite code. Anyone with the old code will no longer be able to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-3 sm:gap-3">
            <AlertDialogCancel className="flex-1 m-0 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600"
            >
              {isRegenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
