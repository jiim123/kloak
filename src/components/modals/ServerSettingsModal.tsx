import { useState, useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  GripVertical,
  Link2,
  Check,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useRealtimeMembers } from "@/hooks";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { secureUpload, secureDelete, secureListAndDelete } from "@/lib/storageUpload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { invalidateServerEmojis } from "@/lib/serverEmojis";
import type { ServerRole, ServerMember, CustomServerRole } from "@/types";
import { BannerCropModal } from "./BannerCropModal";
import { Badge } from "@/components/ui/badge";
import { RolePermissionsEditor } from "./RolePermissionsEditor";
import { RoleColorPicker } from "./RoleColorPicker";
import { RoleIconPreview } from "@/components/ui/role-icon-preview";
import { EmojiGifPicker } from "./EmojiGifPicker";
import { DockNavigation } from "@/components/ui/dock-navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const MAX_ICON_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_ICON_TYPES = ["image/jpeg", "image/png", "image/webp"];

const MAX_EMOJI_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_EMOJI_TYPES = ["image/png", "image/gif", "image/webp", "image/jpeg"];
const EMOJI_NAME_REGEX = /^[a-z0-9_]{2,32}$/;
const MAX_SERVER_EMOJIS = 30;

const serverSettingsSchema = z.object({
  name: z.string().trim().min(1, "Server name is required").max(100, "Server name must be less than 100 characters"),
  about: z.string().trim().max(500, "About server must be less than 500 characters").optional().nullable(),
});

type ServerSettingsForm = z.infer<typeof serverSettingsSchema>;

// Server initials helper
const getServerInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// Owner icon helper - shows crown for server owner
const getOwnerIcon = (memberId: string, ownerId: string) => {
  if (memberId === ownerId) return <Crown className="w-4 h-4 text-yellow-500" />;
  return null;
};

// Gradient presets
const gradientPresets = [
  { name: "Ocean", colors: ["#667eea", "#764ba2"], angle: 135 },
  { name: "Sunset", colors: ["#ff6b6b", "#feca57"], angle: 135 },
  { name: "Forest", colors: ["#11998e", "#38ef7d"], angle: 135 },
  { name: "Fire", colors: ["#f12711", "#f5af19"], angle: 135 },
  { name: "Purple Dream", colors: ["#c471f5", "#fa71cd"], angle: 135 },
  { name: "Cool Blues", colors: ["#2193b0", "#6dd5ed"], angle: 135 },
  { name: "Peach", colors: ["#ed4264", "#ffedbc"], angle: 135 },
  { name: "Mint", colors: ["#00b4db", "#0083b0"], angle: 135 },
  { name: "Cosmic", colors: ["#4e54c8", "#8f94fb"], angle: 135 },
  { name: "Rose", colors: ["#f093fb", "#f5576c"], angle: 135 },
  { name: "Rainbow", colors: ["#ff0080", "#ff8c00", "#40e0d0"], angle: 90 },
  { name: "Neon", colors: ["#00f260", "#0575e6"], angle: 135 },
  { name: "Lavender", colors: ["#834d9b", "#d04ed6"], angle: 135 },
  { name: "Cyber", colors: ["#08aeea", "#2af598"], angle: 135 },
  { name: "Aurora", colors: ["#a8edea", "#fed6e3"], angle: 135 },
  { name: "Sunset Wave", colors: ["#ff9a56", "#ff6a88", "#ffd364"], angle: 120 },
  { name: "Deep Space", colors: ["#000428", "#004e92"], angle: 135 },
  { name: "Candy", colors: ["#fc6c8f", "#ffb88c", "#ffd98a"], angle: 90 },
  { name: "Electric", colors: ["#8e2de2", "#4a00e0"], angle: 135 },
  { name: "Tropical", colors: ["#f2994a", "#f2c94c"], angle: 135 },
];

const createGradientString = (colors: string[], angle: number = 135) => {
  return `linear-gradient(${angle}deg, ${colors.join(", ")})`;
};

const parseColorValue = (
  colorValue: string,
): { type: "solid" | "gradient"; color?: string; colors?: string[]; angle?: number } => {
  if (colorValue.startsWith("linear-gradient")) {
    // Parse gradient string
    const match = colorValue.match(/linear-gradient\((\d+)deg,\s*(.+)\)/);
    if (match) {
      const angle = parseInt(match[1]);
      const colors = match[2].split(",").map((c) => c.trim());
      return { type: "gradient", colors, angle };
    }
  }
  return { type: "solid", color: colorValue };
};

