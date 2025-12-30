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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Generate new invite code
const generateInviteCode = (): string => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const InviteModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { currentServer, servers, members } = useServerStore();
  const [copied, setCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  const isOpen = activeModal === "invite";

  // Get server from modal data or use current server
  const serverId = modalData?.serverId as string | undefined;
  const server = serverId ? servers.find((s) => s.id === serverId) || currentServer : currentServer;

  // Check if current user is admin/owner
  const currentMember = members.find((m) => m.user_id === modalData?.userId);
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";

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
    if (!server) return;

    setIsRegenerating(true);
    try {
      const newCode = generateInviteCode();

      const { error } = await supabase.from("servers").update({ invite_code: newCode }).eq("id", server.id);

      if (error) throw error;

      setInviteCode(newCode);
      toast.success("New invite code generated!");
      setShowRegenerateConfirm(false);
    } catch (error) {
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
        <DialogContent className="sm:max-w-md overflow-hidden">
          <motion.div initial="hidden" animate="visible" variants={cardVariants} className="relative">
            {/* Decorative image in top-right */}
            <div className="absolute right-4 top-4 opacity-20 pointer-events-none">
              <Users className="h-24 w-24 text-nomo-success" />
            </div>

            <div className="relative z-10">
              <DialogHeader className="space-y-3">
                {/* Badge */}
                <motion.div
                  variants={itemVariants}
                  className="inline-block self-start rounded-full bg-nomo-success/10 px-3 py-1 text-sm font-medium text-nomo-success"
                >
                  Share with friends
                </motion.div>

                {/* Title */}
                <motion.div variants={itemVariants}>
                  <DialogTitle className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    Invite to {server?.name}
                  </DialogTitle>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <DialogDescription className="text-muted-foreground">
                    Share this code to grant access to your server
                  </DialogDescription>
                </motion.div>
              </DialogHeader>

              <div className="space-y-6 mt-6">
                {/* Invite Code Display */}
                <motion.div variants={itemVariants} className="space-y-2">
                  <Label className="text-sm font-semibold">Your invite code:</Label>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex h-12 flex-grow items-center justify-center gap-2 rounded-lg border-2 border-nomo-success/20 bg-nomo-success/5 px-4">
                      <span className="font-mono text-xl tracking-[0.3em] font-bold text-nomo-success">
                        {displayCode}
                      </span>
                    </div>
                    <Button
                      variant="default"
                      onClick={handleCopy}
                      className="w-full sm:w-auto shrink-0 bg-nomo-success hover:bg-nomo-success/90"
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        {copied ? (
                          <motion.span
                            key="copied"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex items-center gap-2"
                          >
                            <Check className="h-4 w-4" /> Copied!
                          </motion.span>
                        ) : (
                          <motion.span
                            key="copy"
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="flex items-center gap-2"
                          >
                            <Copy className="h-4 w-4" /> Copy Code
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </Button>
                  </div>
                </motion.div>

                {/* How it works section */}
                <div>
                  <motion.h3 variants={itemVariants} className="mb-4 font-semibold text-sm">
                    How it works:
                  </motion.h3>
                  <motion.ul
                    className="space-y-3"
                    initial="hidden"
                    animate="visible"
                    transition={{ staggerChildren: 0.1, delayChildren: 0.2 }}
                  >
                    {steps.map((step, index) => (
                      <motion.li key={index} variants={itemVariants} className="flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-nomo-success/10 text-nomo-success shrink-0">
                          {step.icon}
                        </span>
                        <span className="text-sm text-muted-foreground">{step.text}</span>
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
                      className="w-full border-dashed"
                      disabled={isRegenerating}
                    >
                      {isRegenerating ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Invite Code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate the current invite code. Anyone with the old code will no longer be able to join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
