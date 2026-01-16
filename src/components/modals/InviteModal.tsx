import { useState } from "react";
import { Check, Copy, RefreshCw, Users, Loader2, Zap, Link2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const { currentServer, servers, members } = useServerStore();
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
  const isAdmin = hasPermission('manage_invites');

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
      // Use RPC function with permission check
      const { data, error } = await supabase.rpc('regenerate_invite_code', {
        _server_id: server.id,
        _user_id: user.id
      });

      if (error) throw error;

      setInviteCode(data);
      toast.success("New invite code generated!");
      setShowRegenerateConfirm(false);
    } catch (error) {
      console.error('Failed to regenerate invite code:', error);
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

  // Animation variants
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  const steps = [
    {
      icon: <Zap className="h-4 w-4" />,
      text: "Click the + button in the server sidebar",
    },
    {
      icon: <Users className="h-4 w-4" />,
      text: 'Select "Join a Server"',
    },
    {
      icon: <Link2 className="h-4 w-4" />,
      text: "Enter this invite code",
    },
  ];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] overflow-hidden p-0">
          <motion.div initial="hidden" animate="visible" variants={cardVariants} className="relative p-6 sm:p-8">
            {/* Decorative image in top-right - hidden on mobile */}
            <div className="absolute right-4 top-4 opacity-20 pointer-events-none hidden sm:block">
              <Users className="h-20 w-20 sm:h-24 sm:w-24 text-nomo-success" />
            </div>

            <div className="relative z-10">
              <DialogHeader className="space-y-2 sm:space-y-3">
                {/* Badge */}
                <motion.div
                  variants={itemVariants}
                  className="inline-block self-start rounded-full bg-nomo-success/10 px-2.5 py-1 text-xs sm:text-sm font-medium text-nomo-success"
                >
                  Share with friends
                </motion.div>

                {/* Title */}
                <motion.div variants={itemVariants}>
                  <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight pr-16 sm:pr-20">
                    Invite to {server?.name}
                  </DialogTitle>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <DialogDescription className="text-sm text-muted-foreground">
                    Share this code to grant access to your server
                  </DialogDescription>
                </motion.div>
              </DialogHeader>

              <div className="space-y-5 sm:space-y-6 mt-5 sm:mt-6">
                {/* Invite Code Display */}
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label className="text-xs sm:text-sm font-semibold">Your invite code:</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex h-11 sm:h-12 flex-grow items-center justify-center gap-2 rounded-lg border-2 border-nomo-success/20 bg-nomo-success/5 px-3 sm:px-4">
                      <span className="font-mono text-base sm:text-xl tracking-[0.2em] sm:tracking-[0.3em] font-bold text-nomo-success">
                        {displayCode}
                      </span>
                    </div>
                    <Button
                      size="icon"
                      variant="default"
                      onClick={handleCopy}
                      className="h-11 w-11 sm:h-12 sm:w-12 shrink-0 bg-nomo-success hover:bg-nomo-success/90"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {copied ? (
                          <motion.div
                            key="copied"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Check className="h-4 w-4 sm:h-5 sm:w-5" />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="copy"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            exit={{ scale: 0, rotate: 180 }}
                            transition={{ duration: 0.2 }}
                          >
                            <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </Button>
                  </div>
                </motion.div>

                {/* How it works section */}
                <div>
                  <motion.h3 variants={itemVariants} className="mb-3 sm:mb-4 font-semibold text-xs sm:text-sm">
                    How it works:
                  </motion.h3>
                  <motion.ul
                    className="space-y-2.5 sm:space-y-3"
                    initial="hidden"
                    animate="visible"
                    transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
                  >
                    {steps.map((step, index) => (
                      <motion.li
                        key={index}
                        variants={itemVariants}
                        className="flex items-start sm:items-center gap-2.5 sm:gap-3"
                      >
                        <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full bg-nomo-success/10 text-nomo-success shrink-0 mt-0.5 sm:mt-0">
                          {step.icon}
                        </span>
                        <span className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{step.text}</span>
                      </motion.li>
                    ))}
                  </motion.ul>
                </div>

                {/* Regenerate button (admin only) */}
                {isAdmin && (
                  <motion.div variants={itemVariants}>
                    <Button
                      variant="outline"
                      onClick={() => setShowRegenerateConfirm(true)}
                      className="w-full border-dashed text-xs sm:text-sm h-9 sm:h-10"
                      disabled={isRegenerating}
                    >
                      {isRegenerating ? (
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                      )}
                      Regenerate Code
                    </Button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>

      {/* Regenerate Confirmation */}
      <AlertDialog open={showRegenerateConfirm} onOpenChange={setShowRegenerateConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Regenerate Invite Code?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will invalidate the current invite code. Anyone with the old code will no longer be able to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="m-0">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRegenerate} disabled={isRegenerating}>
              {isRegenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Regenerate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
