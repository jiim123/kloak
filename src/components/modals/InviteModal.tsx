import { useState } from "react";
import { Check, Copy, Loader2, Link2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const [linkCopied, setLinkCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState<string>("never");
  const [maxUses, setMaxUses] = useState<string>("unlimited");

  const isOpen = activeModal === "invite";

  // Get server from modal data or use current server
  const serverId = modalData?.serverId as string | undefined;
  const server = serverId ? servers.find((s) => s.id === serverId) || currentServer : currentServer;

  // Check if current user can manage invites
  const { hasPermission } = useMemberPermissions();
  const isAdmin = hasPermission("manage_invites");

  const displayCode = inviteCode || "";

  const inviteLink = displayCode ? `${window.location.origin}/invite/${displayCode}` : "";

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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleGenerateInvite = async () => {
    if (!server || !user) return;

    const expiresInSeconds =
      expiresIn === "never"
        ? null
        : expiresIn === "30m"
          ? 30 * 60
          : expiresIn === "1h"
            ? 60 * 60
            : expiresIn === "6h"
              ? 6 * 60 * 60
              : expiresIn === "12h"
                ? 12 * 60 * 60
                : expiresIn === "1d"
                  ? 24 * 60 * 60
                  : 7 * 24 * 60 * 60;

    const maxUsesValue = maxUses === "unlimited" ? null : parseInt(maxUses, 10);

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('create_server_invite', {
        _server_id: server.id,
        _user_id: user.id,
        _expires_in_seconds: expiresInSeconds,
        _max_uses: maxUsesValue,
      });

      if (error) throw error;
      setInviteCode((data as unknown as string) || null);
      toast.success("Invite generated!");
    } catch (error) {
      console.error("Failed to generate invite:", error);
      toast.error("Failed to generate invite");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClose = () => {
    setCopied(false);
    setLinkCopied(false);
    setInviteCode(null);
    setExpiresIn("never");
    setMaxUses("unlimited");
    closeModal();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-border bg-card p-0 text-foreground shadow-2xl sm:max-w-[448px]">
          <div className="flex max-h-[82vh] flex-col overflow-hidden">
            <div className="border-b border-border bg-muted px-5 py-3">
              <div className="text-base font-medium leading-none tracking-tight">
                Invite people
              </div>
            </div>

            <div className="space-y-5 overflow-y-auto px-6 py-4">
              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invite settings
                </Label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expires after</Label>
                    <Select value={expiresIn} onValueChange={setExpiresIn}>
                      <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-white/70 bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-card text-foreground">
                        <SelectItem value="never">Never</SelectItem>
                        <SelectItem value="30m">30 minutes</SelectItem>
                        <SelectItem value="1h">1 hour</SelectItem>
                        <SelectItem value="6h">6 hours</SelectItem>
                        <SelectItem value="12h">12 hours</SelectItem>
                        <SelectItem value="1d">1 day</SelectItem>
                        <SelectItem value="7d">7 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Max uses</Label>
                    <Select value={maxUses} onValueChange={setMaxUses}>
                      <SelectTrigger className="mt-2 h-9 rounded-none border-0 border-b border-white/70 bg-transparent px-0 text-sm text-foreground shadow-none focus:ring-0 focus:ring-offset-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="border-border bg-card text-foreground">
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Invite code
                </Label>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 flex-1 items-center justify-center border border-border bg-muted px-3">
                    <span className="font-mono text-lg font-medium tracking-[0.25em] text-foreground">
                      {displayCode || "--------"}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    onClick={handleCopy}
                    className="h-12 w-12 flex-shrink-0 rounded-[3px] bg-primary text-primary-foreground hover:bg-white disabled:bg-[#454b55] disabled:text-muted-foreground"
                    disabled={!displayCode}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCopyLink}
                  className="h-9 w-full rounded-[3px] border-border bg-transparent text-foreground hover:bg-muted hover:text-white"
                  disabled={!inviteLink}
                >
                  {linkCopied ? <Check className="mr-2 h-4 w-4" /> : <Link2 className="mr-2 h-4 w-4" />}
                  Copy Invite Link
                </Button>
                {!isAdmin && (
                  <p className="text-xs leading-5 text-[#d7a0a0]">
                    You need permission to manage invites before creating a new invite.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border bg-card px-5 py-3">
              <Button
                onClick={handleGenerateInvite}
                className="h-9 rounded-[3px] bg-primary px-5 font-medium text-primary-foreground hover:bg-white"
                disabled={!isAdmin || isGenerating || !server || !user}
              >
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
