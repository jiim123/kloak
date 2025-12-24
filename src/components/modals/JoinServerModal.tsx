import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

const joinServerSchema = z.object({
  inviteCode: z.string()
    .trim()
    .min(1, 'Invite code is required')
    .max(8, 'Invite code must be 8 characters')
    .regex(/^[A-Z0-9]+$/i, 'Invalid invite code format'),
});

type JoinServerForm = z.infer<typeof joinServerSchema>;

export const JoinServerModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { joinServer, servers, setCurrentServer, fetchChannels } = useServerStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<JoinServerForm>({
    resolver: zodResolver(joinServerSchema),
    defaultValues: { inviteCode: '' },
  });

  const isOpen = activeModal === 'join-server';

  const onSubmit = async (data: JoinServerForm) => {
    if (!user) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const success = await joinServer(data.inviteCode.toUpperCase(), user.id);
      if (success) {
        toast.success('Successfully joined server!');
        // Find the newly joined server and set it as current
        const newServer = servers.find(s => s.invite_code === data.inviteCode.toUpperCase());
        if (newServer) {
          setCurrentServer(newServer);
          await fetchChannels(newServer.id);
        }
        reset();
        closeModal();
      } else {
        setError('Invalid invite code or you may already be a member');
      }
    } catch (error) {
      setError('Failed to join server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    setError(null);
    closeModal();
  };

  // Auto-uppercase input
  const handleInviteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    setValue('inviteCode', value);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Join a Server</DialogTitle>
          <DialogDescription className="text-center">
            Enter an invite code to join an existing server.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
          </div>

          {/* Invite Code Input */}
          <div className="space-y-2">
            <Label htmlFor="inviteCode" className="text-xs font-bold uppercase text-muted-foreground">
              Invite Code
            </Label>
            <Input
              id="inviteCode"
              placeholder="ABC12XYZ"
              {...register('inviteCode')}
              onChange={handleInviteChange}
              className={`text-center font-mono text-lg tracking-widest ${errors.inviteCode || error ? 'border-destructive' : ''}`}
              autoFocus
              maxLength={8}
            />
            {errors.inviteCode && (
              <p className="text-xs text-destructive text-center">{errors.inviteCode.message}</p>
            )}
            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}
          </div>

          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Invites should look like:</strong>
            </p>
            <p className="text-sm font-mono text-foreground mt-1">ABC12XYZ</p>
          </div>

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Join Server
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
