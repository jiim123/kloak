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
  Link2,
  Copy,
  Check,
  Smile,
  GripVertical,
  ArrowLeft
} from 'lucide-react';

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
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Checkbox } from '@/components/ui/checkbox';
import { RolePermissionsEditor } from '../modals/RolePermissionsEditor';
import { EmojiGifPicker } from '../modals/EmojiGifPicker';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MAX_ICON_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_ICON_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BANNER_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_BANNER_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const MAX_EMOJI_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_EMOJI_TYPES = ['image/png', 'image/gif', 'image/webp', 'image/jpeg'];
const EMOJI_NAME_REGEX = /^[a-z0-9_]{2,32}$/;
const MAX_SERVER_EMOJIS = 30;

const serverSettingsSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Server name is required')
    .max(100, 'Server name must be less than 100 characters'),
  about: z.string()
    .trim()
    .max(500, 'About server must be less than 500 characters')
    .optional()
    .nullable(),
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

// Gradient presets
const gradientPresets = [
  { name: 'Ocean', colors: ['#667eea', '#764ba2'], angle: 135 },
  { name: 'Sunset', colors: ['#ff6b6b', '#feca57'], angle: 135 },
  { name: 'Forest', colors: ['#11998e', '#38ef7d'], angle: 135 },
  { name: 'Fire', colors: ['#f12711', '#f5af19'], angle: 135 },
  { name: 'Purple Dream', colors: ['#c471f5', '#fa71cd'], angle: 135 },
  { name: 'Cool Blues', colors: ['#2193b0', '#6dd5ed'], angle: 135 },
  { name: 'Peach', colors: ['#ed4264', '#ffedbc'], angle: 135 },
  { name: 'Mint', colors: ['#00b4db', '#0083b0'], angle: 135 },
  { name: 'Cosmic', colors: ['#4e54c8', '#8f94fb'], angle: 135 },
  { name: 'Rose', colors: ['#f093fb', '#f5576c'], angle: 135 },
  { name: 'Rainbow', colors: ['#ff0080', '#ff8c00', '#40e0d0'], angle: 90 },
  { name: 'Neon', colors: ['#00f260', '#0575e6'], angle: 135 },
  { name: 'Lavender', colors: ['#834d9b', '#d04ed6'], angle: 135 },
  { name: 'Cyber', colors: ['#08aeea', '#2af598'], angle: 135 },
  { name: 'Aurora', colors: ['#a8edea', '#fed6e3'], angle: 135 },
  { name: 'Sunset Wave', colors: ['#ff9a56', '#ff6a88', '#ffd364'], angle: 120 },
  { name: 'Deep Space', colors: ['#000428', '#004e92'], angle: 135 },
  { name: 'Candy', colors: ['#fc6c8f', '#ffb88c', '#ffd98a'], angle: 90 },
  { name: 'Electric', colors: ['#8e2de2', '#4a00e0'], angle: 135 },
  { name: 'Tropical', colors: ['#f2994a', '#f2c94c'], angle: 135 },
];

const createGradientString = (colors: string[], angle: number = 135) => {
  return `linear-gradient(${angle}deg, ${colors.join(', ')})`;
};

const parseColorValue = (colorValue: string): { type: 'solid' | 'gradient'; color?: string; colors?: string[]; angle?: number } => {
  if (colorValue.startsWith('linear-gradient')) {
    // Parse gradient string
    const match = colorValue.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);
    if (match) {
      const angle = parseInt(match[1]);
      const colors = match[2].split(',').map(c => c.trim());
      return { type: 'gradient', colors, angle };
    }
  }
  return { type: 'solid', color: colorValue };
};

