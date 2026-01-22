import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Upload, Plus, Users, ArrowLeft, X } from 'lucide-react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const MAX_ICON_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_ICON_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const createServerSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Server name is required')
    .max(100, 'Server name must be less than 100 characters'),
});

const joinServerSchema = z.object({
  inviteCode: z.string()
    .trim()
    .min(1, 'Invite code is required')
    .max(8, 'Invite code must be 8 characters')
    .regex(/^[A-Z0-9]+$/i, 'Invalid invite code format'),
});

type CreateServerForm = z.infer<typeof createServerSchema>;
type JoinServerForm = z.infer<typeof joinServerSchema>;

type ModalView = 'choose' | 'create' | 'join';

export const CreateServerModal = () => {
  const navigate = useNavigate();
  const { activeModal, closeModal } = useUIStore();
  const { createServer, updateServer, joinServer, servers, setCurrentServer, fetchChannels } = useServerStore();
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<ModalView>('choose');
  const [joinError, setJoinError] = useState<string | null>(null);
  
  // Icon upload state
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createForm = useForm<CreateServerForm>({
    resolver: zodResolver(createServerSchema),
    defaultValues: { name: '' },
  });

  const joinForm = useForm<JoinServerForm>({
    resolver: zodResolver(joinServerSchema),
    defaultValues: { inviteCode: '' },
  });

  const isOpen = activeModal === 'create-server';

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_ICON_TYPES.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, or WebP image');
      return;
    }

    if (file.size > MAX_ICON_SIZE) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const clearIcon = () => {
    setIconFile(null);
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadIcon = async (serverId: string, file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${serverId}/icon.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('server-icons')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Failed to upload icon:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('server-icons')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  const onCreateSubmit = async (data: CreateServerForm) => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const server = await createServer(data.name, user.id);
      if (server) {
        // Upload icon if selected
        if (iconFile) {
          const iconUrl = await uploadIcon(server.id, iconFile);
          if (iconUrl) {
            await updateServer(server.id, user.id, { icon_url: iconUrl });
          }
        }
        
        // Set default banner for new servers
        await updateServer(server.id, user.id, { banner_url: '/default_server_banner.png' });
        
        // Create server object with default banner
        const serverWithBanner = { ...server, banner_url: '/default_server_banner.png' };
        
        toast.success(`Server "${server.name}" created!`);
        setCurrentServer(serverWithBanner);
        await fetchChannels(server.id);
        navigate(`/app/servers/${server.id}`);
        handleClose();
      }
    } catch (error) {
      toast.error('Failed to create server');
    } finally {
      setIsLoading(false);
    }
  };

  const onJoinSubmit = async (data: JoinServerForm) => {
    if (!user) return;
    
    setIsLoading(true);
    setJoinError(null);
    
    try {
      const success = await joinServer(data.inviteCode.toUpperCase(), user.id);
      if (success) {
        toast.success('Successfully joined server!');
        const newServer = servers.find(s => s.invite_code === data.inviteCode.toUpperCase());
        if (newServer) {
          setCurrentServer(newServer);
          await fetchChannels(newServer.id);
          navigate(`/app/servers/${newServer.id}`);
        }
        handleClose();
      } else {
        setJoinError('Invalid invite code or you may already be a member');
      }
    } catch (error) {
      setJoinError('Failed to join server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    createForm.reset();
    joinForm.reset();
    setView('choose');
    setJoinError(null);
    clearIcon();
    closeModal();
  };

  const handleInviteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    joinForm.setValue('inviteCode', value);
  };

  const handleBack = () => {
    setView('choose');
    setJoinError(null);
    clearIcon();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleIconSelect}
          className="hidden"
        />

        {/* Choose View */}
        {view === 'choose' && (
          <>
            <DialogHeader>
              <DialogTitle className="text-center text-xl">Add a Server</DialogTitle>
              <DialogDescription className="text-center">
                Create your own server or join an existing one with an invite code.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4">
              <button
                onClick={() => setView('create')}
                className="w-full p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-nomo-success/20 flex items-center justify-center group-hover:bg-nomo-success/30 transition-colors">
                  <Plus className="w-6 h-6 text-nomo-success" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold tracking-tight">Create My Own</p>
                  <p className="text-sm text-muted-foreground">Start fresh with your own server</p>
                </div>
              </button>

              <button
                onClick={() => setView('join')}
                className="w-full p-4 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 transition-colors flex items-center gap-4 group"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div className="text-left flex-1">
                  <p className="font-semibold tracking-tight">Join a Server</p>
                  <p className="text-sm text-muted-foreground">Enter an invite code to join</p>
                </div>
              </button>
            </div>

            <DialogFooter className="sm:justify-center">
              <Button variant="ghost" onClick={handleClose}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Create View */}
        {view === 'create' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <DialogTitle className="text-xl">Create Your Server</DialogTitle>
              </div>
              <DialogDescription className="text-center">
                Your server is where you and your friends hang out. Make yours and start talking.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 cursor-pointer hover:border-primary transition-colors overflow-hidden"
                  >
                    {iconPreview ? (
                      <img src={iconPreview} alt="Server icon preview" className="w-full h-full object-cover" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  {iconPreview && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearIcon();
                      }}
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Click to upload an icon (optional)
              </p>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase text-muted-foreground">
                  Server Name
                </Label>
                <Input
                  id="name"
                  placeholder="My Awesome Server"
                  {...createForm.register('name')}
                  className={createForm.formState.errors.name ? 'border-destructive' : ''}
                  autoFocus
                />
                {createForm.formState.errors.name && (
                  <p className="text-xs text-destructive">{createForm.formState.errors.name.message}</p>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                By creating a server, you agree to our Community Guidelines.
              </p>

              <DialogFooter className="flex gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={handleBack}>
                  Back
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </>
        )}

        {/* Join View */}
        {view === 'join' && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <DialogTitle className="text-xl">Join a Server</DialogTitle>
              </div>
              <DialogDescription className="text-center">
                Enter an invite code to join an existing server.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={joinForm.handleSubmit(onJoinSubmit)} className="space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="inviteCode" className="text-xs font-bold uppercase text-muted-foreground">
                  Invite Code
                </Label>
                <Input
                  id="inviteCode"
                  placeholder="ABC12XYZ"
                  {...joinForm.register('inviteCode')}
                  onChange={handleInviteChange}
                  className={`text-center font-mono text-lg tracking-widest ${joinForm.formState.errors.inviteCode || joinError ? 'border-destructive' : ''}`}
                  autoFocus
                  maxLength={8}
                />
                {joinForm.formState.errors.inviteCode && (
                  <p className="text-xs text-destructive text-center">{joinForm.formState.errors.inviteCode.message}</p>
                )}
                {joinError && (
                  <p className="text-xs text-destructive text-center">{joinError}</p>
                )}
              </div>

              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  <strong>Invites should look like:</strong>
                </p>
                <p className="text-sm font-mono text-foreground mt-1">ABC12XYZ</p>
              </div>

              <DialogFooter className="flex gap-2 sm:justify-between">
                <Button type="button" variant="ghost" onClick={handleBack}>
                  Back
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Join Server
                </Button>
              </DialogFooter>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};