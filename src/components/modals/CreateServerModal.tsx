import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Upload, X } from 'lucide-react';
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

const createServerSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Server name is required')
    .max(100, 'Server name must be less than 100 characters'),
});

type CreateServerForm = z.infer<typeof createServerSchema>;

export const CreateServerModal = () => {
  const { activeModal, closeModal } = useUIStore();
  const { createServer, setCurrentServer, fetchChannels } = useServerStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateServerForm>({
    resolver: zodResolver(createServerSchema),
    defaultValues: { name: '' },
  });

  const isOpen = activeModal === 'create-server';

  const onSubmit = async (data: CreateServerForm) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const server = await createServer(data.name, user.id);
      if (server) {
        toast.success(`Server "${server.name}" created!`);
        setCurrentServer(server);
        await fetchChannels(server.id);
        reset();
        closeModal();
      }
    } catch (error) {
      toast.error('Failed to create server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    reset();
    closeModal();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Create Your Server</DialogTitle>
          <DialogDescription className="text-center">
            Your server is where you and your friends hang out. Make yours and start talking.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Server Icon Preview */}
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 cursor-pointer hover:border-primary transition-colors">
              <Upload className="w-6 h-6 text-muted-foreground" />
            </div>
          </div>

          {/* Server Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs font-bold uppercase text-muted-foreground">
              Server Name
            </Label>
            <Input
              id="name"
              placeholder="My Awesome Server"
              {...register('name')}
              className={errors.name ? 'border-destructive' : ''}
              autoFocus
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            By creating a server, you agree to our Community Guidelines.
          </p>

          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button type="button" variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