export const ServerSettingsModal = () => {
  const { activeModal, modalData, closeModal, openModal } = useUIStore();
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
    updateMember,
  } = useServerStore();
  const { user } = useAuthStore();
  const isMobile = useIsMobile();

  type SettingsTabId = "overview" | "members" | "roles" | "bans" | "invites" | "emojis";

  const [isLoading, setIsLoading] = useState(false);
  const [pendingIsPublished, setPendingIsPublished] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("overview");
  const [editingRole, setEditingRole] = useState<CustomServerRole | null>(null);
  const [editingRolePermissions, setEditingRolePermissions] = useState<CustomServerRole | null>(null);
  const [roleTab, setRoleTab] = useState<'details' | 'permissions'>('details');
  const [roleName, setRoleName] = useState("");
  const [roleColor, setRoleColor] = useState("#5865F2");
  const [roleIcon, setRoleIcon] = useState<string>("");
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [colorType, setColorType] = useState<"solid" | "gradient">("solid");
  const [gradientColors, setGradientColors] = useState<string[]>(["#5865F2", "#7289DA"]);
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

  // Removal tracking flags (prevent stale store fallback)
  const [iconRemoved, setIconRemoved] = useState(false);
  const [bannerRemoved, setBannerRemoved] = useState(false);

  // Banner crop modal state
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);

  // Custom emoji state (owner-only)
  const [emojiFile, setEmojiFile] = useState<File | null>(null);
  const [emojiPreview, setEmojiPreview] = useState<string | null>(null);
  const [emojiName, setEmojiName] = useState("");
  const [isUploadingEmoji, setIsUploadingEmoji] = useState(false);
  const [serverEmojis, setServerEmojis] = useState<Array<{ id: string; name: string; file_path: string }>>([]);
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const [editingEmojiId, setEditingEmojiId] = useState<string | null>(null);
  const [editingEmojiName, setEditingEmojiName] = useState("");

  // Memoize emoji URLs to prevent regenerating on every render
  const serverEmojisWithUrls = useMemo(() => {
    return serverEmojis.map((emoji) => {
      const { data: urlData } = supabase.storage
        .from("server-emojis")
        .getPublicUrl(emoji.file_path);
      return { ...emoji, url: urlData.publicUrl };
    });
  }, [serverEmojis]);

  // Banned members state (separate from `members`, which intentionally excludes banned)
  const [bannedMembers, setBannedMembers] = useState<
    Array<{
      id: string;
      user_id: string;
      joined_at?: string | null;
      user: {
        id: string;
        username: string;
        display_name?: string | null;
        avatar_url?: string | null;
        banner_color?: string;
      };
    }>
  >([]);

  const [invites, setInvites] = useState<
    Array<{
      id: string;
      code: string;
      created_at: string;
      created_by: string;
      created_by_username: string;
      expires_at: string | null;
      max_uses: number | null;
      uses_count: number;
      revoked_at: string | null;
      revoked_by: string | null;
      revoked_by_username: string | null;
    }>
  >([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [inviteExpiresIn, setInviteExpiresIn] = useState<string>("never");
  const [inviteMaxUses, setInviteMaxUses] = useState<string>("unlimited");

  const isOpen = isMobile && activeModal === "server-settings";

  // Get server from modal data or use current server
  const serverId = modalData?.serverId as string | undefined;
  const server = serverId ? servers.find((s) => s.id === serverId) || currentServer : currentServer;

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
      await reorderRoles(
        server.id,
        user.id,
        newOrder.map((r) => r.id),
      );
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
          "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-secondary/30 border border-border/30 hover:bg-secondary/50 transition-colors",
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
        <div
          className="w-4 h-4 rounded-full flex-shrink-0"
          style={
            role.color.startsWith("linear-gradient") ? { background: role.color } : { backgroundColor: role.color }
          }
        />
        <div className="flex-1 min-w-0">
          <span className="text-xs sm:text-sm font-medium">{role.name}</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            rounded="xl"
            onClick={() => {
              if (isMobile) {
                handleEditRole(role);
                setRoleTab('permissions');
              } else {
                setEditingRolePermissions(role);
              }
            }}
            className="text-[10px] sm:text-xs h-8 px-2 sm:px-3"
            title="Edit Permissions"
          >
            <KeyRound className="w-3 h-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            rounded="xl"
            onClick={() => {
              handleEditRole(role);
              if (isMobile) {
                setRoleTab('details');
              }
            }}
            className="text-[10px] sm:text-xs h-8 px-2 sm:px-3"
            title="Edit Role"
          >
            <Edit2 className="w-3 h-3" />
          </Button>
          {role.name !== '@everyone' && (
            <Button
              variant="ghost"
              size="sm"
              rounded="xl"
              onClick={() => handleDeleteRole(role)}
              className="text-muted-foreground hover:text-destructive text-[10px] sm:text-xs h-8 px-2 sm:px-3"
              title="Delete Role"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  // Get current user's role
  const currentMembership = useMemo(() => {
    if (!server) return null;
    return servers.find((s) => s.id === server.id);
  }, [servers, server]);

  const userRole = currentMembership?.role;
  // Use permission system instead of hardcoded role checks
  const { hasPermission } = useMemberPermissions();
  const canManageServer = hasPermission("manage_server");
  const canManageRoles = hasPermission("manage_roles");
  const canManageChannels = hasPermission("manage_channels");
  const canManageInvites = hasPermission("manage_invites");
  const canManageEmojis = hasPermission("manage_emojis");

  // For backward compatibility and specific checks
  const isOwner = !!user && !!server && server.owner_id === user.id;
  const isAdmin = canManageServer || canManageRoles || canManageChannels;

  // Navigation items for tabs with categories
  const navCategories = useMemo(() => {
    const categories: Array<{ 
      label: string; 
      items: Array<{ id: SettingsTabId; label: string; icon: LucideIcon }> 
    }> = [
      {
        label: "Server",
        items: [
          { id: "overview", label: "Overview", icon: Settings },
        ],
      },
      {
        label: "People",
        items: [
          { id: "members", label: "Members", icon: Users },
          { id: "roles", label: "Roles", icon: Palette },
          { id: "bans", label: "Bans", icon: Ban },
        ],
      },
    ];

    // Content category
    if (canManageEmojis) {
      categories.push({
        label: "Content",
        items: [
          { id: "emojis", label: "Emojis", icon: Smile },
        ],
      });
    }

    // Integrations category
    if (canManageInvites) {
      categories.push({
        label: "Integrations",
        items: [
          { id: "invites", label: "Invites", icon: Link2 },
        ],
      });
    }

    return categories;
  }, [canManageEmojis, canManageInvites]);

  // Flattened navItems for backward compatibility (used in mobile view)
  const navItems = useMemo(() => {
    return navCategories.flatMap(category => category.items);
  }, [navCategories]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
    reset,
  } = useForm<ServerSettingsForm>({
    resolver: zodResolver(serverSettingsSchema),
    defaultValues: { name: server?.name || "", about: server?.about || "" },
  });

  // Real-time members updates
  useRealtimeMembers(isOpen && server ? server.id : null);

  // Load + subscribe to banned members for the Bans tab
  useEffect(() => {
    if (!isOpen) return;
    if (!server?.id || !user?.id) return;

    let cancelled = false;

    const loadBannedMembers = async () => {
      try {
        const { data, error } = await supabase.rpc("get_banned_members", {
          _server_id: server.id,
          _user_id: user.id,
        });

        if (cancelled) return;
        if (error) throw error;

        let rows: any[] = [];
        if (!data) {
          rows = [];
        } else if (typeof data === "string") {
          rows = JSON.parse(data);
        } else if (Array.isArray(data)) {
          rows = data;
        } else {
          rows = [];
        }

        setBannedMembers(rows as any);
      } catch {
        if (!cancelled) setBannedMembers([]);
      }
    };

    loadBannedMembers();

    const channel = supabase
      .channel(`bans:${server.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "server_members", filter: `server_id=eq.${server.id}` },
        () => {
          loadBannedMembers();
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [isOpen, server?.id, user?.id]);

  // Fetch members and roles when modal opens
  useEffect(() => {
    if (isOpen && server) {
      fetchMembers(server.id);
      fetchRoles(server.id);
      reset({ name: server.name, about: server.about || "" });
      setPendingIsPublished(!!server.is_published);
      // Reset icon state
      setIconFile(null);
      setIconPreview(null);
      setIconRemoved(false);
      // Reset banner state
      setBannerFile(null);
      setBannerPreview(null);
      setBannerRemoved(false);
      // Reset emoji state
      setEmojiFile(null);
      setEmojiName("");
      if (emojiPreview) {
        URL.revokeObjectURL(emojiPreview);
      }
      setEmojiPreview(null);
      setServerEmojis([]);
      // Reset role form
      setEditingRole(null);
      setRoleName("");
      setRoleColor("#5865F2");
      setRoleIcon("");
      setColorType("solid");
      setGradientColors(["#5865F2", "#7289DA"]);
      setGradientAngle(135);
    }
  }, [isOpen, server, fetchMembers, fetchRoles, reset]);

  // Load server emojis when modal opens
  useEffect(() => {
    if (!isOpen || !server || !canManageEmojis) return;
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("server_emojis")
        .select("id,name,file_path")
        .eq("server_id", server.id)
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        console.error("Failed to load server emojis:", error);
        setServerEmojis([]);
        return;
      }
      setServerEmojis((data ?? []) as Array<{ id: string; name: string; file_path: string }>);
    })();

    const handleEmojisChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.serverId === server?.id) {
        (async () => {
          const { data } = await supabase
            .from("server_emojis")
            .select("id,name,file_path")
            .eq("server_id", server!.id)
            .order("created_at", { ascending: true });
          setServerEmojis((data ?? []) as Array<{ id: string; name: string; file_path: string }>);
        })();
      }
    };
    window.addEventListener("server-emojis-changed", handleEmojisChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("server-emojis-changed", handleEmojisChanged);
    };
  }, [isOpen, server?.id, canManageEmojis]);

  const loadInvites = async () => {
    if (!server?.id || !user?.id) return;
    if (!canManageInvites) return;

    setIsLoadingInvites(true);
    try {
      const { data, error } = await supabase.rpc("list_server_invites", {
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
    if (!isOpen || !server?.id || !user?.id) return;
    if (!canManageInvites) return;

    let cancelled = false;

    (async () => {
      setIsLoadingInvites(true);
      try {
        const { data, error } = await supabase.rpc("list_server_invites", {
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
  }, [isOpen, server?.id, user?.id, canManageInvites]);

  const createInvite = async () => {
    if (!server?.id || !user?.id) return;
    if (!canManageInvites) return;

    const expiresInSeconds =
      inviteExpiresIn === "never"
        ? null
        : inviteExpiresIn === "30m"
          ? 30 * 60
          : inviteExpiresIn === "1h"
            ? 60 * 60
            : inviteExpiresIn === "6h"
              ? 6 * 60 * 60
              : inviteExpiresIn === "12h"
                ? 12 * 60 * 60
                : inviteExpiresIn === "1d"
                  ? 24 * 60 * 60
                  : 7 * 24 * 60 * 60;

    const maxUsesValue = inviteMaxUses === "unlimited" ? null : parseInt(inviteMaxUses, 10);

    setIsCreatingInvite(true);
    try {
      const { error } = await supabase.rpc("create_server_invite", {
        _server_id: server.id,
        _user_id: user.id,
        _expires_in_seconds: expiresInSeconds,
        _max_uses: maxUsesValue,
      });

      if (error) throw error;
      await loadInvites();
      toast.success("Invite created");
    } catch {
      toast.error("Failed to create invite");
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const revokeInvite = async (inviteId: string) => {
    if (!server?.id || !user?.id) return;
    if (!canManageInvites) return;
    if (!confirm("Revoke this invite?")) return;

    try {
      const { error } = await supabase.rpc("revoke_server_invite", {
        _invite_id: inviteId,
        _user_id: user.id,
      });

      if (error) throw error;
      await loadInvites();
      toast.success("Invite revoked");
    } catch {
      toast.error("Failed to revoke invite");
    }
  };

  const copyInviteLink = async (code: string, inviteId: string) => {
    const link = `${window.location.origin}/invite/${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedInviteId(inviteId);
      setTimeout(() => setCopiedInviteId(null), 2000);
      toast.success("Invite link copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const clearEmoji = () => {
    setEmojiFile(null);
    setEmojiName("");
    if (emojiPreview) {
      URL.revokeObjectURL(emojiPreview);
      setEmojiPreview(null);
    }
    if (emojiInputRef.current) {
      emojiInputRef.current.value = "";
    }
  };

  const handleEmojiSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canManageEmojis) {
      toast.error("You do not have permission to manage emojis");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_EMOJI_TYPES.includes(file.type)) {
      toast.error("Please select a PNG, GIF, WebP, or JPEG image");
      return;
    }

    if (file.size > MAX_EMOJI_SIZE) {
      toast.error("Emoji must be less than 1MB");
      return;
    }

    setEmojiFile(file);
    setEmojiPreview(URL.createObjectURL(file));
  };

  const uploadServerEmoji = async () => {
    if (!server || !user) return;
    if (!canManageEmojis) {
      toast.error("You do not have permission to manage emojis");
      return;
    }
    if (!emojiFile) {
      toast.error("Please select an emoji image");
      return;
    }

    // Enforce 30 emoji cap (also enforced in DB via trigger)
    try {
      const { count, error } = await supabase
        .from("server_emojis")
        .select("*", { count: "exact", head: true })
        .eq("server_id", server.id);

      if (error) throw error;
      if ((count ?? 0) >= MAX_SERVER_EMOJIS) {
        toast.error(`This server already has ${MAX_SERVER_EMOJIS} custom emojis`);
        return;
      }
    } catch (e) {
      console.error("Failed to check emoji limit:", e);
      toast.error("Unable to verify emoji limit. Please try again.");
      return;
    }

    const normalized = emojiName.trim().toLowerCase();
    if (!EMOJI_NAME_REGEX.test(normalized)) {
      toast.error("Emoji name must be 2-32 characters (a-z, 0-9, underscore)");
      return;
    }

    setIsUploadingEmoji(true);
    try {
      const ext = (emojiFile.name.split(".").pop() || "png").toLowerCase();
      const filePath = `${server.id}/${normalized}-${crypto.randomUUID()}.${ext}`;

      await secureUpload("server-emojis", filePath, emojiFile, { contentType: emojiFile.type, upsert: false });

      const { error: insertError } = await (supabase.rpc as any)('upload_server_emoji', {
        _server_id: server.id,
        _user_id: user.id,
        _name: normalized,
        _file_path: filePath
      });

      if (insertError) throw insertError;

      // Refresh list
      const { data, error } = await supabase
        .from("server_emojis")
        .select("id,name,file_path")
        .eq("server_id", server.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setServerEmojis((data ?? []) as Array<{ id: string; name: string; file_path: string }>);
      toast.success("Emoji uploaded");
      invalidateServerEmojis(server.id);
      clearEmoji();
    } catch (err: any) {
      const msg = err?.message || "Failed to upload emoji";
      if (msg.includes("server_emojis_server_id_name_key")) {
        toast.error("That emoji name is already taken");
      } else if (msg.toLowerCase().includes("server emoji limit reached")) {
        toast.error(`This server already has ${MAX_SERVER_EMOJIS} custom emojis`);
      } else {
        toast.error(msg);
      }
    } finally {
      setIsUploadingEmoji(false);
    }
  };

  const renameServerEmoji = async (emojiId: string, newName: string) => {
    if (!server || !user) return;
    if (!canManageEmojis) {
      toast.error("You do not have permission to manage emojis");
      return;
    }
    const trimmed = newName.trim().toLowerCase();
    if (!EMOJI_NAME_REGEX.test(trimmed)) {
      toast.error("Emoji name must be 2-32 lowercase letters, numbers, or underscores");
      return;
    }
    // Check for duplicate name
    if (serverEmojis.some((e) => e.name === trimmed && e.id !== emojiId)) {
      toast.error("That emoji name is already taken");
      return;
    }
    try {
      const { error } = await (supabase.rpc as any)('rename_server_emoji', {
        _emoji_id: emojiId,
        _user_id: user.id,
        _new_name: trimmed,
      });
      if (error) throw error;
      setServerEmojis((prev) => prev.map((e) => (e.id === emojiId ? { ...e, name: trimmed } : e)));
      invalidateServerEmojis(server.id);
      setEditingEmojiId(null);
      toast.success("Emoji renamed");
    } catch (err: any) {
      const msg = err?.message || "Failed to rename emoji";
      if (msg.includes("server_emojis_server_id_name_key")) {
        toast.error("That emoji name is already taken");
      } else {
        toast.error(msg);
      }
    }
  };

  const deleteServerEmoji = async (emoji: { id: string; name: string; file_path: string }) => {
    if (!server) return;
    if (!canManageEmojis) {
      toast.error("You do not have permission to manage emojis");
      return;
    }
    if (!confirm(`Delete emoji "${emoji.name}"?`)) return;

    try {
      const { data: deletedPath, error } = await (supabase.rpc as any)('delete_server_emoji', {
        _emoji_id: emoji.id,
        _user_id: user.id
      });
      
      if (error) throw error;
      if (deletedPath) {
        await secureDelete("server-emojis", deletedPath as string);
      }

      setServerEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
      invalidateServerEmojis(server.id);
      toast.success("Emoji deleted");
    } catch (error) {
      console.error("Failed to delete emoji:", error);
      toast.error("Failed to delete emoji");
    }
  };

  const handleIconSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !server || !user) return;

    if (!ALLOWED_ICON_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > MAX_ICON_SIZE) {
      toast.error("Image must be less than 2MB");
      return;
    }

    // Show local preview immediately
    const preview = URL.createObjectURL(file);
    setIconPreview(preview);
    setIconRemoved(false);
    setIsUploadingIcon(true);

    try {
      const uploadedUrl = await uploadIcon(server.id, file);
      if (!uploadedUrl) throw new Error("Upload returned null");

      const cacheBustedUrl = `${uploadedUrl}?t=${Date.now()}`;
      await updateServer(server.id, user.id, { icon_url: cacheBustedUrl });
      setIconPreview(cacheBustedUrl);
      toast.success("Server icon updated");
    } catch (err) {
      console.error("Failed to upload icon:", err);
      toast.error("Failed to upload server icon");
      URL.revokeObjectURL(preview);
      setIconPreview(null);
    } finally {
      setIsUploadingIcon(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const clearIcon = () => {
    setIconFile(null);
    if (iconPreview) {
      URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadIcon = async (serverId: string, file: File): Promise<string | null> => {
    const { compressImage } = await import("@/lib/imageCompression");
    const compressed = await compressImage(file, "server-icon");
    const ext = compressed.name.split(".").pop() || "webp";
    const filePath = `${serverId}/icon-${Date.now()}.${ext}`;

    // Clean up old icon files first
    try {
      await secureListAndDelete("server-icons", serverId, "icon");
    } catch { /* ignore cleanup errors */ }

    const result = await secureUpload("server-icons", filePath, file, { upsert: true });

    return result.publicUrl;
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_ICON_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > MAX_ICON_SIZE) {
      toast.error("Image must be less than 2MB");
      return;
    }

    // Open crop modal with the selected image
    const src = URL.createObjectURL(file);
    setCropImageSrc(src);
    setShowCropModal(true);

    if (bannerInputRef.current) bannerInputRef.current.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    if (!server || !user) return;

    // Show local preview immediately
    const preview = URL.createObjectURL(croppedBlob);
    setBannerPreview(preview);
    setBannerRemoved(false);
    setIsUploadingBanner(true);

    // Close crop modal
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
    setShowCropModal(false);

    try {
      const rawFile = new File([croppedBlob], "banner.webp", { type: "image/webp" });
      const { compressImage } = await import("@/lib/imageCompression");
      const compressed = await compressImage(rawFile, "server-banner");
      const uploadedUrl = await uploadBanner(server.id, compressed);
      if (!uploadedUrl) throw new Error("Upload returned null");

      const cacheBustedUrl = `${uploadedUrl}?t=${Date.now()}`;
      await updateServer(server.id, user.id, { banner_url: cacheBustedUrl });
      setBannerPreview(cacheBustedUrl);
      toast.success("Server banner updated");
    } catch (err) {
      console.error("Failed to upload banner:", err);
      toast.error("Failed to upload server banner");
      URL.revokeObjectURL(preview);
      setBannerPreview(null);
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleCropCancel = () => {
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
    setShowCropModal(false);
  };

  const clearBanner = () => {
    setBannerFile(null);
    if (bannerPreview) {
      URL.revokeObjectURL(bannerPreview);
      setBannerPreview(null);
    }
    if (bannerInputRef.current) {
      bannerInputRef.current.value = "";
    }
  };

  const uploadBanner = async (serverId: string, file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop() || "webp";
    // Use timestamp in path to avoid cache collisions after removal + re-upload
    const filePath = `${serverId}/banner-${Date.now()}.${ext}`;

    // Clean up old banner files first
    try {
      await secureListAndDelete("server-icons", serverId, "banner");
    } catch { /* ignore cleanup errors */ }

    const result = await secureUpload("server-icons", filePath, file, { upsert: true });

    return result.publicUrl;
  };

  const handleRemoveBanner = async () => {
    if (!server || !user) return;

    setIsUploadingBanner(true);
    try {
      // Delete banner files from storage (try common extensions)
      const extensions = ["webp", "png", "jpg", "jpeg"];
      const filesToRemove = extensions.map(ext => `${server.id}/banner.${ext}`);
      await secureDelete("server-icons", filesToRemove);

      // Update DB
      await updateServer(server.id, user.id, { banner_url: null });

      // Clear local state so displayBannerUrl becomes null
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      setBannerPreview(null);
      setBannerFile(null);
      setBannerRemoved(true);

      toast.success("Server banner removed");
    } catch (error) {
      toast.error("Failed to remove banner");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleRemoveIcon = async () => {
    if (!server || !user) return;

    setIsUploadingIcon(true);
    try {
      // Delete all icon files from storage (handles timestamped filenames)
      try {
        await secureListAndDelete("server-icons", server.id, "icon");
      } catch { /* ignore cleanup errors */ }

      // Update DB
      await updateServer(server.id, user.id, { icon_url: null });

      // Clear local state so displayIconUrl becomes null
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
      setIconFile(null);
      setIconRemoved(true);

      toast.success("Server icon removed");
    } catch (error) {
      toast.error("Failed to remove icon");
    } finally {
      setIsUploadingIcon(false);
    }
  };

  const onSubmit = async (data: ServerSettingsForm) => {
    if (!server || !user) return;

    setIsLoading(true);
    try {
      const aboutValue = (data.about || "").trim();

      // Publishing prerequisites: require icon, banner, and description
      let publishToSend = pendingIsPublished;
      if (isOwner && pendingIsPublished) {
        const hasIcon = !!(iconPreview || server.icon_url);
        const hasBanner = !!(bannerPreview || server.banner_url);
        const hasAbout = !!aboutValue;

        if (!hasIcon || !hasBanner || !hasAbout) {
          publishToSend = false;
          setPendingIsPublished(false);
          toast.error("Add a server icon, banner, and description before making this server public.");
        }
      }

      await updateServer(server.id, user.id, {
        name: data.name,
        about: aboutValue || null,
        ...(isOwner ? { is_published: publishToSend } : {}),
      });

      toast.success("Server settings updated!");
      closeModal();
    } catch (error) {
      toast.error("Failed to update server");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishChange = (checked: boolean) => {
    if (!server || !user) return;
    if (!isOwner) return;

    // If trying to publish, require icon, banner, and description (or pending changes that will be saved)
    if (checked) {
      const aboutValue = (getValues("about") ?? "").trim();
      const hasIcon = !!(iconPreview || server.icon_url);
      const hasBanner = !!(bannerPreview || server.banner_url);
      const hasAbout = !!(aboutValue || (server.about ?? "").trim());

      const missing: string[] = [];
      if (!hasIcon) missing.push("server icon");
      if (!hasBanner) missing.push("server banner");
      if (!hasAbout) missing.push("server description");

      if (missing.length > 0) {
        toast.error(`Please add a ${missing.join(", ")} before making this server public.`);
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
      toast.success("Server deleted");
      setShowDeleteConfirm(false);
      closeModal();
    } catch (error) {
      toast.error("Failed to delete server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKickMember = async (member: ServerMember) => {
    if (!server) return;

    try {
      await kickMember(server.id, member.user_id);
      toast.success(`${member.user?.username || "User"} has been kicked`);
    } catch (error) {
      toast.error("Failed to kick member");
    }
  };

  const handleBanMember = async (member: ServerMember) => {
    if (!server) return;

    try {
      await banMember(server.id, member.user_id);
      toast.success(`${member.user?.username || "User"} has been banned`);
    } catch (error) {
      toast.error("Failed to ban member");
    }
  };

  const handleClose = () => {
    reset();
    setActiveTab("overview");
    clearIcon();
    clearBanner();
    // Cleanup crop modal
    if (cropImageSrc) {
      URL.revokeObjectURL(cropImageSrc);
      setCropImageSrc(null);
    }
    setShowCropModal(false);
    setEditingRole(null);
    setRoleName("");
    setRoleColor("#5865F2");
    setRoleIcon("");
    setColorType("solid");
    setGradientColors(["#5865F2", "#7289DA"]);
    setGradientAngle(135);
    closeModal();
  };

  const handleCreateRole = async () => {
    if (!server || !user || !roleName.trim()) return;

    const finalColor = colorType === "gradient" ? createGradientString(gradientColors, gradientAngle) : roleColor;

    try {
      await createRole(server.id, user.id, roleName.trim(), finalColor, roleIcon.trim() ? roleIcon.trim() : null);
      await fetchRoles(server.id);
      toast.success("Role created");
      setRoleName("");
      setRoleColor("#5865F2");
      setRoleIcon("");
      setColorType("solid");
      setGradientColors(["#5865F2", "#7289DA"]);
      setGradientAngle(135);
    } catch (error: any) {
      console.error("Failed to create role:", error);
      const errorMessage = error?.message || "Failed to create role";
      if (errorMessage.includes("migration")) {
        toast.error("Database migration required. Please apply the migration file first.", {
          duration: 10000,
        });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleUpdateRole = async () => {
    if (!server || !user || !editingRole || !roleName.trim()) return;

    const finalColor = colorType === "gradient" ? createGradientString(gradientColors, gradientAngle) : roleColor;

    try {
      await updateRole(editingRole.id, user.id, {
        name: roleName.trim(),
        color: finalColor,
        icon: roleIcon.trim() ? roleIcon.trim() : null,
      });
      await fetchRoles(server.id);
      toast.success("Role updated");
      setEditingRole(null);
      setRoleName("");
      setRoleColor("#5865F2");
      setRoleIcon("");
      setColorType("solid");
      setGradientColors(["#5865F2", "#7289DA"]);
      setGradientAngle(135);
    } catch (error) {
      console.error("Failed to update role:", error);
      toast.error("Failed to update role");
    }
  };

  const handleDeleteRole = async (role: CustomServerRole) => {
    if (!server || !user) return;

    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) return;

    try {
      await deleteRole(role.id, user.id);
      await fetchRoles(server.id);
      toast.success("Role deleted");
    } catch (error) {
      console.error("Failed to delete role:", error);
      toast.error("Failed to delete role");
    }
  };

  const handleEditRole = (role: CustomServerRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    const parsed = parseColorValue(role.color);
    if (parsed.type === "gradient") {
      setColorType("gradient");
      setGradientColors(parsed.colors || ["#5865F2", "#7289DA"]);
      setGradientAngle(parsed.angle || 135);
    } else {
      setColorType("solid");
      setRoleColor(parsed.color || "#5865F2");
    }
    setRoleIcon(role.icon || "");
  };

  const handleAssignRole = async (member: ServerMember, role: CustomServerRole) => {
    if (!server || !user) return;

    try {
      await assignRoleToMember(member.id, role.id, user.id);
      toast.success(`Role "${role.name}" assigned`);
    } catch (error) {
      toast.error("Failed to assign role");
    }
  };

  const handleRemoveRole = async (member: ServerMember, role: CustomServerRole) => {
    if (!server || !user) return;

    try {
      await removeRoleFromMember(member.id, role.id, user.id);
      toast.success(`Role "${role.name}" removed`);
    } catch (error) {
      toast.error("Failed to remove role");
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

  const displayIconUrl = iconRemoved ? null : (iconPreview || server.icon_url);
  const displayBannerUrl = bannerRemoved ? null : (bannerPreview || server.banner_url);

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

      {/* Banner Crop Modal */}
      {showCropModal && cropImageSrc && (
        <BannerCropModal
          open={showCropModal}
          imageSrc={cropImageSrc}
          onClose={handleCropCancel}
          onCropComplete={handleCropComplete}
          isUploading={isUploadingBanner}
        />
      )}

      {isOpen && isMobile && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-end p-4 pb-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

          {/* Dialog */}
          <div
            className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-border mb-4"
            style={{ maxHeight: "calc(100vh - 140px)" }}
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  {navItems.find((n) => n.id === activeTab)?.label || "Server Settings"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeTab === "overview" && "Manage server details"}
                  {activeTab === "members" && "View and manage members"}
                  {activeTab === "roles" && "Manage server roles"}
                  {activeTab === "bans" && "Manage banned users"}
                  {activeTab === "invites" && "Manage invite links"}
                  {activeTab === "emojis" && "Manage custom emojis"}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={handleClose} className="rounded-full">
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-5" style={{ maxHeight: "calc(100vh - 240px)" }}>
              {activeTab === "overview" && (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  {/* Server Icon Section */}
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div
                          onClick={() => canManageServer && !isUploadingIcon && fileInputRef.current?.click()}
                          className={cn(
                            "w-14 h-14 rounded-xl bg-secondary/50 flex items-center justify-center border border-border/30 transition-colors flex-shrink-0 overflow-hidden relative",
                            canManageServer && !isUploadingIcon && "cursor-pointer hover:border-primary/50",
                          )}
                        >
                          {displayIconUrl ? (
                            <img src={displayIconUrl} alt={server.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base font-bold text-muted-foreground">{getServerInitials(server.name)}</span>
                          )}
                          {isUploadingIcon && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
                            </div>
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
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Server Icon</p>
                        <p className="text-xs text-muted-foreground">512x512 recommended</p>
                      </div>
                    </div>
                  </div>

                  {/* Server Banner Section */}
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-3">
                    <Label className="text-sm font-medium">Server Banner</Label>
                    <div className="relative">
                      <div
                        onClick={() => canManageServer && !isUploadingBanner && bannerInputRef.current?.click()}
                        className={cn(
                          "w-full h-24 rounded-xl bg-secondary/50 flex items-center justify-center border border-border/30 transition-colors overflow-hidden relative",
                          canManageServer && !isUploadingBanner && "cursor-pointer hover:border-primary/50",
                        )}
                      >
                        {displayBannerUrl ? (
                          <img src={displayBannerUrl} alt="Server banner" className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Upload className="w-5 h-5" />
                            <span className="text-xs">Click to upload</span>
                          </div>
                        )}
                        {isUploadingBanner && (
                          <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
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
                          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Server Name Section */}
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-3">
                    <Label htmlFor="serverNameMobile" className="text-sm font-medium">
                      Server Name
                    </Label>
                    <Input
                      id="serverNameMobile"
                      {...register("name")}
                      className={cn(
                        "h-10 rounded-xl bg-secondary/50 border-border/30",
                        errors.name && "border-destructive",
                      )}
                      disabled={!canManageServer}
                    />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>

                  {/* About Server Section */}
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-3">
                    <Label htmlFor="serverAboutMobile" className="text-sm font-medium">
                      About Server
                    </Label>
                    <Textarea
                      id="serverAboutMobile"
                      {...register("about")}
                      className={cn(
                        "min-h-[100px] rounded-xl bg-secondary/50 border-border/30 resize-none text-sm",
                        errors.about && "border-destructive",
                      )}
                      disabled={!canManageServer}
                      placeholder="Tell people what your server is about..."
                      maxLength={500}
                    />
                    {errors.about && <p className="text-xs text-destructive">{errors.about.message}</p>}
                    <p className="text-xs text-muted-foreground">
                      This description will be shown in the Explore page (if public) and server overview.
                    </p>
                  </div>

                  {/* Publish Server (owner-only) */}
                  {isOwner && (
                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-3">
                      <Label className="text-sm font-medium">Publish Server</Label>
                      <div className="flex items-start gap-3 p-3 rounded-lg border bg-background/50">
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

                  {isAdmin && (
                    <Button
                      type="submit"
                      disabled={isLoading || isUploadingIcon || isUploadingBanner}
                      rounded="xl"
                      className="h-10 w-full"
                    >
                      {(isLoading || isUploadingIcon || isUploadingBanner) && (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      )}
                      Save Changes
                    </Button>
                  )}

                  {/* Danger Zone */}
                  {isOwner && (
                    <div className="bg-destructive/10 backdrop-blur-sm rounded-xl border border-destructive/30 p-3 mt-4 space-y-3">
                      <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
                      <p className="text-xs text-muted-foreground">Delete server permanently.</p>
                      <Button
                        variant="destructive"
                        rounded="xl"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="h-10 w-full"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Server
                      </Button>
                    </div>
                  )}
                </form>
              )}

              {activeTab === "invites" &&
                (canManageInvites ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        {invites.length} active invite{invites.length !== 1 ? "s" : ""}
                      </p>
                      <Button
                        onClick={createInvite}
                        disabled={isCreatingInvite || isLoadingInvites}
                        rounded="xl"
                        className="h-9"
                      >
                        {(isCreatingInvite || isLoadingInvites) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Plus className="w-4 h-4 mr-2" />
                        New
                      </Button>
                    </div>

                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3">
                      {isLoadingInvites ? (
                        <div className="flex items-center justify-center py-8 text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      ) : invites.length > 0 ? (
                        <div className="space-y-2">
                          {invites.map((invite) => (
                            <div
                              key={invite.id}
                              className="flex items-center justify-between gap-2 p-3 rounded-xl bg-background/50 border border-border/30"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium truncate">{invite.code}</div>
                                <div className="text-xs text-muted-foreground truncate">
                                  Created by {invite.created_by_username} •{" "}
                                  {new Date(invite.created_at).toLocaleString()}
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  rounded="xl"
                                  onClick={() => copyInviteLink(invite.code, invite.id)}
                                  className="h-8 px-2"
                                >
                                  {copiedInviteId === invite.id ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Link2 className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  rounded="xl"
                                  onClick={() => revokeInvite(invite.id)}
                                  className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <Link2 className="w-10 h-10 text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">No active invites</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-6 flex flex-col items-center justify-center text-center">
                    <Shield className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">You don't have permission to manage invites</p>
                  </div>
                ))}

              {activeTab === "members" && (
                <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3">
                  <p className="text-sm text-muted-foreground mb-3">
                    {members.length} member{members.length !== 1 ? "s" : ""}
                  </p>
                  <div className="max-h-[400px] overflow-y-auto overscroll-contain touch-pan-y space-y-2">
                    {members.map((member) => {
                      const memberRoles = member.roles || [];
                      const hasRoles = memberRoles.length > 0;
                      return (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/30"
                        >
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={member.user?.avatar_url || undefined} />
                            <AvatarFallback style={{ backgroundColor: member.user?.banner_color || "#5865F2" }}>
                              {member.user?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium truncate">
                                {member.nickname || member.user?.display_name || member.user?.username}
                              </span>
                              {server && getOwnerIcon(member.user_id, server.owner_id)}
                              {hasRoles && (
                                <div className="flex items-center gap-1 flex-wrap">
                                  {memberRoles.map((role) => {
                                    const isGradient = role.color.startsWith("linear-gradient");
                                    return (
                                      <Badge
                                        key={role.id}
                                        variant="outline"
                                        className="text-[10px] px-1.5 py-0 h-4 font-medium border-0 rounded-md"
                                        style={
                                          isGradient
                                            ? { background: role.color, color: "#fff" }
                                            : { backgroundColor: role.color + "20", color: role.color }
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
                              {member.user?.username}{server && member.user_id === server.owner_id ? ' • Owner' : ''}
                            </p>
                          </div>
                          {canManageRoles && (member.user_id !== user?.id || isOwner) && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {roles.length > 0 && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-muted-foreground hover:text-foreground text-xs h-7 px-2 rounded-lg"
                                    >
                                      Roles
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                    {roles.map((role) => {
                                      const hasRole = memberRoles.some((r) => r.id === role.id);
                                      return (
                                        <DropdownMenuItem
                                          key={role.id}
                                          onClick={() =>
                                            hasRole ? handleRemoveRole(member, role) : handleAssignRole(member, role)
                                          }
                                          className="rounded-lg"
                                        >
                                          <div className="flex items-center gap-2 w-full">
                                            <div
                                              className="w-3 h-3 rounded-full flex-shrink-0"
                                              style={
                                                role.color.startsWith("linear-gradient")
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
                                className="text-muted-foreground hover:text-destructive text-xs h-7 px-2 rounded-lg"
                              >
                                Kick
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleBanMember(member)}
                                className="text-muted-foreground hover:text-destructive text-xs h-7 px-2 rounded-lg"
                              >
                                Ban
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === "roles" &&
                (canManageRoles ? (
                  <div className="space-y-4">
                    {editingRole ? (
                      <Tabs value={roleTab} onValueChange={(v) => setRoleTab(v as 'details' | 'permissions')} className="space-y-4">
                        <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3">
                          <div className="mb-3">
                            <h4 className="text-sm font-semibold mb-1">Edit Role</h4>
                            <p className="text-xs text-muted-foreground">Modify role settings and permissions</p>
                          </div>
                          <TabsList className="inline-flex h-auto p-1 bg-secondary/50 rounded-xl border border-border/50 w-full">
                            <TabsTrigger 
                              value="details"
                              className="flex-1 rounded-lg py-2 px-3 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                              Details
                            </TabsTrigger>
                            <TabsTrigger 
                              value="permissions"
                              className="flex-1 rounded-lg py-2 px-3 text-xs font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                              Permissions
                            </TabsTrigger>
                          </TabsList>
                        </div>

                        <TabsContent value="details" className="m-0 space-y-4">
                          <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-4">
                      <div className="space-y-3">
                        <Label className="text-sm">Role Name</Label>
                        <Input
                          value={roleName}
                          onChange={(e) => setRoleName(e.target.value)}
                          placeholder="Role name"
                          className="h-10 rounded-xl bg-secondary/50 border-border/30"
                          maxLength={100}
                        />
                      </div>
                      <RoleColorPicker
                        colorType={colorType}
                        onColorTypeChange={setColorType}
                        color={roleColor}
                        onColorChange={setRoleColor}
                        gradientColors={gradientColors}
                        onGradientColorsChange={setGradientColors}
                        gradientAngle={gradientAngle}
                        onGradientAngleChange={setGradientAngle}
                      />
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
                              className="h-10 px-3 rounded-xl flex items-center gap-2"
                            >
                              <Smile className="w-4 h-4" />
                              <span className="text-sm">{roleIcon ? "Change" : "Select"}</span>
                            </Button>
                          </EmojiGifPicker>
                          <div className="flex-1 min-w-0">
                            {roleIcon ? (
                              <div className="flex items-center gap-2">
                                <RoleIconPreview icon={roleIcon} serverId={server.id} />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="w-8 h-8 rounded-xl"
                                  onClick={() => setRoleIcon("")}
                                  title="Clear role icon"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground truncate">Emoji or server emoji</p>
                            )}
                          </div>
                        </div>
                      </div>
                            <Button
                              onClick={handleUpdateRole}
                              disabled={!roleName.trim()}
                              className="h-10 rounded-xl w-full"
                            >
                              Update Role
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                setEditingRole(null);
                                setRoleName("");
                                setRoleColor("#5865F2");
                                setRoleIcon("");
                                setColorType("solid");
                                setGradientColors(["#5865F2", "#7289DA"]);
                                setGradientAngle(135);
                                setRoleTab('details');
                              }}
                              className="h-10 rounded-xl w-full"
                            >
                              Cancel
                            </Button>
                          </div>
                        </TabsContent>

                        <TabsContent value="permissions" className="m-0">
                          {server && (
                            <RolePermissionsEditor
                              role={editingRole}
                              serverId={server.id}
                              onClose={() => {}}
                            />
                          )}
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-4">
                        <h4 className="text-sm font-semibold">Create Role</h4>
                        <div className="space-y-3">
                          <Label className="text-sm">Role Name</Label>
                          <Input
                            value={roleName}
                            onChange={(e) => setRoleName(e.target.value)}
                            placeholder="Role name"
                            className="h-10 rounded-xl bg-secondary/50 border-border/30"
                            maxLength={100}
                          />
                        </div>
                        <RoleColorPicker
                          colorType={colorType}
                          onColorTypeChange={setColorType}
                          color={roleColor}
                          onColorChange={setRoleColor}
                          gradientColors={gradientColors}
                          onGradientColorsChange={setGradientColors}
                          gradientAngle={gradientAngle}
                          onGradientAngleChange={setGradientAngle}
                        />
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
                                className="h-10 px-3 rounded-xl flex items-center gap-2"
                              >
                                <Smile className="w-4 h-4" />
                                <span className="text-sm">{roleIcon ? "Change" : "Select"}</span>
                              </Button>
                            </EmojiGifPicker>
                            <div className="flex-1 min-w-0">
                              {roleIcon ? (
                                <div className="flex items-center gap-2">
                                  <RoleIconPreview icon={roleIcon} serverId={server.id} />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="w-8 h-8 rounded-xl"
                                    onClick={() => setRoleIcon("")}
                                    title="Clear role icon"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground truncate">Emoji or server emoji</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button
                          onClick={handleCreateRole}
                          disabled={!roleName.trim()}
                          className="h-10 rounded-xl w-full"
                        >
                          Create Role
                        </Button>
                      </div>
                    )}

                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-3">
                      <h4 className="text-sm font-semibold">Server Roles</h4>
                      {roles.length > 0 ? (
                        <div className="space-y-2">
                          {roles.map((role) => (
                            <div
                              key={role.id}
                              className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/30"
                            >
                              <div
                                className="w-4 h-4 rounded-full flex-shrink-0"
                                style={
                                  role.color.startsWith("linear-gradient")
                                    ? { background: role.color }
                                    : { backgroundColor: role.color }
                                }
                              />
                              {role.icon && <span className="text-sm font-emoji leading-none">{role.icon}</span>}
                              <span className="text-sm font-medium flex-1">{role.name}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRole(role)}
                                className="h-7 px-2 rounded-lg"
                              >
                                <Edit2 className="w-3 h-3" />
                              </Button>
                              {role.name !== '@everyone' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteRole(role)}
                                  className="text-muted-foreground hover:text-destructive h-7 px-2 rounded-lg"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                            <Palette className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">No custom roles yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-6 flex flex-col items-center justify-center text-center">
                    <Shield className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">Only admins can manage roles</p>
                  </div>
                ))}

              {activeTab === "bans" && (
                <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3">
                  {bannedMembers.length > 0 ? (
                    <div className="max-h-[400px] overflow-y-auto overscroll-contain touch-pan-y space-y-2">
                      {bannedMembers.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center gap-2 p-2 rounded-xl bg-background/50 border border-border/30"
                        >
                          <Avatar className="w-8 h-8 flex-shrink-0">
                            <AvatarImage src={member.user?.avatar_url || undefined} />
                            <AvatarFallback
                              style={{ backgroundColor: (member.user as any)?.banner_color || "#5865F2" }}
                            >
                              {member.user?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium flex-1 truncate">{member.user?.username}</span>
                          {canManageRoles && (
                            <Button
                              variant="outline"
                              size="sm"
                              rounded="lg"
                              onClick={async () => {
                                try {
                                  const { error } = await supabase.rpc("unban_member", {
                                    _server_id: server.id,
                                    _user_id: user!.id,
                                    _target_user_id: member.user_id,
                                  });
                                  if (error) throw error;
                                  toast.success(`${member.user?.username} has been unbanned`);
                                } catch {
                                  toast.error("Failed to unban");
                                }
                              }}
                              className="text-xs h-7 px-2"
                            >
                              Unban
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Ban className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">No banned users</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "emojis" &&
                (canManageEmojis ? (
                  <div className="space-y-4">
                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-3">
                      <h4 className="text-sm font-semibold">Upload Emoji</h4>
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => emojiInputRef.current?.click()}
                          className="w-14 h-14 rounded-xl bg-secondary/50 flex items-center justify-center border border-border/30 cursor-pointer hover:border-primary/50 overflow-hidden"
                        >
                          {emojiPreview ? (
                            <img src={emojiPreview} alt="Emoji preview" className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <Input
                          value={emojiName}
                          onChange={(e) => setEmojiName(e.target.value)}
                          placeholder="emoji_name"
                          className="h-10 rounded-xl bg-secondary/50 border-border/30 flex-1"
                          maxLength={32}
                        />
                      </div>
                      <Button
                        onClick={uploadServerEmoji}
                        disabled={isUploadingEmoji || !emojiFile || !emojiName.trim()}
                        rounded="xl"
                        className="h-10 w-full"
                      >
                        {isUploadingEmoji && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Upload Emoji
                      </Button>
                    </div>

                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">Server Emojis</h4>
                        <span className="text-xs text-muted-foreground">{serverEmojis.length}/{MAX_SERVER_EMOJIS}</span>
                      </div>
                      {serverEmojisWithUrls.length > 0 ? (
                        <div className="rounded-lg border border-border/30 overflow-hidden">
                          <div className="flex items-center gap-3 px-3 py-1.5 bg-secondary/40 border-b border-border/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                            <span className="w-8">Image</span>
                            <span className="flex-1">Name</span>
                          </div>
                          <div className="max-h-[250px] overflow-y-auto overscroll-contain touch-pan-y divide-y divide-border/30">
                            {serverEmojisWithUrls.map((emoji) => (
                              <div
                                key={emoji.id}
                                className="group flex items-center gap-3 px-3 py-2 hover:bg-secondary/20 transition-colors"
                              >
                                <img
                                  src={emoji.url}
                                  alt={emoji.name}
                                  className="w-8 h-8 flex-shrink-0 rounded object-contain"
                                  loading="lazy"
                                />
                                <div className="min-w-0 flex-1">
                                  {editingEmojiId === emoji.id ? (
                                    <form onSubmit={(e) => { e.preventDefault(); renameServerEmoji(emoji.id, editingEmojiName); }}>
                                      <input
                                        autoFocus
                                        className="w-full text-xs font-medium bg-secondary/50 border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring/50"
                                        value={editingEmojiName}
                                        onChange={(e) => setEditingEmojiName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                        onKeyDown={(e) => { if (e.key === 'Escape') setEditingEmojiId(null); }}
                                        onBlur={() => setTimeout(() => setEditingEmojiId(null), 150)}
                                        maxLength={32}
                                      />
                                    </form>
                                  ) : (
                                    <span className="text-xs font-medium">:{emoji.name}:</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    rounded="lg"
                                    onClick={() => { setEditingEmojiId(emoji.id); setEditingEmojiName(emoji.name); }}
                                    className="text-muted-foreground hover:text-foreground h-6 w-6 p-0"
                                    title="Rename emoji"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    rounded="lg"
                                    onClick={() => deleteServerEmoji(emoji)}
                                    className="text-muted-foreground hover:text-destructive h-6 w-6 p-0"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                          <Smile className="w-10 h-10 text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">No custom emojis yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-6 flex flex-col items-center justify-center text-center">
                    <Shield className="w-10 h-10 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">You don't have permission to manage emojis</p>
                  </div>
                ))}
            </div>
          </div>

          {/* Dock Navigation */}
          <DockNavigation
            navItems={navItems}
            activeTab={activeTab}
            onTabChange={(tabId) => setActiveTab(tabId as SettingsTabId)}
          />
        </div>
      )}

      {/* Desktop: Standard Dialog */}
      {!isMobile && (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
          <DialogContent className="bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl p-0 max-h-[90vh] max-w-[calc(100vw-2rem)] w-full sm:max-w-4xl flex flex-col">
            {/* Header */}
            <DialogHeader className="p-4 sm:p-6 pb-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Settings className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-base sm:text-lg font-semibold">Server Settings</DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                    Manage your server settings and members
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="flex-1 flex overflow-hidden p-4 sm:p-6 pt-4 gap-4">
              {/* Sidebar Navigation */}
              <div className="flex flex-col items-start justify-start h-full w-48 bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-1.5 gap-1 flex-shrink-0 overflow-y-auto">
                {navCategories.map((category, categoryIndex) => (
                  <div key={category.label} className={cn("w-full", categoryIndex > 0 && "mt-2")}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {category.label}
                    </div>
                    {category.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={cn(
                            "w-full flex items-center justify-start gap-2 text-sm px-3 py-2.5 rounded-xl transition-colors",
                            isActive
                              ? "bg-background shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-secondary/80",
                          )}
                        >
                          <Icon className="w-4 h-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Content Area */}
              <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y min-h-0">
                {activeTab === "overview" && (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    {/* Server Icon Section */}
                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className="relative">
                          <div
                            onClick={() => canManageServer && !isUploadingIcon && fileInputRef.current?.click()}
                            className={cn(
                              "w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-secondary/50 flex items-center justify-center border border-border/30 transition-colors flex-shrink-0 overflow-hidden relative",
                              canManageServer && !isUploadingIcon && "cursor-pointer hover:border-primary/50",
                            )}
                          >
                            {displayIconUrl ? (
                              <img src={displayIconUrl} alt={server.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-base font-bold text-muted-foreground">{getServerInitials(server.name)}</span>
                            )}
                            {isUploadingIcon && (
                              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                              </div>
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
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium">Server Icon</p>
                          <p className="text-xs text-muted-foreground">
                            {canManageServer ? "Click to upload • 512x512 recommended" : "512x512 recommended"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Server Banner Section */}
                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4 space-y-3">
                      <Label className="text-sm font-medium">Server Banner</Label>
                      <div className="relative">
                        <div
                          onClick={() => canManageServer && !isUploadingBanner && bannerInputRef.current?.click()}
                          className={cn(
                            "w-full h-24 sm:h-32 rounded-xl bg-secondary/50 flex items-center justify-center border border-border/30 transition-colors overflow-hidden relative",
                            canManageServer && !isUploadingBanner && "cursor-pointer hover:border-primary/50",
                          )}
                        >
                          {displayBannerUrl ? (
                            <img src={displayBannerUrl} alt="Server banner" className="w-full h-full object-cover" />
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Upload className="w-5 h-5" />
                              <span className="text-xs">Click to upload banner</span>
                            </div>
                          )}
                          {isUploadingBanner && (
                            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                              <Loader2 className="w-5 h-5 animate-spin text-primary" />
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
                            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:bg-destructive/90 disabled:opacity-50"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {canManageServer ? "960x540 recommended • Shown in server list" : "Shown in server list"}
                      </p>
                    </div>

                    {/* Server Name Section */}
                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4 space-y-3">
                      <Label htmlFor="serverName" className="text-sm font-medium">
                        Server Name
                      </Label>
                      <Input
                        id="serverName"
                        {...register("name")}
                        className={cn(
                          "h-10 rounded-xl bg-secondary/50 border-border/30",
                          errors.name && "border-destructive",
                        )}
                        disabled={!canManageServer}
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>

                    {isAdmin && (
                      <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                        <Button
                          type="submit"
                          disabled={isLoading || isUploadingIcon || isUploadingBanner}
                          rounded="xl"
                          className="h-10 flex-1 sm:flex-none"
                        >
                          {(isLoading || isUploadingIcon || isUploadingBanner) && (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          )}
                          Save Changes
                        </Button>
                      </div>
                    )}

                    {/* Danger Zone */}
                    {isOwner && (
                      <div className="bg-destructive/10 backdrop-blur-sm rounded-xl border border-destructive/30 p-3 sm:p-4 mt-4 space-y-3">
                        <h4 className="text-sm font-semibold text-destructive">Danger Zone</h4>
                        <p className="text-xs text-muted-foreground">
                          Deleting this server will permanently remove all channels, messages, and members.
                        </p>
                        <Button
                          variant="destructive"
                          rounded="xl"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="h-10"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Server
                        </Button>
                      </div>
                    )}
                  </form>
                )}

                {activeTab === "invites" &&
                  (canManageInvites ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {invites.length} active invite{invites.length !== 1 ? "s" : ""}
                        </p>
                        <Button
                          onClick={createInvite}
                          disabled={isCreatingInvite || isLoadingInvites}
                          rounded="xl"
                          className="h-9"
                        >
                          {(isCreatingInvite || isLoadingInvites) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          <Plus className="w-4 h-4 mr-2" />
                          New
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Select value={inviteExpiresIn} onValueChange={setInviteExpiresIn}>
                          <SelectTrigger className="h-9 rounded-xl">
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
                          <SelectTrigger className="h-9 rounded-xl">
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

                      <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4">
                        {isLoadingInvites ? (
                          <div className="flex items-center justify-center py-10 text-muted-foreground">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        ) : invites.length > 0 ? (
                          <div className="space-y-2">
                            {invites.map((invite) => {
                              const isRevoked = !!invite.revoked_at;
                              const isExpired =
                                !!invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now();
                              const isMaxed = invite.max_uses !== null && invite.uses_count >= invite.max_uses;
                              const expiresLabel = (() => {
                                if (!invite.expires_at) return "Never";
                                const diffMs = new Date(invite.expires_at).getTime() - Date.now();
                                if (diffMs <= 0) return "Expired";
                                const minute = 60 * 1000;
                                const hour = 60 * minute;
                                const day = 24 * hour;
                                if (diffMs >= day) {
                                  const d = Math.ceil(diffMs / day);
                                  return `in ${d} day${d === 1 ? "" : "s"}`;
                                }
                                if (diffMs >= hour) {
                                  const h = Math.ceil(diffMs / hour);
                                  return `in ${h} hour${h === 1 ? "" : "s"}`;
                                }
                                const m = Math.ceil(diffMs / minute);
                                return `in ${m} minute${m === 1 ? "" : "s"}`;
                              })();
                              const maxUsesLabel = invite.max_uses !== null ? String(invite.max_uses) : "∞";

                              return (
                                <div
                                  key={invite.id}
                                  className="flex items-center justify-between gap-2 p-3 rounded-xl bg-background/50 border border-border/30"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <div className="text-sm font-medium truncate">{invite.code}</div>
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
                                    <div className="text-xs text-muted-foreground truncate">
                                      Created by {invite.created_by_username} •{" "}
                                      {new Date(invite.created_at).toLocaleString()}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                      Expires: {expiresLabel} • Uses: {invite.uses_count}/{maxUsesLabel}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      rounded="xl"
                                      onClick={() => copyInviteLink(invite.code, invite.id)}
                                      className="h-8 px-2"
                                    >
                                      {copiedInviteId === invite.id ? (
                                        <Check className="w-4 h-4" />
                                      ) : (
                                        <Link2 className="w-4 h-4" />
                                      )}
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      rounded="xl"
                                      onClick={() => revokeInvite(invite.id)}
                                      className="h-8 px-2 text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 text-center">
                            <Link2 className="w-10 h-10 text-muted-foreground mb-3" />
                            <p className="text-sm text-muted-foreground">No active invites</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-6 flex flex-col items-center justify-center text-center">
                      <Shield className="w-10 h-10 text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">You don't have permission to manage invites</p>
                    </div>
                  ))}

                {activeTab === "members" && (
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-muted-foreground">
                        {members.length} member{members.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto overscroll-contain touch-pan-y space-y-2">
                      {members.map((member) => {
                        const memberRoles = member.roles || [];
                        const hasRoles = memberRoles.length > 0;

                        return (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-background/50 border border-border/30"
                          >
                            <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                              <AvatarImage src={member.user?.avatar_url || undefined} />
                              <AvatarFallback style={{ backgroundColor: member.user?.banner_color || "#5865F2" }}>
                                {member.user?.username?.[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium truncate">
                                  {member.nickname || member.user?.display_name || member.user?.username}
                                </span>
                                {server && getOwnerIcon(member.user_id, server.owner_id)}
                                {hasRoles && (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {memberRoles.map((role) => {
                                      const isGradient = role.color.startsWith("linear-gradient");
                                      return (
                                        <Badge
                                          key={role.id}
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 h-4 font-medium border-0 rounded-md"
                                          style={
                                            isGradient
                                              ? { background: role.color, color: "#fff" }
                                              : { backgroundColor: role.color + "20", color: role.color }
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
                                {member.user?.username}{server && member.user_id === server.owner_id ? ' • Owner' : ''}
                              </p>
                            </div>

                            {canManageRoles && member.user_id !== user?.id && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {roles.length > 0 && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        rounded="xl"
                                        className="text-muted-foreground hover:text-foreground text-xs h-8 px-2 sm:px-3"
                                      >
                                        Roles
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                                      {roles.map((role) => {
                                        const hasRole = memberRoles.some((r) => r.id === role.id);
                                        return (
                                          <DropdownMenuItem
                                            key={role.id}
                                            onClick={() =>
                                              hasRole ? handleRemoveRole(member, role) : handleAssignRole(member, role)
                                            }
                                            className="rounded-lg"
                                          >
                                            <div className="flex items-center gap-2 w-full">
                                              <div
                                                className="w-3 h-3 rounded-full flex-shrink-0"
                                                style={
                                                  role.color.startsWith("linear-gradient")
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
                                  rounded="xl"
                                  onClick={() => handleKickMember(member)}
                                  className="text-muted-foreground hover:text-destructive text-xs h-8 px-2 sm:px-3"
                                >
                                  Kick
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  rounded="xl"
                                  onClick={() => handleBanMember(member)}
                                  className="text-muted-foreground hover:text-destructive text-xs h-8 px-2 sm:px-3"
                                >
                                  Ban
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {activeTab === "roles" &&
                  (canManageRoles ? (
                    <div className="space-y-4">
                      {/* Create/Edit Role Form */}
                      <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4 space-y-4">
                        <h4 className="text-sm font-semibold">{editingRole ? "Edit Role" : "Create Role"}</h4>
                        <div className="space-y-3">
                          <Label className="text-sm">Role Name & Color</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="roleName"
                              value={roleName}
                              onChange={(e) => setRoleName(e.target.value)}
                              placeholder="Enter role name"
                              className="h-10 rounded-xl bg-secondary/50 border-border/30 flex-1"
                              maxLength={100}
                            />
                            <div className="relative flex items-center gap-2">
                              <label
                                htmlFor="roleColor"
                                className="relative w-10 h-10 rounded-xl border border-border/30 cursor-pointer overflow-hidden flex-shrink-0 hover:border-primary/50 transition-colors"
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
                                className="h-10 rounded-xl bg-secondary/50 border-border/30 w-24"
                                maxLength={7}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-3">
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
                                rounded="xl"
                                className="h-10 px-3 flex items-center gap-2"
                              >
                                <Smile className="w-4 h-4" />
                                <span className="text-sm">{roleIcon ? "Change" : "Select"}</span>
                              </Button>
                            </EmojiGifPicker>
                            <div className="flex-1 min-w-0">
                              {roleIcon ? (
                                <div className="flex items-center gap-2">
                                  <RoleIconPreview icon={roleIcon} serverId={server.id} />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    rounded="xl"
                                    className="w-8 h-8"
                                    onClick={() => setRoleIcon("")}
                                    title="Clear role icon"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground truncate">Emoji or existing server emoji</p>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row gap-2">
                          <Button
                            onClick={editingRole ? handleUpdateRole : handleCreateRole}
                            disabled={!roleName.trim()}
                            rounded="xl"
                            className="h-10 flex-1"
                          >
                            {editingRole ? (
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
                          {editingRole && (
                            <Button
                              variant="outline"
                              rounded="xl"
                              onClick={() => {
                                setEditingRole(null);
                                setRoleName("");
                                setRoleColor("#5865F2");
                                setRoleIcon("");
                              }}
                              className="h-10"
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Existing Roles List */}
                      <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4 space-y-3">
                        <h4 className="text-sm font-semibold">Server Roles</h4>
                        {roles.length > 0 ? (
                          <DndContext
                            sensors={roleSensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleRoleDragStart}
                            onDragEnd={handleRoleDragEnd}
                            onDragCancel={handleRoleDragCancel}
                          >
                            <SortableContext items={roleIds} strategy={verticalListSortingStrategy}>
                              <div className="space-y-2">
                                {roles.map((role) => (
                                  <SortableRoleRow key={role.id} role={role} />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                              <Palette className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">No custom roles yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Create your first role above</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-6 flex flex-col items-center justify-center text-center">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                        <Shield className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">Only admins can manage roles</p>
                    </div>
                  ))}

                {activeTab === "bans" && (
                  <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4">
                    {bannedMembers.length > 0 ? (
                      <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto overscroll-contain touch-pan-y space-y-2">
                        {bannedMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-xl bg-background/50 border border-border/30"
                          >
                            <Avatar className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0">
                              <AvatarImage src={member.user?.avatar_url || undefined} />
                              <AvatarFallback
                                style={{ backgroundColor: (member.user as any)?.banner_color || "#5865F2" }}
                              >
                                {member.user?.username?.[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium truncate">{member.user?.username}</span>
                            </div>
                            {canManageRoles && (
                              <Button
                                variant="outline"
                                size="sm"
                                rounded="xl"
                                onClick={async () => {
                                  try {
                                    const { error } = await supabase.rpc("unban_member", {
                                      _server_id: server.id,
                                      _user_id: user!.id,
                                      _target_user_id: member.user_id,
                                    });
                                    if (error) throw error;
                                    toast.success(`${member.user?.username} has been unbanned`);
                                  } catch {
                                    toast.error("Failed to unban");
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
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                          <Ban className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">No banned users</p>
                        <p className="text-xs text-muted-foreground mt-1">Users you ban will appear here</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "emojis" &&
                  (canManageEmojis ? (
                    <div className="space-y-4">
                      {/* Import from emoji.gg */}
                      <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-semibold">Import from emoji.gg</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Browse and import emoji packs from emoji.gg
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            rounded="xl"
                            onClick={() => openModal("import-emoji-pack")}
                            className="h-9 flex-shrink-0"
                          >
                            <Link2 className="w-4 h-4 mr-2" />
                            Import Pack
                          </Button>
                        </div>
                      </div>

                      <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4 space-y-3">
                        <h4 className="text-sm font-semibold">Custom Emojis</h4>
                        <p className="text-xs text-muted-foreground">
                          Upload an emoji and set a name (2-32 chars: a-z, 0-9, underscore). Use it in chat as{" "}
                          <span className="font-mono">:name:</span>
                        </p>

                        {/* Upload row */}
                        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                          <div className="flex items-center gap-3">
                            <div
                              onClick={() => emojiInputRef.current?.click()}
                              className="w-14 h-14 rounded-xl bg-secondary/50 flex items-center justify-center border border-border/30 transition-colors flex-shrink-0 overflow-hidden cursor-pointer hover:border-primary/50"
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
                            <Label className="text-sm" htmlFor="emojiName">
                              Emoji Name
                            </Label>
                            <Input
                              id="emojiName"
                              value={emojiName}
                              onChange={(e) => setEmojiName(e.target.value)}
                              placeholder="e.g. cat"
                              className="h-10 rounded-xl bg-secondary/50 border-border/30"
                              maxLength={32}
                            />
                          </div>

                          <div className="flex flex-col-reverse sm:flex-row gap-2">
                            <Button
                              type="button"
                              onClick={uploadServerEmoji}
                              disabled={isUploadingEmoji || !emojiFile || !emojiName.trim()}
                              rounded="xl"
                              className="h-10 flex-1 sm:flex-none"
                            >
                              {isUploadingEmoji && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                              Upload
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              rounded="xl"
                              onClick={clearEmoji}
                              disabled={isUploadingEmoji && !!emojiFile}
                              className="h-10"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Emoji list */}
                      <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-3 sm:p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">Server Emojis</h4>
                          <span className="text-xs text-muted-foreground">{serverEmojis.length}/{MAX_SERVER_EMOJIS}</span>
                        </div>
                        {serverEmojis.length > 0 ? (
                          <div className="rounded-lg border border-border/30 overflow-hidden">
                            <div className="flex items-center gap-3 px-3 sm:px-4 py-2 bg-secondary/40 border-b border-border/30 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                              <span className="w-8 sm:w-10">Image</span>
                              <span className="flex-1">Name</span>
                            </div>
                            <div className="max-h-[350px] sm:max-h-[400px] overflow-y-auto overscroll-contain touch-pan-y divide-y divide-border/30">
                              {serverEmojisWithUrls.map((emoji) => (
                                <div
                                  key={emoji.id}
                                  className="group flex items-center gap-3 px-3 sm:px-4 py-2.5 hover:bg-secondary/20 transition-colors"
                                >
                                  <img
                                    src={emoji.url}
                                    alt={emoji.name}
                                    className="w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 rounded object-contain"
                                    loading="lazy"
                                  />
                                  <div className="min-w-0 flex-1">
                                    {editingEmojiId === emoji.id ? (
                                      <form onSubmit={(e) => { e.preventDefault(); renameServerEmoji(emoji.id, editingEmojiName); }}>
                                        <input
                                          autoFocus
                                          className="w-full max-w-[180px] text-sm font-medium bg-secondary/50 border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring/50"
                                          value={editingEmojiName}
                                          onChange={(e) => setEditingEmojiName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingEmojiId(null); }}
                                          onBlur={() => setTimeout(() => setEditingEmojiId(null), 150)}
                                          maxLength={32}
                                        />
                                      </form>
                                    ) : (
                                      <span className="text-sm font-medium">:{emoji.name}:</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      rounded="xl"
                                      onClick={() => { setEditingEmojiId(emoji.id); setEditingEmojiName(emoji.name); }}
                                      className="text-muted-foreground hover:text-foreground h-7 w-7 p-0"
                                      title="Rename emoji"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      rounded="xl"
                                      onClick={() => deleteServerEmoji(emoji)}
                                      className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                                      title="Delete emoji"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                              <Smile className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <p className="text-sm text-muted-foreground">No custom emojis yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Upload your first emoji above</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-secondary/30 backdrop-blur-sm rounded-xl border border-border/30 p-6 flex flex-col items-center justify-center text-center">
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                        <Shield className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">You do not have permission to manage emojis</p>
                    </div>
                  ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Role Permissions Editor */}
      {editingRolePermissions && server && (
        <Dialog open={!!editingRolePermissions} onOpenChange={(open) => !open && setEditingRolePermissions(null)}>
          <DialogContent className="bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl max-w-2xl max-h-[90vh]">
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
        <AlertDialogContent className="bg-background/95 backdrop-blur-xl border-border/50 rounded-2xl max-w-[calc(100vw-2rem)] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg">Delete Server</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Are you sure you want to delete <strong>{server.name}</strong>? This action cannot be undone. All
              channels, messages, and members will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel className="h-10 rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteServer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-xl"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Server
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
