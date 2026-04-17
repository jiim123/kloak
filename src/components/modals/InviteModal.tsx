import { Check, CircleNotch, Copy, Link, Users } from "@phosphor-icons/react";
import { useState } from "react";

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
 <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] overflow-hidden p-0 rounded-2xl gap-0">
 {/* Header with gradient accent */}
 <div className="relative px-6 pt-6 pb-4">
 {/* Decorative gradient blob */}
 <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl pointer-events-none" />

 {/* Badge */}
 <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
 <Users className="w-3 h-3" />
 Share with friends
 </div>

 {/* Title & Description */}
 <h2 className="text-xl font-medium pr-8">Invite to {server?.name}</h2>
 <p className="text-sm text-muted-foreground mt-1">Share this code to grant access to your server</p>
 </div>

 {/* Content */}
 <div className="px-6 pb-6 space-y-6">
 {/* Invite options */}
 <div className="space-y-3">
 <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
 Invite settings
 </Label>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Expires</Label>
 <Select value={expiresIn} onValueChange={setExpiresIn}>
 <SelectTrigger className="h-10 rounded-xl">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
 <SelectItem value="never">Never</SelectItem>
 <SelectItem value="30m">30 minutes</SelectItem>
 <SelectItem value="1h">1 hour</SelectItem>
 <SelectItem value="6h">6 hour</SelectItem>
 <SelectItem value="12h">12 hour</SelectItem>
 <SelectItem value="1d">1 day</SelectItem>
 <SelectItem value="7d">7 days</SelectItem>
 </SelectContent>
 </Select>
 </div>
 <div className="space-y-2">
 <Label className="text-xs text-muted-foreground">Max uses</Label>
 <Select value={maxUses} onValueChange={setMaxUses}>
 <SelectTrigger className="h-10 rounded-xl">
 <SelectValue />
 </SelectTrigger>
 <SelectContent>
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
 <Button
 onClick={handleGenerateInvite}
 className="w-full h-11 rounded-xl"
 disabled={!isAdmin || isGenerating || !server || !user}
 >
 {isGenerating && <CircleNotch className="w-4 h-4 mr-2 animate-spin" />}
 Generate Invite
 </Button>
 </div>

 {/* Invite Code Display */}
 <div className="space-y-3">
 <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
 Invite Code
 </Label>
 <div className="flex items-center gap-3">
 <div className="flex-1 h-14 flex items-center justify-center rounded-xl border-2 border-primary/20 bg-primary/5">
 <span className="font-mono text-xl tracking-[0.25em] font-medium text-primary">
 {displayCode || "--------"}
 </span>
 </div>
 <Button
 size="icon"
 onClick={handleCopy}
 className="h-14 w-14 rounded-xl flex-shrink-0"
 disabled={!displayCode}
 >
 {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
 </Button>
 </div>
 <Button
 variant="outline"
 onClick={handleCopyLink}
 className="w-full h-11 rounded-xl"
 disabled={!inviteLink}
 >
 {linkCopied ? <Check className="w-4 h-4 mr-2" /> : <Link className="w-4 h-4 mr-2" />}
 Copy Invite Link
 </Button>
 </div>
 </div>
 </DialogContent>
 </Dialog>
 </>
 );
};