export const ServerSettingsPage = () => {
  const { closeServerSettings, isServerSettingsOpen } = useUIStore();
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
  const [pendingIsPublished, setPendingIsPublished] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [invites, setInvites] = useState<
    Array<{
      id: string;
      code: string;
      created_at: string;
      created_by_username: string;
      expires_at?: string | null;
      max_uses?: number | null;
      uses_count?: number;
      revoked_at: string | null;
      revoked_by_username: string | null;
    }>
  >([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [inviteExpiresIn, setInviteExpiresIn] = useState<string>('never');
  const [inviteMaxUses, setInviteMaxUses] = useState<string>('unlimited');
  const [editingRole, setEditingRole] = useState<CustomServerRole | null>(null);
  const [editingRolePermissions, setEditingRolePermissions] = useState<CustomServerRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleColor, setRoleColor] = useState('#5865F2');
  const [roleIcon, setRoleIcon] = useState<string>('');
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<CustomServerRole | null>(null);
  const [colorType, setColorType] = useState<'solid' | 'gradient'>('solid');
  const [gradientColors, setGradientColors] = useState<string[]>(['#5865F2', '#7289DA']);
  const [gradientAngle, setGradientAngle] = useState(135);
  
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

  // Banned members state (separate from `members`, which intentionally excludes banned)
  const [bannedMembers, setBannedMembers] = useState<
    Array<{
      id: string;
      user_id: string;
      joined_at?: string | null;
      user: { id: string; username: string; display_name?: string | null; avatar_url?: string | null; banner_color?: string };
    }>
  >([]);
  
  const server = currentServer;

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

    const isSelected = selectedRole?.id === role.id;
    const isGradient = role.color.startsWith('linear-gradient');
    const roleNameStyle = isGradient
      ? ({
          background: role.color,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        } as React.CSSProperties)
      : ({ color: role.color } as React.CSSProperties);

    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={() => {
          setSelectedRole(role);
          setEditingRole(role);
          setRoleName(role.name);
          const parsed = parseColorValue(role.color);
          if (parsed.type === 'gradient') {
            setColorType('gradient');
            setGradientColors(parsed.colors || ['#5865F2', '#7289DA']);
            setGradientAngle(parsed.angle || 135);
          } else {
            setColorType('solid');
            setRoleColor(parsed.color || '#5865F2');
          }
          setRoleIcon(role.icon || '');
        }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer",
          isDragging && "opacity-80 bg-secondary/60 ring-1 ring-primary/30 shadow-md relative z-50",
          isSelected && "bg-secondary/70 ring-1 ring-primary/50"
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={cn("text-sm font-medium truncate", isGradient && "text-transparent")}
            style={roleNameStyle}
          >
            {role.name}
          </span>
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
  const canManageInvites = hasPermission('manage_invites');
  const canManageEmojis = hasPermission('manage_emojis');
  
  // For backward compatibility and specific checks
  const isOwner = userRole === 'owner';
  const isAdmin = canManageServer || canManageRoles || canManageChannels;

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    reset,
  } = useForm<ServerSettingsForm>({
    resolver: zodResolver(serverSettingsSchema),
    defaultValues: { name: server?.name || '', about: server?.about || '' },
  });

  // Real-time members updates
  useRealtimeMembers(server ? server.id : null);

  // Load + subscribe to banned members for the Bans tab
  useEffect(() => {
    if (!isServerSettingsOpen) return;
    if (!server?.id || !user?.id) return;

    let cancelled = false;

    const loadBannedMembers = async () => {
      try {
        const { data, error } = await supabase.rpc('get_banned_members', {
          _server_id: server.id,
          _user_id: user.id,
        });

        if (cancelled) return;
        if (error) throw error;

        let rows: any[] = [];
        if (!data) {
          rows = [];
        } else if (typeof data === 'string') {
          rows = JSON.parse(data);
        } else if (Array.isArray(data)) {
          rows = data;
        } else {
          rows = [];
        }

        setBannedMembers(rows as any);
      } catch {
        // If the viewer lacks permission, just show empty list (no toast spam).
        if (!cancelled) setBannedMembers([]);
      }
    };

    // Initial load
    loadBannedMembers();

    // Realtime updates for bans/unbans (server_members is_banned flips, inserts, deletes)
    const channel = supabase
      .channel(`bans:${server.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'server_members', filter: `server_id=eq.${server.id}` },
        () => {
          loadBannedMembers();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [isServerSettingsOpen, server?.id, user?.id]);

  // Track the server ID when settings open to detect server switches
  const initialServerIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (isServerSettingsOpen && currentServer) {
      if (initialServerIdRef.current === null) {
        // First time opening settings - store the server ID
        initialServerIdRef.current = currentServer.id;
      } else if (initialServerIdRef.current !== currentServer.id) {
        // Server changed while settings are open - close settings
        closeServerSettings();
        initialServerIdRef.current = null;
      }
    } else if (!isServerSettingsOpen) {
      // Settings closed - reset the tracked server ID
      initialServerIdRef.current = null;
    }
  }, [currentServer, isServerSettingsOpen, closeServerSettings]);

  // Fetch members and roles when page opens
  useEffect(() => {
    if (server) {
      fetchMembers(server.id);
      fetchRoles(server.id);
      reset({ name: server.name, about: server.about || '' });
      setPendingIsPublished(!!server.is_published);

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
      setSelectedRole(null);
      setColorType('solid');
      setGradientColors(['#5865F2', '#7289DA']);
      setGradientAngle(135);
    }
  }, [server, fetchMembers, fetchRoles, reset]);

  const loadInvites = async () => {
    if (!server?.id || !user?.id) return;
    if (!canManageInvites) return;

    setIsLoadingInvites(true);
    try {
      const { data, error } = await supabase.rpc('list_server_invites', {
        _server_id: server.id,
        _user_id: user.id,
      });

      if (error) throw error;
      setInvites((data ?? []) as any);
    } catch {
      setInvites([]);
    } finally {
      setIsLoadingInvites(false);
    }
  };

  useEffect(() => {
    if (!isServerSettingsOpen) return;
    if (!server?.id || !user?.id) return;
    if (!canManageInvites) return;

    let cancelled = false;

    (async () => {
      setIsLoadingInvites(true);
      try {
        const { data, error } = await supabase.rpc('list_server_invites', {
          _server_id: server.id,
          _user_id: user.id,
        });

        if (error) throw error;
        if (cancelled) return;
        setInvites((data ?? []) as any);
      } catch {
        if (!cancelled) setInvites([]);
      } finally {
        if (!cancelled) setIsLoadingInvites(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isServerSettingsOpen, server?.id, user?.id, canManageInvites]);

  const createInvite = async () => {
    if (!server?.id || !user?.id) return;
    if (!canManageInvites) return;

    const expiresInSeconds =
      inviteExpiresIn === 'never'
        ? null
        : inviteExpiresIn === '30m'
          ? 30 * 60
          : inviteExpiresIn === '1h'
            ? 60 * 60
            : inviteExpiresIn === '6h'
              ? 6 * 60 * 60
              : inviteExpiresIn === '12h'
                ? 12 * 60 * 60
                : inviteExpiresIn === '1d'
                  ? 24 * 60 * 60
                  : 7 * 24 * 60 * 60;

    const maxUsesValue = inviteMaxUses === 'unlimited' ? null : parseInt(inviteMaxUses, 10);

    setIsCreatingInvite(true);
    try {
      const { error } = await supabase.rpc('create_server_invite', {
        _server_id: server.id,
        _user_id: user.id,
        _expires_in_seconds: expiresInSeconds,
        _max_uses: maxUsesValue,
      });

      if (error) throw error;

      await loadInvites();
      toast.success('Invite created');
    } catch {
      toast.error('Failed to create invite');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!server?.id || !user?.id) return;
    if (!canManageInvites) return;
    if (!confirm('Revoke this invite?')) return;

    try {
      const { error } = await supabase.rpc('revoke_server_invite', {
        _invite_id: inviteId,
        _user_id: user.id,
      });

      if (error) throw error;

      await loadInvites();
      toast.success('Invite revoked');
    } catch {
      toast.error('Failed to revoke invite');
    }
  };

  const copyInviteLink = async (code: string, inviteId: string) => {
    const link = `${window.location.origin}/invite/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInviteId(inviteId);
      setTimeout(() => setCopiedInviteId(null), 2000);
      toast.success('Invite link copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

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

    if (!ALLOWED_BANNER_TYPES.includes(file.type)) {
      toast.error('Please select a JPEG, PNG, WebP, or GIF image');
      return;
    }

    if (file.size > MAX_BANNER_SIZE) {
      toast.error('Image must be less than 8MB');
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
      
      const aboutValue = (data.about || '').trim();

      // Publishing prerequisites: require icon, banner, and description
      let publishToSend = pendingIsPublished;
      if (isOwner && pendingIsPublished) {
        const hasIcon = !!iconUrl;
        const hasBanner = !!bannerUrl;
        const hasAbout = !!aboutValue;

        if (!hasIcon || !hasBanner || !hasAbout) {
          publishToSend = false;
          setPendingIsPublished(false);
          toast.error('Add a server icon, banner, and description before making this server public.');
        }
      }

      await updateServer(server.id, user.id, { 
        name: data.name,
        icon_url: iconUrl,
        banner_url: bannerUrl,
        about: aboutValue || null,
        ...(isOwner ? { is_published: publishToSend } : {}),
      });
      
      toast.success('Server settings updated!');
      clearIcon();
      clearBanner();
    } catch (error) {
      toast.error('Failed to update server');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishChange = (checked: boolean) => {
    if (!server || !user) return;
    if (!isOwner) return;

    // If trying to publish, require icon, banner, and description (or pending changes that will be saved)
    if (checked) {
      const aboutValue = (getValues('about') ?? '').trim();
      const hasIcon = !!(iconFile || iconPreview || server.icon_url);
      const hasBanner = !!(bannerFile || bannerPreview || server.banner_url);
      const hasAbout = !!(aboutValue || (server.about ?? '').trim());

      const missing: string[] = [];
      if (!hasIcon) missing.push('server icon');
      if (!hasBanner) missing.push('server banner');
      if (!hasAbout) missing.push('server description');

      if (missing.length > 0) {
        toast.error(`Please add a ${missing.join(', ')} before making this server public.`);
        return;
      }
    }

    // Don't publish immediately — only apply on "Save Changes"
    setPendingIsPublished(checked);
  };

  const handleDeleteServer = async () => {
    if (!server) return;
    
    setIsLoading(true);
    try {
      await deleteServer(server.id);
      toast.success('Server deleted');
      setShowDeleteConfirm(false);
      closeServerSettings();
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

  const handleCreateRole = async () => {
    if (!server || !user || !roleName.trim()) return;
    
    const finalColor = colorType === 'gradient' 
      ? createGradientString(gradientColors, gradientAngle)
      : roleColor;
    
    try {
      await createRole(server.id, user.id, roleName.trim(), finalColor, roleIcon.trim() ? roleIcon.trim() : null);
      // Refetch roles to ensure UI is up to date
      await fetchRoles(server.id);
      toast.success('Role created');
      setRoleName('');
      setRoleColor('#5865F2');
      setRoleIcon('');
      setColorType('solid');
      setGradientColors(['#5865F2', '#7289DA']);
      setGradientAngle(135);
      setSelectedRole(null);
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
    if (!server || !user || !selectedRole || !roleName.trim()) return;
    
    const finalColor = colorType === 'gradient' 
      ? createGradientString(gradientColors, gradientAngle)
      : roleColor;
    
    try {
      await updateRole(selectedRole.id, user.id, { name: roleName.trim(), color: finalColor, icon: roleIcon.trim() ? roleIcon.trim() : null });
      // Refetch roles to ensure UI is up to date
      await fetchRoles(server.id);
      toast.success('Role updated');
      // Keep the role selected but update its data
      const updatedRole = roles.find(r => r.id === selectedRole.id);
      if (updatedRole) {
        setSelectedRole(updatedRole);
        setEditingRole(updatedRole);
        setRoleName(updatedRole.name);
        const parsed = parseColorValue(updatedRole.color);
        if (parsed.type === 'gradient') {
          setColorType('gradient');
          setGradientColors(parsed.colors || ['#5865F2', '#7289DA']);
          setGradientAngle(parsed.angle || 135);
        } else {
          setColorType('solid');
          setRoleColor(parsed.color || '#5865F2');
        }
        setRoleIcon(updatedRole.icon || '');
      }
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
      // Clear selection after delete
      setSelectedRole(null);
      setEditingRole(null);
      setRoleName('');
      setRoleColor('#5865F2');
      setRoleIcon('');
      setColorType('solid');
      setGradientColors(['#5865F2', '#7289DA']);
      setGradientAngle(135);
    } catch (error) {
      console.error('Failed to delete role:', error);
      toast.error('Failed to delete role');
    }
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
    return null;
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
        accept="image/jpeg,image/png,image/webp,image/gif"
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

      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={closeServerSettings}
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Server Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage your server settings and members
            </p>
          </div>
        </div>

        {/* Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex overflow-hidden">
          <TabsList className="flex flex-col items-start justify-start h-full w-56 border-r border-border bg-secondary/30 p-2 gap-1 rounded-none inline-flex">
            <TabsTrigger 
              value="overview" 
              className="w-full justify-start gap-2 text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Settings className="w-4 h-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger 
              value="members" 
              className="w-full justify-start gap-2 text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Users className="w-4 h-4" />
              <span>Members</span>
            </TabsTrigger>
            <TabsTrigger 
              value="roles" 
              className="w-full justify-start gap-2 text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Palette className="w-4 h-4" />
              <span>Roles</span>
            </TabsTrigger>
            <TabsTrigger 
              value="bans" 
              className="w-full justify-start gap-2 text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Ban className="w-4 h-4" />
              <span>Bans</span>
            </TabsTrigger>
            {canManageInvites && (
              <TabsTrigger
                value="invites"
                className="w-full justify-start gap-2 text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Link2 className="w-4 h-4" />
                <span>Invites</span>
              </TabsTrigger>
            )}
            {canManageEmojis && (
              <TabsTrigger
                value="emojis"
                className="w-full justify-start gap-2 text-sm px-3 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Smile className="w-4 h-4" />
                <span>Emojis</span>
              </TabsTrigger>
            )}
          </TabsList>
          
          <div className="flex-1 overflow-y-auto">
            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-3xl">
                {/* Server Icon */}
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div 
                      onClick={() => canManageServer && fileInputRef.current?.click()}
                      className={cn(
                        "w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 transition-colors flex-shrink-0 overflow-hidden",
                        canManageServer && "cursor-pointer hover:border-primary"
                      )}
                    >
                      {displayIconUrl ? (
                        <img src={displayIconUrl} alt={server.name} className="w-full h-full object-cover" />
                      ) : (
                        <Upload className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
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
                        className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Server Icon</p>
                    <p className="text-xs text-muted-foreground">
                      {canManageServer ? 'Click to upload • Recommended 512x512' : 'Recommended 512x512'}
                    </p>
                  </div>
                </div>

                {/* Server Banner */}
                <div className="space-y-2">
                  <Label className="text-sm">Server Banner</Label>
                  <div className="relative">
                    <div 
                      onClick={() => canManageServer && bannerInputRef.current?.click()}
                      className={cn(
                        "w-full h-32 rounded-xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 transition-colors overflow-hidden",
                        canManageServer && "cursor-pointer hover:border-primary"
                      )}
                    >
                      {displayBannerUrl ? (
                        <img src={displayBannerUrl} alt="Server banner" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Upload className="w-6 h-6" />
                          <span className="text-xs">Click to upload banner</span>
                        </div>
                      )}
                    </div>
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
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {canManageServer ? 'Recommended 960x540 • Shown in server list' : 'Shown in server list'}
                  </p>
                </div>

                {/* Server Name */}
                <div className="space-y-2">
                  <Label htmlFor="serverName" className="text-sm">Server Name</Label>
                  <Input
                    id="serverName"
                    {...register('name')}
                    className={cn("h-10 text-sm", errors.name ? 'border-destructive' : '')}
                    disabled={!canManageServer}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                {/* About Server */}
                <div className="space-y-2">
                  <Label htmlFor="serverAbout" className="text-sm">About Server</Label>
                  <Textarea
                    id="serverAbout"
                    {...register('about')}
                    className={cn("min-h-[100px] text-sm resize-none", errors.about ? 'border-destructive' : '')}
                    disabled={!canManageServer}
                    placeholder="Tell people what your server is about..."
                    maxLength={500}
                  />
                  {errors.about && (
                    <p className="text-xs text-destructive">{errors.about.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    This description will be shown in the Explore page (if public) and server overview.
                  </p>
                </div>

                {/* Publish Server (owner-only) */}
                {isOwner && (
                  <div className="space-y-2">
                    <Label className="text-sm">Publish Server</Label>
                    <div className="flex items-start gap-3 p-3 rounded-lg border bg-secondary/30">
                      <Checkbox
                        checked={pendingIsPublished}
                        disabled={isLoading || isUploadingIcon || isUploadingBanner}
                        onCheckedChange={(v) => handlePublishChange(v === true)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Make this server public</p>
                        <p className="text-xs text-muted-foreground">
                          Public servers appear on the Explore page so people can discover and join.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {(isAdmin || isOwner) && (
                  <div className="pt-4">
                    <Button type="submit" disabled={isLoading || isUploadingIcon || isUploadingBanner} size="sm">
                      {(isLoading || isUploadingIcon || isUploadingBanner) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                )}
              </form>

              {/* Danger Zone */}
              {isOwner && (
                <div className="border-t border-destructive/20 pt-4 mt-6 max-w-3xl">
                  <h4 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    Deleting this server will permanently remove all channels, messages, and members.
                  </p>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-sm h-9"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Server
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="m-0 p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </p>
              </div>
              <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
                <div className="space-y-2 max-w-4xl">
                  {members.map((member) => {
                    const memberRoles = member.roles || [];
                    const hasRoles = memberRoles.length > 0;
                    
                    return (
                      <div 
                        key={member.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50"
                      >
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarImage src={member.user?.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: member.user?.banner_color || '#5865F2' }}>
                            {member.user?.username?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium truncate">
                              {member.nickname || member.user?.display_name || member.user?.username}
                            </span>
                            {getRoleIcon(member.role)}
                            {hasRoles && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {memberRoles.map((role) => {
                                  const isGradient = role.color.startsWith('linear-gradient');
                                  return (
                                    <Badge
                                      key={role.id}
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-4 font-medium border-0"
                                      style={
                                        isGradient
                                          ? { background: role.color, color: '#fff' }
                                          : { backgroundColor: role.color + '20', color: role.color }
                                      }
                                    >
                                      {role.name}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.user?.username} • {getRoleLabel(member.role)}
                          </p>
                        </div>
                        
                        {/* Actions */}
                        {canManageRoles && member.user_id !== user?.id && member.role !== 'owner' && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {roles.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-muted-foreground hover:text-foreground text-xs h-8 px-3"
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
                                            style={
                                              role.color.startsWith('linear-gradient')
                                                ? { background: role.color }
                                                : { backgroundColor: role.color }
                                            }
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
                              className="text-muted-foreground hover:text-destructive text-xs h-8 px-3"
                            >
                              Kick
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleBanMember(member)}
                              className="text-muted-foreground hover:text-destructive text-xs h-8 px-3"
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
            <TabsContent value="roles" className="m-0 h-full">
              {canManageRoles ? (
                <div className="flex h-full">
                  {/* Left Side - Roles List */}
                  <div className="w-64 border-r border-border flex flex-col">
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold">Roles</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRole(null);
                            setEditingRole(null);
                            setRoleName('');
                            setRoleColor('#5865F2');
                            setRoleIcon('');
                            setColorType('solid');
                            setGradientColors(['#5865F2', '#7289DA']);
                            setGradientAngle(135);
                          }}
                          className="h-8 w-8 p-0"
                          title="Create New Role"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Select a role to edit
                      </p>
                    </div>
                    <ScrollArea className="flex-1">
                      {roles.length > 0 ? (
                        <div className="p-2">
                          <DndContext
                            sensors={roleSensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleRoleDragStart}
                            onDragEnd={handleRoleDragEnd}
                            onDragCancel={handleRoleDragCancel}
                          >
                            <SortableContext items={roleIds} strategy={verticalListSortingStrategy}>
                              <div className="space-y-1">
                                {roles.map((role) => (
                                  <SortableRoleRow key={role.id} role={role} />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                          <Palette className="w-10 h-10 text-muted-foreground/50 mb-2" />
                          <p className="text-xs text-muted-foreground">No roles yet</p>
                        </div>
                      )}
                    </ScrollArea>
                  </div>

                  {/* Right Side - Role Settings */}
                  <div className="flex-1 overflow-y-auto">
                    {selectedRole || (!selectedRole && !editingRole) ? (
                      <div className="p-6 max-w-2xl">
                        <div className="space-y-5">
                          <div>
                            <h3 className="text-lg font-semibold mb-1">
                              {selectedRole ? 'Edit Role' : 'Create New Role'}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {selectedRole ? 'Modify role settings and permissions' : 'Create a new role for your server'}
                            </p>
                          </div>

                          {/* Role Form */}
                          <div className="space-y-4 p-4 border rounded-lg bg-secondary/30">
                            <div className="space-y-2">
                              <Label className="text-sm">Role Name</Label>
                              <Input
                                id="roleName"
                                value={roleName}
                                onChange={(e) => setRoleName(e.target.value)}
                                placeholder="Enter role name"
                                className="h-10 text-sm"
                                maxLength={100}
                              />
                            </div>

                            {/* Role Color Section */}
                            <div className="space-y-3">
                              <Label className="text-sm">Role Color</Label>
                              
                              {/* Color Type Selector */}
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  variant={colorType === 'solid' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setColorType('solid')}
                                  className="flex-1"
                                >
                                  Solid Color
                                </Button>
                                <Button
                                  type="button"
                                  variant={colorType === 'gradient' ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => setColorType('gradient')}
                                  className="flex-1"
                                >
                                  Gradient
                                </Button>
                              </div>

                              {/* Solid Color Picker */}
                              {colorType === 'solid' && (
                                <div className="flex items-center gap-2">
                                  <label
                                    htmlFor="roleColor"
                                    className="relative w-12 h-12 rounded-lg border-2 border-border cursor-pointer overflow-hidden flex-shrink-0 hover:border-primary transition-colors"
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
                                    className="h-10 text-sm flex-1"
                                    maxLength={7}
                                  />
                                </div>
                              )}

                              {/* Gradient Options */}
                              {colorType === 'gradient' && (
                                <div className="space-y-3">
                                  {/* Gradient Presets */}
                                  <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">Gradient Presets</p>
                                    <ScrollArea className="h-32">
                                      <div className="grid grid-cols-4 gap-2 pr-3">
                                        {gradientPresets.map((preset, idx) => (
                                          <button
                                            key={idx}
                                            type="button"
                                            onClick={() => {
                                              setGradientColors(preset.colors);
                                              setGradientAngle(preset.angle);
                                            }}
                                            className="relative h-12 rounded-lg border-2 border-border hover:border-primary transition-colors overflow-hidden group"
                                            style={{ background: createGradientString(preset.colors, preset.angle) }}
                                            title={preset.name}
                                          >
                                            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                              <span className="text-[10px] font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity text-center px-1">
                                                {preset.name}
                                              </span>
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    </ScrollArea>
                                  </div>

                                  {/* Custom Gradient Editor */}
                                  <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">Custom Gradient</p>
                                    <div 
                                      className="h-16 rounded-lg border-2 border-border"
                                      style={{ background: createGradientString(gradientColors, gradientAngle) }}
                                    />
                                    
                                    {/* Gradient Angle Slider */}
                                    <div className="space-y-1">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-xs">Angle</Label>
                                        <span className="text-xs text-muted-foreground">{gradientAngle}°</span>
                                      </div>
                                      <input
                                        type="range"
                                        min="0"
                                        max="360"
                                        value={gradientAngle}
                                        onChange={(e) => setGradientAngle(parseInt(e.target.value))}
                                        className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
                                        style={{
                                          background: `linear-gradient(to right, ${gradientColors[0]}, ${gradientColors[gradientColors.length - 1]})`
                                        }}
                                      />
                                    </div>

                                    {/* Gradient Color Stops */}
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between">
                                        <Label className="text-xs">Colors ({gradientColors.length})</Label>
                                        <div className="flex gap-1">
                                          {gradientColors.length < 4 && (
                                            <Button
                                              type="button"
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => setGradientColors([...gradientColors, '#5865F2'])}
                                              className="h-6 px-2 text-xs"
                                            >
                                              <Plus className="w-3 h-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        {gradientColors.map((color, idx) => (
                                          <div key={idx} className="flex items-center gap-2">
                                            <label
                                              className="relative w-10 h-10 rounded-lg border-2 border-border cursor-pointer overflow-hidden flex-shrink-0 hover:border-primary transition-colors"
                                              style={{ backgroundColor: color }}
                                            >
                                              <input
                                                type="color"
                                                value={color}
                                                onChange={(e) => {
                                                  const newColors = [...gradientColors];
                                                  newColors[idx] = e.target.value;
                                                  setGradientColors(newColors);
                                                }}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                              />
                                            </label>
                                            <Input
                                              value={color}
                                              onChange={(e) => {
                                                const newColors = [...gradientColors];
                                                newColors[idx] = e.target.value;
                                                setGradientColors(newColors);
                                              }}
                                              placeholder="#5865F2"
                                              className="h-10 text-sm flex-1"
                                              maxLength={7}
                                            />
                                            {gradientColors.length > 2 && (
                                              <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                  setGradientColors(gradientColors.filter((_, i) => i !== idx));
                                                }}
                                                className="h-10 w-10 text-muted-foreground hover:text-destructive"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                              </Button>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm">Role Icon (optional)</Label>
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
                                    className="h-10 px-3 flex items-center gap-2"
                                  >
                                    <Smile className="w-4 h-4" />
                                    <span className="text-sm">
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
                                    <p className="text-xs text-muted-foreground truncate">
                                      Emoji or server emoji (e.g. <span className="font-mono">:cat:</span>)
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                onClick={selectedRole ? handleUpdateRole : handleCreateRole}
                                disabled={!roleName.trim()}
                                size="sm"
                                className="flex-1"
                              >
                                {selectedRole ? (
                                  <>
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Update Role
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Role
                                  </>
                                )}
                              </Button>
                              {selectedRole && (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedRole(null);
                                    setEditingRole(null);
                                    setRoleName('');
                                    setRoleColor('#5865F2');
                                    setRoleIcon('');
                                    setColorType('solid');
                                    setGradientColors(['#5865F2', '#7289DA']);
                                    setGradientAngle(135);
                                  }}
                                  size="sm"
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Permissions Section */}
                          {selectedRole && (
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-semibold">Permissions</h4>
                                  <p className="text-xs text-muted-foreground">
                                    Manage what members with this role can do
                                  </p>
                                </div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setEditingRolePermissions(selectedRole)}
                                >
                                  <KeyRound className="w-4 h-4 mr-2" />
                                  Edit Permissions
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Delete Role */}
                          {selectedRole && (
                            <div className="border-t border-destructive/20 pt-4">
                              <h4 className="text-sm font-semibold text-destructive mb-2">Danger Zone</h4>
                              <p className="text-xs text-muted-foreground mb-3">
                                Deleting this role will remove it from all members.
                              </p>
                              <Button 
                                variant="destructive" 
                                size="sm"
                                onClick={() => handleDeleteRole(selectedRole)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Role
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <Palette className="w-12 h-12 text-muted-foreground/50 mb-3 mx-auto" />
                          <p className="text-sm text-muted-foreground">Select a role to view settings</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            or click + to create a new role
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Only admins can manage roles</p>
                </div>
              )}
            </TabsContent>

            {/* Invites Tab */}
            <TabsContent value="invites" className="m-0 p-6">
              {canManageInvites ? (
                <div className="space-y-4 max-w-4xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold">Invite Links</h4>
                      <p className="text-xs text-muted-foreground">
                        Create, copy, and revoke invite links.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={createInvite}
                      disabled={isCreatingInvite || isLoadingInvites}
                      className="flex-shrink-0"
                    >
                      {isCreatingInvite && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Create Invite
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 max-w-sm">
                    <Select value={inviteExpiresIn} onValueChange={setInviteExpiresIn}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Expires" />
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
                    <Select value={inviteMaxUses} onValueChange={setInviteMaxUses}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Max uses" />
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

                  {isLoadingInvites ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : invites.length > 0 ? (
                    <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
                      <div className="space-y-2">
                        {invites.map((invite) => {
                          const isRevoked = !!invite.revoked_at;
                          const isExpired = !!invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now();
                          const usesCount = invite.uses_count ?? 0;
                          const maxUses = invite.max_uses ?? null;
                          const isMaxed = maxUses !== null && usesCount >= maxUses;
                          const expiresLabel = (() => {
                            if (!invite.expires_at) return 'Never';
                            const diffMs = new Date(invite.expires_at).getTime() - Date.now();
                            if (diffMs <= 0) return 'Expired';
                            const minute = 60 * 1000;
                            const hour = 60 * minute;
                            const day = 24 * hour;
                            if (diffMs >= day) {
                              const d = Math.ceil(diffMs / day);
                              return `in ${d} day${d === 1 ? '' : 's'}`;
                            }
                            if (diffMs >= hour) {
                              const h = Math.ceil(diffMs / hour);
                              return `in ${h} hour${h === 1 ? '' : 's'}`;
                            }
                            const m = Math.ceil(diffMs / minute);
                            return `in ${m} minute${m === 1 ? '' : 's'}`;
                          })();
                          const maxUsesLabel = maxUses !== null ? String(maxUses) : '∞';
                          return (
                            <div
                              key={invite.id}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/30"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm tracking-widest">{invite.code}</span>
                                  {isRevoked && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                      Revoked
                                    </Badge>
                                  )}
                                  {!isRevoked && isExpired && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                      Expired
                                    </Badge>
                                  )}
                                  {!isRevoked && !isExpired && isMaxed && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                      Max uses reached
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Created by <span className="font-medium text-foreground">{invite.created_by_username}</span>
                                  {" "}•{" "}
                                  {new Date(invite.created_at).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Expires: <span className="font-medium text-foreground">{expiresLabel}</span>
                                  {" "}•{" "}
                                  Uses: <span className="font-medium text-foreground">{usesCount}/{maxUsesLabel}</span>
                                </p>
                                {isRevoked && invite.revoked_by_username && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Revoked by <span className="font-medium text-foreground">{invite.revoked_by_username}</span>
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyInviteLink(invite.code, invite.id)}
                                  className="h-8 px-3"
                                >
                                  {copiedInviteId === invite.id ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                                {!isRevoked && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => revokeInvite(invite.id)}
                                    className="h-8 px-3"
                                  >
                                    Revoke
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Link2 className="w-12 h-12 text-muted-foreground/50 mb-3" />
                      <p className="text-sm text-muted-foreground">No invites created yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Create an invite to share a join link.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">You don't have permission to manage invites</p>
                </div>
              )}
            </TabsContent>

            {/* Bans Tab */}
            <TabsContent value="bans" className="m-0 p-6">
              {bannedMembers.length > 0 ? (
                <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
                  <div className="space-y-2 max-w-4xl">
                    {bannedMembers.map((member) => (
                      <div 
                        key={member.id}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50"
                      >
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarImage src={member.user?.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: (member.user as any)?.banner_color || '#5865F2' }}>
                            {member.user?.username?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate">
                            {member.user?.username}
                          </span>
                        </div>
                        {canManageRoles && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={async () => {
                              try {
                                // Use RPC so pre-emptive bans are properly removed (and user can re-join)
                                const { error } = await supabase.rpc('unban_member', {
                                  _server_id: server.id,
                                  _user_id: user!.id,
                                  _target_user_id: member.user_id,
                                });
                                if (error) throw error;
                                toast.success(`${member.user?.username} has been unbanned`);
                              } catch {
                                toast.error('Failed to unban');
                              }
                            }}
                            className="text-xs h-8 px-3 flex-shrink-0"
                          >
                            Unban
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Ban className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">No banned users</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Users you ban will appear here
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Emojis Tab */}
            <TabsContent value="emojis" className="m-0 p-6">
              {canManageEmojis ? (
                <div className="space-y-5 max-w-4xl">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Custom Emojis</h4>
                    <p className="text-xs text-muted-foreground">
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
                        <p className="text-sm font-medium">Emoji Image</p>
                        <p className="text-xs text-muted-foreground">PNG/GIF/WebP/JPEG • Max 1MB</p>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2">
                      <Label className="text-sm" htmlFor="emojiName">Emoji Name</Label>
                      <Input
                        id="emojiName"
                        value={emojiName}
                        onChange={(e) => setEmojiName(e.target.value)}
                        placeholder="e.g. cat"
                        className="h-10 text-sm"
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
                    <h4 className="text-sm font-semibold">Server Emojis</h4>
                    {serverEmojis.length > 0 ? (
                      <ScrollArea className="h-[calc(100vh-28rem)] pr-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                                  <div className="text-sm font-medium truncate">:{emoji.name}:</div>
                                  <div className="text-xs text-muted-foreground truncate">{emoji.name}</div>
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
                        <p className="text-sm text-muted-foreground">No custom emojis yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Upload your first emoji above
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">You do not have permission to manage emojis</p>
                </div>
              )}
            </TabsContent>
            
          </div>
        </Tabs>
      </div>

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
        <AlertDialogContent className="max-w-lg">
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