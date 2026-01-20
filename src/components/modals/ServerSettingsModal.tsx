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
  X,
  Palette,
  Plus,
  Edit2,
  KeyRound,
  Smile,
  GripVertical
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
import { useMemberPermissions } from '@/hooks/useMemberPermissions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { invalidateServerEmojis } from '@/lib/serverEmojis';
import type { ServerRole, ServerMember, CustomServerRole } from '@/types';
import { Badge } from '@/components/ui/badge';
import { RolePermissionsEditor } from './RolePermissionsEditor';
import { EmojiGifPicker } from './EmojiGifPicker';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragCancelEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const MAX_ICON_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_ICON_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const MAX_EMOJI_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_EMOJI_TYPES = ['image/png', 'image/gif', 'image/webp', 'image/jpeg'];
const EMOJI_NAME_REGEX = /^[a-z0-9_]{2,32}$/;
const MAX_SERVER_EMOJIS = 30;

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
    roles,
    fetchMembers,
    fetchRoles,
    createRole,
    updateRole,
    deleteRole,
    reorderRoles,
    assignRoleToMember,
    removeRoleFromMember,
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
  const [editingRole, setEditingRole] = useState<CustomServerRole | null>(null);
  const [editingRolePermissions, setEditingRolePermissions] = useState<CustomServerRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#5865F2');
  const [roleIcon, setRoleIcon] = useState<string>('');
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  
  // Icon upload state
  const [iconFile, setIconFile] = useState<File | null>(null);
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Banner upload state
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Custom emoji state (owner-only)
  const [emojiFile, setEmojiFile] = useState<File | null>(null);
  const [emojiPreview, setEmojiPreview] = useState<string | null>(null);
  const [emojiName, setEmojiName] = useState('');
  const [isUploadingEmoji, setIsUploadingEmoji] = useState(false);
  const [serverEmojis, setServerEmojis] = useState<Array<{ id: string; name: string; file_path: string }>>([]);
  const emojiInputRef = useRef<HTMLInputElement>(null);

  const isOpen = activeModal === 'server-settings';
  
  // Get server from modal data or use current server
  const serverId = modalData?.serverId as string | undefined;
  const server = serverId 
    ? servers.find(s => s.id === serverId) || currentServer
    : currentServer;

  const roleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const roleIds = useMemo(() => roles.map((r) => r.id), [roles]);

  const handleRoleDragStart = (event: DragStartEvent) => {
    setActiveRoleId(event.active.id as string);
  };

  const handleRoleDragCancel = (_event: DragCancelEvent) => {
    setActiveRoleId(null);
  };

  const handleRoleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveRoleId(null);
    if (!over) return;
    if (!server?.id || !user?.id) return;
    if (active.id === over.id) return;

    const oldIndex = roles.findIndex((r) => r.id === active.id);
    const newIndex = roles.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(roles, oldIndex, newIndex);
    try {
      await reorderRoles(server.id, user.id, newOrder.map((r) => r.id));
    } catch {
      toast.error("Failed to reorder roles");
    }
  };

  const SortableRoleRow = ({ role }: { role: CustomServerRole }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: role.id,
      data: { type: "role", role },
    });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-lg hover:bg-secondary/50 transition-colors",
          isDragging && "opacity-80 bg-secondary/60 ring-1 ring-primary/30 shadow-md relative z-50",
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: role.color }} />
        <div className="flex-1 min-w-0">
          <span className="text-xs sm:text-sm font-medium">{role.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditingRolePermissions(role)}
            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
            title="Edit Permissions"
          >
            <KeyRound className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEditRole(role)}
            className="text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
            title="Edit Role"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteRole(role)}
            className="text-muted-foreground hover:text-destructive text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
            title="Delete Role"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    );
  };

  // Get current user's role
  const currentMembership = useMemo(() => {
    if (!server) return null;
    return servers.find(s => s.id === server.id);
  }, [servers, server]);

  const userRole = currentMembership?.role;
  // Use permission system instead of hardcoded role checks
  const { hasPermission } = useMemberPermissions();
  const canManageServer = hasPermission('manage_server');
  const canManageRoles = hasPermission('manage_roles');
  const canManageChannels = hasPermission('manage_channels');
  const canManageEmojis = hasPermission('manage_emojis');
  
  // For backward compatibility and specific checks
  const isOwner = userRole === 'owner';
  const isAdmin = canManageServer || canManageRoles || canManageChannels;

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

  // Fetch members and roles when modal opens
  useEffect(() => {
    if (isOpen && server) {
      fetchMembers(server.id);
      fetchRoles(server.id);
      reset({ name: server.name });
      // Reset icon state
      setIconFile(null);
      setIconPreview(null);
      // Reset banner state
      setBannerFile(null);
      setBannerPreview(null);
      // Reset emoji state
      setEmojiFile(null);
      setEmojiName('');
      if (emojiPreview) {
        URL.revokeObjectURL(emojiPreview);
      }
      setEmojiPreview(null);
      setServerEmojis([]);
      // Reset role form
      setEditingRole(null);
      setRoleName('');
      setRoleColor('#5865F2');
      setRoleIcon('');
    }
  }, [isOpen, server, fetchMembers, fetchRoles, reset]);

  // Load server emojis when modal opens
  useEffect(() => {
    if (!isOpen || !server || !canManageEmojis) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('server_emojis')
        .select('id,name,file_path')
        .eq('server_id', server.id)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error('Failed to load server emojis:', error);
        setServerEmojis([]);
        return;
      }
      setServerEmojis((data ?? []) as Array<{ id: string; name: string; file_path: string }>);
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, server?.id, canManageEmojis]);

  const clearEmoji = () => {
    setEmojiFile(null);
    setEmojiName('');
    if (emojiPreview) {
      URL.revokeObjectURL(emojiPreview);
      setEmojiPreview(null);
    }
    if (emojiInputRef.current) {
      emojiInputRef.current.value = '';
    }
  };

  const handleEmojiSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageEmojis) {
      toast.error('You do not have permission to manage emojis');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_EMOJI_TYPES.includes(file.type)) {
      toast.error('Please select a PNG, GIF, WebP, or JPEG image');
      return;
    }

    if (file.size > MAX_EMOJI_SIZE) {
      toast.error('Emoji must be less than 1MB');
      return;
    }

    setEmojiFile(file);
    setEmojiPreview(URL.createObjectURL(file));
  };

  const uploadServerEmoji = async () => {
    if (!server || !user) return;
    if (!canManageEmojis) {
      toast.error('You do not have permission to manage emojis');
      return;
    }
    if (!emojiFile) {
      toast.error('Please select an emoji image');
      return;
    }

    // Enforce 30 emoji cap (also enforced in DB via trigger)
    try {
      const { count, error } = await supabase
        .from('server_emojis')
        .select('*', { count: 'exact', head: true })
        .eq('server_id', server.id);

      if (error) throw error;
      if ((count ?? 0) >= MAX_SERVER_EMOJIS) {
        toast.error(`This server already has ${MAX_SERVER_EMOJIS} custom emojis`);
        return;
      }
    } catch (e) {
      console.error('Failed to check emoji limit:', e);
      // If we can't verify, don't allow upload (safer for team-shared)
      toast.error('Unable to verify emoji limit. Please try again.');
      return;
    }

    const normalized = emojiName.trim().toLowerCase();
    if (!EMOJI_NAME_REGEX.test(normalized)) {
      toast.error('Emoji name must be 2-32 characters (a-z, 0-9, underscore)');
      return;
    }

    setIsUploadingEmoji(true);
    try {
      const ext = (emojiFile.name.split('.').pop() || 'png').toLowerCase();
      const filePath = `${server.id}/${normalized}-${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('server-emojis')
        .upload(filePath, emojiFile, { upsert: false, cacheControl: '3600' });

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('server_emojis').insert({
        server_id: server.id,
        name: normalized,
        file_path: filePath,
        created_by: user.id,
      });

      if (insertError) throw insertError;

      // Refresh list
      const { data, error } = await supabase
        .from('server_emojis')
        .select('id,name,file_path')
        .eq('server_id', server.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setServerEmojis((data ?? []) as Array<{ id: string; name: string; file_path: string }>);
      toast.success('Emoji uploaded');
      invalidateServerEmojis(server.id);
      clearEmoji();
    } catch (err: any) {
      const msg = err?.message || 'Failed to upload emoji';
      if (msg.includes('server_emojis_server_id_name_key')) {
        toast.error('That emoji name is already taken');
      } else if (msg.toLowerCase().includes('server emoji limit reached')) {
        toast.error(`This server already has ${MAX_SERVER_EMOJIS} custom emojis`);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsUploadingEmoji(false);
    }
  };

  const deleteServerEmoji = async (emoji: { id: string; name: string; file_path: string }) => {
    if (!server) return;
    if (!canManageEmojis) {
      toast.error('You do not have permission to manage emojis');
      return;
    }
    if (!confirm(`Delete emoji "${emoji.name}"?`)) return;

    try {
      await supabase.from('server_emojis').delete().eq('id', emoji.id);
      await supabase.storage.from('server-emojis').remove([emoji.file_path]);

      setServerEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
      invalidateServerEmojis(server.id);
      toast.success('Emoji deleted');
    } catch (error) {
      console.error('Failed to delete emoji:', error);
      toast.error('Failed to delete emoji');
    }
  };

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

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const clearBanner = () => {
    setBannerFile(null);
    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview);
      setBannerPreview(null);
    }
    if (bannerInputRef.current) {
      bannerInputRef.current.value = '';
    }
  };

  const uploadBanner = async (serverId: string, file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop() || 'png';
    const filePath = `${serverId}/banner.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('server-icons')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Failed to upload banner:', uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('server-icons')
      .getPublicUrl(filePath);

    // Add cache buster to force refresh
    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleRemoveBanner = async () => {
    if (!server || !user) return;
    
    setIsUploadingBanner(true);
    try {
      await updateServer(server.id, user.id, { banner_url: null });
      toast.success('Server banner removed');
    } catch (error) {
      toast.error('Failed to remove banner');
    } finally {
      setIsUploadingBanner(false);
    }
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
      let bannerUrl = server.banner_url;
      
      // Upload new icon if selected
      if (iconFile) {
        setIsUploadingIcon(true);
        const uploadedUrl = await uploadIcon(server.id, iconFile);
        if (uploadedUrl) {
          iconUrl = uploadedUrl;
        }
        setIsUploadingIcon(false);
      }
      
      // Upload new banner if selected
      if (bannerFile) {
        setIsUploadingBanner(true);
        const uploadedUrl = await uploadBanner(server.id, bannerFile);
        if (uploadedUrl) {
          bannerUrl = uploadedUrl;
        }
        setIsUploadingBanner(false);
      }
      
      await updateServer(server.id, user.id, { 
        name: data.name,
        icon_url: iconUrl,
        banner_url: bannerUrl
      });
      
      toast.success('Server settings updated!');
      clearIcon();
      clearBanner();
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
    clearBanner();
    setEditingRole(null);
    setRoleName('');
    setRoleColor('#5865F2');
    setRoleIcon('');
    closeModal();
  };

  const handleCreateRole = async () => {
    if (!server || !user || !roleName.trim()) return;
    
    try {
      await createRole(server.id, user.id, roleName.trim(), roleColor, roleIcon.trim() ? roleIcon.trim() : null);
      // Refetch roles to ensure UI is up to date
      await fetchRoles(server.id);
      toast.success('Role created');
      setRoleName('');
      setRoleColor('#5865F2');
      setRoleIcon('');
    } catch (error: any) {
      console.error('Failed to create role:', error);
      const errorMessage = error?.message || 'Failed to create role';
      if (errorMessage.includes('migration')) {
        toast.error('Database migration required. Please apply the migration file first.', {
          duration: 10000,
        });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleUpdateRole = async () => {
    if (!server || !user || !editingRole || !roleName.trim()) return;
    
    try {
      await updateRole(editingRole.id, user.id, { name: roleName.trim(), color: roleColor, icon: roleIcon.trim() ? roleIcon.trim() : null });
      // Refetch roles to ensure UI is up to date
      await fetchRoles(server.id);
      toast.success('Role updated');
      setEditingRole(null);
      setRoleName('');
      setRoleColor('#5865F2');
      setRoleIcon('');
    } catch (error) {
      console.error('Failed to update role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDeleteRole = async (role: CustomServerRole) => {
    if (!server || !user) return;
    
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) return;
    
    try {
      await deleteRole(role.id, user.id);
      // Refetch roles to ensure UI is up to date
      await fetchRoles(server.id);
      toast.success('Role deleted');
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error('Failed to delete role');
    }
  };

  const handleEditRole = (role: CustomServerRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleColor(role.color);
    setRoleIcon(role.icon || '');
  };

  const handleAssignRole = async (member: ServerMember, role: CustomServerRole) => {
    if (!server || !user) return;
    
    try {
      await assignRoleToMember(member.id, role.id, user.id);
      toast.success(`Role "${role.name}" assigned`);
    } catch (error) {
      toast.error('Failed to assign role');
    }
  };

  const handleRemoveRole = async (member: ServerMember, role: CustomServerRole) => {
    if (!server || !user) return;
    
    try {
      await removeRoleFromMember(member.id, role.id, user.id);
      toast.success(`Role "${role.name}" removed`);
    } catch (error) {
      toast.error('Failed to remove role');
    }
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
  // Determine which banner to show
  const displayBannerUrl = bannerPreview || server.banner_url;

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleIconSelect}
        className="hidden"
      />
      <input
        ref={bannerInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleBannerSelect}
        className="hidden"
      />
      <input
        ref={emojiInputRef}
        type="file"
        accept="image/png,image/gif,image/webp,image/jpeg"
        onChange={handleEmojiSelect}
        className="hidden"
      />

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-5xl max-w-[calc(100vw-2rem)] max-h-[90vh] sm:max-h-[85vh] p-0 flex flex-col">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-base sm:text-lg">Server Settings</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Manage your server settings and members
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex overflow-hidden">
            <TabsList className="flex flex-col items-start justify-start h-full w-48 sm:w-56 border-r border-border bg-secondary/30 p-2 gap-1 rounded-none inline-flex">
              <TabsTrigger 
                value="overview" 
                className="w-full justify-start gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Settings className="w-4 h-4" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="members" 
                className="w-full justify-start gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Users className="w-4 h-4" />
                <span>Members</span>
              </TabsTrigger>
              <TabsTrigger 
                value="roles" 
                className="w-full justify-start gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Palette className="w-4 h-4" />
                <span>Roles</span>
              </TabsTrigger>
              <TabsTrigger 
                value="bans" 
                className="w-full justify-start gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Ban className="w-4 h-4" />
                <span>Bans</span>
              </TabsTrigger>
              {canManageEmojis && (
                <TabsTrigger
                  value="emojis"
                  className="w-full justify-start gap-2 text-xs sm:text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <Smile className="w-4 h-4" />
                  <span>Emojis</span>
                </TabsTrigger>
              )}
            </TabsList>
            
            <div className="flex-1 overflow-y-auto">

              {/* Overview Tab */}
              <TabsContent value="overview" className="m-0 p-6">
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
                {/* Server Icon */}
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="relative">
                    <div 
                      onClick={() => canManageServer && fileInputRef.current?.click()}
                      className={cn(
                        "w-14 h-14 sm:w-20 sm:h-20 rounded-xl sm:rounded-2xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 transition-colors flex-shrink-0 overflow-hidden",
                        canManageServer && "cursor-pointer hover:border-primary"
                      )}
                    >
                      {displayIconUrl ? (
                        <img src={displayIconUrl} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                      )}
                    </div>
                    {/* Remove icon button - show for new preview OR existing server icon */}
                    {canManageServer && displayIconUrl && (
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
                      {canManageServer ? 'Click to upload • Recommended 512x512' : 'Recommended 512x512'}
                    </p>
                  </div>
                </div>

                {/* Server Banner */}
                <div className="space-y-1.5 sm:space-y-2">
                  <Label className="text-xs sm:text-sm">Server Banner</Label>
                  <div className="relative">
                    <div 
                      onClick={() => canManageServer && bannerInputRef.current?.click()}
                      className={cn(
                        "w-full h-24 sm:h-32 rounded-lg sm:rounded-xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 transition-colors overflow-hidden",
                        canManageServer && "cursor-pointer hover:border-primary"
                      )}
                    >
                      {displayBannerUrl ? (
                        <img src={displayBannerUrl} alt="Server banner" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                          <span className="text-[10px] sm:text-xs">Click to upload banner</span>
                        </div>
                      )}
                    </div>
                    {/* Remove banner button */}
                    {canManageServer && displayBannerUrl && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (bannerPreview) {
                            clearBanner();
                          } else {
                            handleRemoveBanner();
                          }
                        }}
                        disabled={isUploadingBanner}
                        className="absolute top-2 right-2 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                      >
                        <X className="w-3 h-3 sm:w-4 sm:h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {canManageServer ? 'Recommended 960x540 • Shown in server list' : 'Shown in server list'}
                  </p>
                </div>

                {/* Server Name */}
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="serverName" className="text-xs sm:text-sm">Server Name</Label>
                  <Input
                    id="serverName"
                    {...register('name')}
                    className={cn("h-9 sm:h-10 text-sm", errors.name ? 'border-destructive' : '')}
                    disabled={!canManageServer}
                  />
                  {errors.name && (
                    <p className="text-[10px] sm:text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                {isAdmin && (
                  <DialogFooter className="pt-2 sm:pt-4">
                    <Button type="submit" disabled={isLoading || isUploadingIcon || isUploadingBanner} size="sm" className="w-full sm:w-auto">
                      {(isLoading || isUploadingIcon || isUploadingBanner) && <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 animate-spin" />}
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
              <TabsContent value="members" className="m-0 p-6">
                <div className="flex items-center justify-between mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ScrollArea className="h-[400px] sm:h-[500px] pr-2 sm:pr-4">
                <div className="space-y-1.5 sm:space-y-2">
                  {members.map((member) => {
                    const memberRoles = member.roles || [];
                    const hasRoles = memberRoles.length > 0;
                    
                    return (
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
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <span className="text-xs sm:text-sm font-medium truncate">
                              {member.nickname || member.user?.display_name || member.user?.username}
                            </span>
                            {getRoleIcon(member.role)}
                            {hasRoles && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {memberRoles.map((role) => (
                                  <Badge
                                    key={role.id}
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 h-4 font-medium border-0"
                                    style={{ backgroundColor: role.color + '20', color: role.color }}
                                  >
                                    {role.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                            {member.user?.username} • {getRoleLabel(member.role)}
                          </p>
                        </div>
                        
                        {/* Actions (not for self or higher roles) */}
                        {canManageRoles && member.user_id !== user?.id && member.role !== 'owner' && (
                          <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                            {roles.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                                  >
                                    Roles
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {roles.map((role) => {
                                    const hasRole = memberRoles.some(r => r.id === role.id);
                                    return (
                                      <DropdownMenuItem
                                        key={role.id}
                                        onClick={() => hasRole 
                                          ? handleRemoveRole(member, role)
                                          : handleAssignRole(member, role)
                                        }
                                      >
                                        <div className="flex items-center gap-2 w-full">
                                          <div 
                                            className="w-3 h-3 rounded-full flex-shrink-0"
                                            style={{ backgroundColor: role.color }}
                                          />
                                          <span className="flex-1">{role.name}</span>
                                          {hasRole && <span className="text-xs text-muted-foreground">✓</span>}
                                        </div>
                                      </DropdownMenuItem>
                                    );
                                  })}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
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
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>

              {/* Roles Tab */}
              <TabsContent value="roles" className="m-0 p-6">
                {canManageRoles ? (
                  <div className="space-y-5">
                    {/* Create/Edit Role Form */}
                    <div className="space-y-4 p-4 border rounded-lg bg-secondary/50">
                    <h4 className="text-xs sm:text-sm font-semibold">
                      {editingRole ? 'Edit Role' : 'Create Role'}
                    </h4>
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Role Name & Color</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="roleName"
                          value={roleName}
                          onChange={(e) => setRoleName(e.target.value)}
                          placeholder="Enter role name"
                          className="h-9 sm:h-10 text-sm flex-1"
                          maxLength={100}
                        />
                        <div className="relative flex items-center gap-2">
                          {/* Circular color picker button */}
                          <label
                            htmlFor="roleColor"
                            className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 border-border cursor-pointer overflow-hidden flex-shrink-0 hover:border-primary transition-colors"
                            style={{ backgroundColor: roleColor }}
                          >
                            <input
                              type="color"
                              id="roleColor"
                              value={roleColor}
                              onChange={(e) => setRoleColor(e.target.value)}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                          </label>
                          <Input
                            value={roleColor}
                            onChange={(e) => setRoleColor(e.target.value)}
                            placeholder="#5865F2"
                            className="h-9 sm:h-10 text-sm w-20 sm:w-24"
                            maxLength={7}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Role Icon (optional)</Label>
                      <div className="flex items-center gap-2">
                        <EmojiGifPicker
                          disableGif
                          serverId={server.id}
                          serverName={server.name}
                          open={undefined}
                          onOpenChange={undefined}
                          onEmojiSelect={(emoji) => setRoleIcon(emoji)}
                        >
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 sm:h-10 px-3 flex items-center gap-2"
                          >
                            <Smile className="w-4 h-4" />
                            <span className="text-xs sm:text-sm">
                              {roleIcon ? 'Change' : 'Select'}
                            </span>
                          </Button>
                        </EmojiGifPicker>
                        <div className="flex-1 min-w-0">
                          {roleIcon ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-emoji leading-none">{roleIcon}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7"
                                onClick={() => setRoleIcon('')}
                                title="Clear role icon"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                              Emoji or existing server emoji (e.g. <span className="font-mono">:cat:</span>)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={editingRole ? handleUpdateRole : handleCreateRole}
                        disabled={!roleName.trim()}
                        size="sm"
                        className="flex-1"
                      >
                        {editingRole ? (
                          <>
                            <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                            Update Role
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                            Create Role
                          </>
                        )}
                      </Button>
                      {editingRole && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingRole(null);
                            setRoleName('');
                            setRoleColor('#5865F2');
                            setRoleIcon('');
                          }}
                          size="sm"
                        >
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Roles List */}
                  <div className="space-y-2">
                    <h4 className="text-xs sm:text-sm font-semibold">Server Roles</h4>
                    {roles.length > 0 ? (
                      <ScrollArea className="h-[400px] sm:h-[500px] pr-2 sm:pr-4">
                        <DndContext
                          sensors={roleSensors}
                          collisionDetection={closestCenter}
                          onDragStart={handleRoleDragStart}
                          onDragEnd={handleRoleDragEnd}
                          onDragCancel={handleRoleDragCancel}
                        >
                          <SortableContext items={roleIds} strategy={verticalListSortingStrategy}>
                            <div className="space-y-1.5 sm:space-y-2">
                              {roles.map((role) => (
                                <SortableRoleRow key={role.id} role={role} />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </ScrollArea>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                        <Palette className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/50 mb-2 sm:mb-3" />
                        <p className="text-xs sm:text-sm text-muted-foreground">No roles created</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                          Create roles to organize your server members
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                    <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/50 mb-2 sm:mb-3" />
                    <p className="text-xs sm:text-sm text-muted-foreground">Only admins can manage roles</p>
                  </div>
                )}
              </TabsContent>

              {/* Bans Tab */}
              <TabsContent value="bans" className="m-0 p-6">
                {members.filter(m => m.is_banned).length > 0 ? (
                  <ScrollArea className="h-[400px] sm:h-[500px] pr-2 sm:pr-4">
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
                        {canManageRoles && (
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

              {/* Emojis Tab */}
              <TabsContent value="emojis" className="m-0 p-6">
                {canManageEmojis ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <h4 className="text-xs sm:text-sm font-semibold">Custom Emojis</h4>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">
                        Upload an emoji and set a name (2-32 chars: a-z, 0-9, underscore). Use it in chat as <span className="font-mono">:name:</span>
                      </p>
                    </div>

                    {/* Upload row */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end p-4 border rounded-lg bg-secondary/50">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => emojiInputRef.current?.click()}
                          className={cn(
                            "w-14 h-14 rounded-xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 transition-colors flex-shrink-0 overflow-hidden cursor-pointer hover:border-primary"
                          )}
                        >
                          {emojiPreview ? (
                            <img src={emojiPreview} alt="Emoji preview" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-medium">Emoji Image</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">PNG/GIF/WebP/JPEG • Max 1MB</p>
                        </div>
                      </div>

                      <div className="flex-1 space-y-2">
                        <Label className="text-xs sm:text-sm" htmlFor="emojiName">Emoji Name</Label>
                        <Input
                          id="emojiName"
                          value={emojiName}
                          onChange={(e) => setEmojiName(e.target.value)}
                          placeholder="e.g. cat"
                          className="h-9 sm:h-10 text-sm"
                          maxLength={32}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={uploadServerEmoji}
                          disabled={isUploadingEmoji || !emojiFile || !emojiName.trim()}
                          className="flex-1 sm:flex-none"
                        >
                          {isUploadingEmoji && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Upload
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={clearEmoji}
                          disabled={isUploadingEmoji && !!emojiFile}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    {/* Emoji list */}
                    <div className="space-y-2">
                      <h4 className="text-xs sm:text-sm font-semibold">Server Emojis</h4>
                      {serverEmojis.length > 0 ? (
                        <ScrollArea className="h-[420px] sm:h-[520px] pr-2 sm:pr-4">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                            {serverEmojis.map((emoji) => {
                              const { data: urlData } = supabase.storage
                                .from('server-emojis')
                                .getPublicUrl(emoji.file_path);
                              const url = urlData.publicUrl;

                              return (
                                <div
                                  key={emoji.id}
                                  className="flex items-center gap-3 p-2 rounded-lg border bg-background/40"
                                >
                                  <img
                                    src={url}
                                    alt={emoji.name}
                                    className="w-10 h-10 rounded-md object-cover bg-secondary"
                                    loading="lazy"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs sm:text-sm font-medium truncate">:{emoji.name}:</div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground truncate">{emoji.name}</div>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteServerEmoji(emoji)}
                                    className="text-muted-foreground hover:text-destructive h-8 px-2"
                                    title="Delete emoji"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Smile className="w-12 h-12 text-muted-foreground/50 mb-3" />
                          <p className="text-xs sm:text-sm text-muted-foreground">No custom emojis yet</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                            Upload your first emoji above
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                    <Shield className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground/50 mb-2 sm:mb-3" />
                    <p className="text-xs sm:text-sm text-muted-foreground">You do not have permission to manage emojis</p>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Role Permissions Editor */}
      {editingRolePermissions && server && (
        <Dialog open={!!editingRolePermissions} onOpenChange={(open) => !open && setEditingRolePermissions(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh]">
            <RolePermissionsEditor
              role={editingRolePermissions}
              serverId={server.id}
              onClose={() => setEditingRolePermissions(null)}
            />
          </DialogContent>
        </Dialog>
      )}

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