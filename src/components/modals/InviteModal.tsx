import { useState } from 'react';
import { Check, Copy, RefreshCw, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { toast } from 'sonner';

export const InviteModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { currentServer, servers } = useServerStore();
  const [copied, setCopied] = useState(false);

  const isOpen = activeModal === 'invite';
  
  // Get server from modal data or use current server
  const serverId = modalData?.serverId as string | undefined;
  const server = serverId 
    ? servers.find(s => s.id === serverId) || currentServer
    : currentServer;

  const inviteCode = server?.invite_code || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      toast.success('Invite code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy');
    }
  };

  const handleClose = () => {
    setCopied(false);
    closeModal();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Invite Friends to {server?.name}
          </DialogTitle>
          <DialogDescription>
            Share this code with others to grant access to your server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invite Code Display */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase text-muted-foreground">
              Invite Code
            </Label>
            <div className="flex gap-2">
              <Input
                value={inviteCode}
                readOnly
                className="font-mono text-lg tracking-[0.3em] text-center bg-secondary"
              />
              <Button 
                variant="secondary" 
                size="icon"
                onClick={handleCopy}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">How to join:</p>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Click the + button in the server sidebar</li>
              <li>Select "Join a Server"</li>
              <li>Enter this invite code</li>
            </ol>
          </div>

          {/* Copy button */}
          <Button onClick={handleCopy} className="w-full">
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy Invite Code
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
