import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Loader2, 
  Upload, 
  Trash2, 
  Users, 
  Settings, 
  Ban,
  Crown,
  Shield,
  ShieldCheck,
  User
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUIStore } from '@/stores/uiStore';
import { useServerStore } from '@/stores/serverStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ServerRole, ServerMember } from '@/types';

const serverSettingsSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Server name is required')
    .max(100, 'Server name must be less than 100 characters'),
});

type ServerSettingsForm = z.infer<typeof serverSettingsSchema>;

const getRoleIcon = (role: ServerRole) => {
  switch (role) {
    case 'owner': return <Crown className="w-4 h-4 text-yellow-500" />;
    case 'admin': return <ShieldCheck className="w-4 h-4 text-red-500" />;
    case 'moderator': return <Shield className="w-4 h-4 text-blue-500" />;
    default: return <User className="w-4 h-4 text-muted-foreground" />;
  }
};

const getRoleLabel = (role: ServerRole) => {
  return role.charAt(0).toUpperCase() + role.slice(1);
};

export const ServerSettingsModal = () => {
  const { activeModal, modalData, closeModal } = useUIStore();
  const { 
    currentServer, 
    servers, 
    members, 
    fetchMembers,
    deleteServer,
    kickMember,
    banMember,
    updateMember
  } = useServerStore();
  const { user } = useAuthStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const isOpen = activeModal === 'server-settings';
  
  // Get server from modal data or use current server
  const serverId = modalData?.serverId as string | undefined;
  const server = serverId 
    ? servers.find(s => s.id === serverId) || currentServer
    : currentServer;

  // Get current user's role
  const currentMembership = useMemo(() => {
    if (!server) return null;
    return servers.find(s => s.id === server.id);
  }, [servers, server]);

  const userRole = currentMembership?.role;
  const isOwner = userRole === 'owner';
  const isAdmin = userRole === 'owner' || userRole === 'admin';

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ServerSettingsForm>({
    resolver: zodResolver(serverSettingsSchema),
    defaultValues: { name: server?.name || '' },
  });

  // Fetch members when modal opens
  useEffect(() => {
    if (isOpen && server) {
      fetchMembers(server.id);
      reset({ name: server.name });
    }
  }, [isOpen, server, fetchMembers, reset]);

  const onSubmit = async (data: ServerSettingsForm) => {
    if (!server) return;
    
    setIsLoading(true);
    try {
      // TODO: Implement server update
      toast.success('Server settings updated!');
      closeModal();
    } catch (error) {
      toast.error('Failed to update server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!server) return;
    
    setIsLoading(true);
    try {
      await deleteServer(server.id);
      toast.success('Server deleted');
      setShowDeleteConfirm(false);
      closeModal();
    } catch (error) {
      toast.error('Failed to delete server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKickMember = async (member: ServerMember) => {
    if (!server) return;
    
    try {
      await kickMember(server.id, member.user_id);
      toast.success(`${member.user?.username || 'User'} has been kicked`);
    } catch (error) {
      toast.error('Failed to kick member');
    }
  };

  const handleBanMember = async (member: ServerMember) => {
    if (!server) return;
    
    try {
      await banMember(server.id, member.user_id);
      toast.success(`${member.user?.username || 'User'} has been banned`);
    } catch (error) {
      toast.error('Failed to ban member');
    }
  };

  const handleClose = () => {
    reset();
    setActiveTab('overview');
    closeModal();
  };

  if (!server) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Server Settings</DialogTitle>
            <DialogDescription>
              Manage your server settings and members
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Settings className="w-4 h-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="members" className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Members
              </TabsTrigger>
              <TabsTrigger value="bans" className="flex items-center gap-2">
                <Ban className="w-4 h-4" />
                Bans
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Server Icon */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 cursor-pointer hover:border-primary transition-colors">
                    {server.icon_url ? (
                      <img src={server.icon_url} alt={server.name} className="w-full h-full rounded-2xl object-cover" />
                    ) : (
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Server Icon</p>
                    <p className="text-xs text-muted-foreground">Recommended 512x512</p>
                  </div>
                </div>

                {/* Server Name */}
                <div className="space-y-2">
                  <Label htmlFor="serverName">Server Name</Label>
                  <Input
                    id="serverName"
                    {...register('name')}
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>

              {/* Danger Zone */}
              {isOwner && (
                <div className="border-t border-destructive/20 pt-4 mt-6">
                  <h4 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Deleting this server will permanently remove all channels, messages, and members.
                  </p>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Server
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted-foreground">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-2">
                  {members.map((member) => (
                    <div 
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50"
                    >
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.user?.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: member.user?.banner_color || '#5865F2' }}>
                          {member.user?.username?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {member.nickname || member.user?.display_name || member.user?.username}
                          </span>
                          {getRoleIcon(member.role)}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {member.user?.username} • {getRoleLabel(member.role)}
                        </p>
                      </div>
                      
                      {/* Actions (not for self or higher roles) */}
                      {isAdmin && member.user_id !== user?.id && member.role !== 'owner' && (
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleKickMember(member)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            Kick
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleBanMember(member)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            Ban
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Bans Tab */}
            <TabsContent value="bans" className="mt-4">
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Ban className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">No banned users</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Users you ban will appear here
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{server.name}</strong>? 
              This action cannot be undone. All channels, messages, and members will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteServer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Delete Server
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
