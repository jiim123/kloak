import { useState, useEffect, useMemo, useRef } from 'react';
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
  User,
  X
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
import { useRealtimeMembers } from '@/hooks';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ServerRole, ServerMember } from '@/types';

const MAX_ICON_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_ICON_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

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
    updateServer,
    deleteServer,
    kickMember,
    banMember,
    updateMember
  } = useServerStore();
  const { user } = useAuthStore();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Icon upload state
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Real-time members updates
  useRealtimeMembers(isOpen && server ? server.id : null);

  // Fetch members when modal opens
  useEffect(() => {
    if (isOpen && server) {
      fetchMembers(server.id);
      reset({ name: server.name });
      // Reset icon state
      setIconFile(null);
      setIconPreview(null);
    }
  }, [isOpen, server, fetchMembers, reset]);

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

    // Add cache buster to force refresh
    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleRemoveIcon = async () => {
    if (!server || !user) return;
    
    setIsUploadingIcon(true);
    try {
      await updateServer(server.id, user.id, { icon_url: null });
      toast.success('Server icon removed');
    } catch (error) {
      toast.error('Failed to remove icon');
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const onSubmit = async (data: ServerSettingsForm) => {
    if (!server || !user) return;
    
    setIsLoading(true);
    try {
      let iconUrl = server.icon_url;
      
      // Upload new icon if selected
      if (iconFile) {
        setIsUploadingIcon(true);
        const uploadedUrl = await uploadIcon(server.id, iconFile);
        if (uploadedUrl) {
          iconUrl = uploadedUrl;
        }
        setIsUploadingIcon(false);
      }
      
      await updateServer(server.id, user.id, { 
        name: data.name,
        icon_url: iconUrl 
      });
      
      toast.success('Server settings updated!');
      clearIcon();
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
    clearIcon();
    closeModal();
  };

  if (!server) {
    return (
      <Dialog open={false}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Server Settings</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  // Determine which icon to show
  const displayIconUrl = iconPreview || server.icon_url;

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleIconSelect}
        className="hidden"
      />

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] max-h-[90vh] sm:max-h-[80vh] p-4 sm:p-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-base sm:text-lg">Server Settings</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Manage your server settings and members
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-9 sm:h-10">
              <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Overview</span>
                <span className="xs:hidden">Info</span>
              </TabsTrigger>
              <TabsTrigger value="members" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Members</span>
              </TabsTrigger>
              <TabsTrigger value="bans" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3">
                <Ban className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Bans</span>
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
                {/* Server Icon */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative">
                    <div 
                      onClick={() => isAdmin && fileInputRef.current?.click()}
                      className={cn(
                        "w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 transition-colors flex-shrink-0 overflow-hidden",
                        isAdmin && "cursor-pointer hover:border-primary"
                      )}
                    >
                      {displayIconUrl ? (
                        <img src={displayIconUrl} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                      )}
                    </div>
                    {/* Remove icon button - show for new preview OR existing server icon */}
                    {isAdmin && displayIconUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (iconPreview) {
                            clearIcon();
                          } else {
                            handleRemoveIcon();
                          }
                        }}
                        disabled={isUploadingIcon}
                        className="absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                      >
                        <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      </button>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium">Server Icon</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      {isAdmin ? 'Click to upload • Recommended 512x512' : 'Recommended 512x512'}
                    </p>
                  </div>
                </div>

                {/* Server Name */}
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="serverName" className="text-xs sm:text-sm">Server Name</Label>
                  <Input
                    id="serverName"
                    {...register('name')}
                    className={cn("h-9 sm:h-10 text-sm", errors.name ? 'border-destructive' : '')}
                    disabled={!isAdmin}
                  />
                  {errors.name && (
                    <p className="text-[10px] sm:text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                {isAdmin && (
                  <DialogFooter className="pt-2 sm:pt-4">
                    <Button type="submit" disabled={isLoading || isUploadingIcon} size="sm" className="w-full sm:w-auto">
                      {(isLoading || isUploadingIcon) && <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </DialogFooter>
                )}
              </form>

              {/* Danger Zone */}
              {isOwner && (
                <div className="border-t border-destructive/20 pt-3 sm:pt-4 mt-4 sm:mt-6">
                  <h4 className="text-xs sm:text-sm font-semibold text-destructive mb-1.5 sm:mb-2">Danger Zone</h4>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mb-2 sm:mb-3">
                    Deleting this server will permanently remove all channels, messages, and members.
                  </p>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-xs sm:text-sm h-8 sm:h-9"
                  >
                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                    Delete Server
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="mt-3 sm:mt-4">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ScrollArea className="h-[200px] sm:h-[300px] pr-2 sm:pr-4">
                <div className="space-y-1.5 sm:space-y-2">
                  {members.map((member) => (
                    <div 
                      key={member.id}
                      className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50"
                    >
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                        <AvatarImage src={member.user?.avatar_url || undefined} />
                        <AvatarFallback style={{ backgroundColor: member.user?.banner_color || '#5865F2' }}>
                          {member.user?.username?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-xs sm:text-sm font-medium truncate">
                            {member.nickname || member.user?.display_name || member.user?.username}
                          </span>
                          {getRoleIcon(member.role)}
                        </div>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                          {member.user?.username} • {getRoleLabel(member.role)}
                        </p>
                      </div>
                      
                      {/* Actions (not for self or higher roles) */}
                      {isAdmin && member.user_id !== user?.id && member.role !== 'owner' && (
                        <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleKickMember(member)}
                            className="text-muted-foreground hover:text-destructive text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                          >
                            Kick
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleBanMember(member)}
                            className="text-muted-foreground hover:text-destructive text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
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
            <TabsContent value="bans" className="mt-3 sm:mt-4">
              {members.filter(m => m.is_banned).length > 0 ? (
                <ScrollArea className="h-[200px] sm:h-[300px] pr-2 sm:pr-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    {members.filter(m => m.is_banned).map((member) => (
                      <div 
                        key={member.id}
                        className="flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50"
                      >
                        <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                          <AvatarImage src={member.user?.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: member.user?.banner_color || '#5865F2' }}>
                            {member.user?.username?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-xs sm:text-sm font-medium truncate">
                            {member.user?.username}
                          </span>
                        </div>
                        {isAdmin && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              try {
                                await updateMember(member.id, { is_banned: false });
                                toast.success(`${member.user?.username} has been unbanned`);
                              } catch {
                                toast.error('Failed to unban');
                              }
                            }}
                            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 flex-shrink-0"
                          >
                            Unban
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                  <Ban className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/50 mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm text-muted-foreground">No banned users</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                    Users you ban will appear here
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base sm:text-lg">Delete Server</AlertDialogTitle>
            <AlertDialogDescription className="text-xs sm:text-sm">
              Are you sure you want to delete <strong>{server.name}</strong>? 
              This action cannot be undone. All channels, messages, and members will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteServer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
              )}
              Delete Server
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};