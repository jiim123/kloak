import { forwardRef, useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  Upload,
  Trash2,
  Ban,
  Crown,
  Shield,
  ShieldCheck,
  User,
  X,
  Palette,
  Plus,
  KeyRound,
  Link2,
  Copy,
  Check,
  Smile,
  GripVertical,
  Download,
  Pencil,
  Search,
  CircleUser,
  ArrowLeft,
} from "lucide-react";
import { useRateLimit } from "@/hooks/useRateLimit";
import { rateLimitToast } from "@/lib/rateLimitToast";

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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button as BaseButton, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUIStore } from "@/stores/uiStore";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useRealtimeMembers } from "@/hooks";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { supabase } from "@/integrations/supabase/client";
import { getCdnUrl } from "@/lib/bunny-upload";
import { secureUpload, secureDelete } from "@/lib/storageUpload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { invalidateServerEmojis } from "@/lib/serverEmojis";
import { invalidateGlobalEmojiCache } from "@/lib/globalEmojiResolver";
import type { ServerRole, ServerMember, CustomServerRole, Permission } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RolePermissionsEditor } from "../modals/RolePermissionsEditor";
import { BulkPermissionButtons } from "@/components/permissions/BulkPermissionButtons";
import { BannerCropModal } from "../modals/BannerCropModal";
import { RoleColorPicker } from "../modals/RoleColorPicker";
import { RoleIconPreview } from "@/components/ui/role-icon-preview";
import { Separator } from "@/components/ui/separator";
import { EmojiGifPicker } from "../modals/EmojiGifPicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const MAX_ICON_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_ICON_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BANNER_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_BANNER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const MAX_EMOJI_SIZE = 1 * 1024 * 1024; // 1MB
const ALLOWED_EMOJI_TYPES = ["image/png", "image/gif", "image/webp", "image/jpeg"];
const EMOJI_NAME_REGEX = /^[a-z0-9_]{2,12}$/;
const MAX_SERVER_EMOJIS = 50;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, ...props }, ref) => (
  <BaseButton ref={ref} className={cn("rounded-[3px]", className)} {...props} />
));
Button.displayName = "ServerSettingsButton";

const serverSettingsSchema = z.object({
  name: z.string().trim().min(1, "Server name is required").max(50, "Server name must be less than 50 characters"),
  about: z.string().trim().max(500, "About server must be less than 500 characters").optional().nullable(),
});

type ServerSettingsForm = z.infer<typeof serverSettingsSchema>;

type PublicationRequirement = {
  key: string;
  label: string;
  met: boolean;
  current: number | boolean;
  required: number | boolean;
  unit: string;
};

type PublicationEligibility = {
  success: boolean;
  eligible?: boolean;
  is_published?: boolean;
  requirements?: PublicationRequirement[];
  unmet_requirements?: string[];
  error?: string;
};

type PendingTabOp = {
  id: string;
  label: string;
  run: () => Promise<void>;
};

type ServerEmojiDraft = { id: string; name: string; file_path: string; preview_url?: string; isPending?: boolean };
type ServerInviteDraft = {
  id: string;
  code: string;
  created_at: string;
  created_by_username: string;
  expires_at?: string | null;
  max_uses?: number | null;
  uses_count?: number;
  revoked_at: string | null;
  revoked_by_username: string | null;
  isPending?: boolean;
};

const getRoleIcon = (role: ServerRole) => {
  switch (role) {
    case "owner":
      return <Crown className="w-4 h-4 text-yellow-500" />;
    case "admin":
      return <ShieldCheck className="w-4 h-4 text-red-500" />;
    case "moderator":
      return <Shield className="w-4 h-4 text-blue-500" />;
    default:
      return <User className="w-4 h-4 text-muted-foreground" />;
  }
};

const getRoleLabel = (role: ServerRole) => {
  return role.charAt(0).toUpperCase() + role.slice(1);
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

// Permission groups and labels for inline editor
// Permission metadata with descriptions and functional status
interface PermissionMeta {
  label: string;
  description: string;
  enabled: boolean; // Whether this permission has backend enforcement
}

const PERMISSION_META: Record<Permission, PermissionMeta> = {
  view_channels: {
    label: "View Channels",
    description: "Allows members to view channels and read messages in them.",
    enabled: true,
  },
  read_message_history: {
    label: "Read Message History",
    description: "Allows members to read previously sent messages in channels.",
    enabled: true,
  },
  send_messages: {
    label: "Send Messages",
    description: "Allows members to send messages in text channels.",
    enabled: true,
  },
  add_reactions: {
    label: "Add Reactions",
    description: "Allows members to add emoji reactions to messages.",
    enabled: true,
  },
  attach_files: {
    label: "Attach Files",
    description: "Allows members to upload files and images in messages.",
    enabled: true,
  },
  embed_links: {
    label: "Embed Links",
    description: "Allows members to post links with embedded previews.",
    enabled: true,
  },
  mention_everyone: {
    label: "Mention @everyone",
    description: "Allows members to use @everyone to notify all members.",
    enabled: true,
  },
  mention_roles: {
    label: "Mention Roles",
    description: "Allows members to mention roles to notify role members.",
    enabled: true,
  },
  use_external_emojis: {
    label: "Use External Emojis",
    description: "Allows members to use emojis from other servers.",
    enabled: true,
  },
  kick_members: {
    label: "Kick Members",
    description: "Allows members to remove other members from the server. They can rejoin with an invite.",
    enabled: true,
  },
  ban_members: {
    label: "Ban Members",
    description: "Allows members to permanently ban other members from the server.",
    enabled: true,
  },
  mute_members: {
    label: "Mute Members",
    description: "Allows members to mute other members, preventing them from sending messages.",
    enabled: true,
  },
  deafen_members: {
    label: "Deafen Members",
    description: "Allows members to deafen other members in voice channels.",
    enabled: false,
  },
  move_members: {
    label: "Move Members",
    description: "Allows members to move other members between voice channels.",
    enabled: false,
  },
  manage_nicknames: {
    label: "Manage Nicknames",
    description: "Allows members to change the nicknames of other members.",
    enabled: true,
  },
  change_nickname: {
    label: "Change Own Nickname",
    description: "Allows members to change their own server nickname.",
    enabled: true,
  },
  manage_channels: {
    label: "Manage Channels",
    description: "Allows members to create, edit, and delete channels and categories.",
    enabled: true,
  },
  manage_messages: {
    label: "Manage Messages",
    description: "Allows members to delete and pin messages from other members.",
    enabled: true,
  },
  pin_messages: {
    label: "Pin Messages",
    description: "Allows members to pin important messages in channels.",
    enabled: true,
  },
  manage_threads: {
    label: "Manage Threads",
    description: "Allows members to manage and moderate forum threads.",
    enabled: false,
  },
  manage_server: {
    label: "Manage Server",
    description: "Allows members to change the server name, icon, banner, and other settings.",
    enabled: true,
  },
  manage_roles: {
    label: "Manage Roles",
    description: "Allows members to create, edit, and assign roles to other members.",
    enabled: true,
  },
  manage_emojis: {
    label: "Manage Emojis",
    description: "Allows members to upload, edit, and delete custom server emojis.",
    enabled: true,
  },
  manage_webhooks: {
    label: "Manage Webhooks",
    description: "Allows members to create, edit, and delete webhooks for integrations.",
    enabled: false,
  },
  manage_invites: {
    label: "Manage Invites",
    description: "Allows members to create and revoke server invite links.",
    enabled: true,
  },
  create_instant_invite: {
    label: "Create Invite",
    description: "Allows members to create invite links for the server.",
    enabled: false,
  },
  transfer_ownership: {
    label: "Transfer Ownership",
    description: "Allows the owner to transfer server ownership to another member.",
    enabled: true,
  },
  connect: { label: "Connect", description: "Allows members to join voice channels and listen.", enabled: true },
  speak: { label: "Speak", description: "Allows members to speak in voice channels.", enabled: true },
  use_voice_activation: {
    label: "Voice Activity",
    description: "Allows members to use voice activity detection instead of push-to-talk.",
    enabled: false,
  },
  use_application_commands: {
    label: "Use Commands",
    description: "Allows members to use bot and application slash commands.",
    enabled: false,
  },
  view_tasks: { label: "View Tasks", description: "Allows members to view tasks in task boards.", enabled: true },
  create_tasks: { label: "Create Tasks", description: "Allows members to create new tasks.", enabled: true },
  edit_own_tasks: { label: "Edit Own Tasks", description: "Allows members to edit tasks they created.", enabled: true },
  edit_all_tasks: { label: "Edit All Tasks", description: "Allows members to edit any task regardless of who created it.", enabled: true },
  assign_tasks: { label: "Assign Tasks", description: "Allows members to assign tasks to other members.", enabled: true },
  change_task_status: { label: "Change Task Status", description: "Allows members to change the status of tasks.", enabled: true },
  delete_tasks: { label: "Delete Tasks", description: "Allows members to delete tasks.", enabled: true },
};

const PERMISSION_GROUPS: Array<{
  label: string;
  description: string;
  permissions: Permission[];
}> = [
  {
    label: "General",
    description: "Basic server access and interaction",
    permissions: ["view_channels", "read_message_history", "send_messages", "add_reactions"],
  },
  {
    label: "Messages",
    description: "Messaging features and content",
    permissions: ["attach_files", "embed_links", "mention_everyone", "mention_roles", "use_external_emojis"],
  },
  {
    label: "Moderation",
    description: "Member management and moderation tools",
    permissions: [
      "kick_members",
      "ban_members",
      "mute_members",
      "deafen_members",
      "move_members",
      "manage_nicknames",
      "change_nickname",
    ],
  },
  {
    label: "Channel Management",
    description: "Channel and message administration",
    permissions: ["manage_channels", "manage_messages", "pin_messages", "manage_threads"],
  },
  {
    label: "Server Administration",
    description: "Server-wide settings and configuration",
    permissions: [
      "manage_server",
      "manage_roles",
      "manage_emojis",
      "manage_webhooks",
      "manage_invites",
      "create_instant_invite",
      "transfer_ownership",
    ],
  },
  {
    label: "Voice",
    description: "Voice channel capabilities",
    permissions: ["connect", "speak", "use_voice_activation"],
  },
  {
    label: "Advanced",
    description: "Bots and application integrations",
    permissions: ["use_application_commands"],
  },
  {
    label: "Tasks",
    description: "Task board management",
    permissions: ["view_tasks", "create_tasks", "edit_own_tasks", "edit_all_tasks", "assign_tasks", "change_task_status", "delete_tasks"],
  },
];
// Inline permissions editor component (without modal wrapper, unified with role details)
const RolePermissionsEditorInline = ({
  role,
  serverId,
  stageRolePermissionsOp,
  initialPermissionStates,
  onPermissionStatesChange,
}: {
  role: CustomServerRole;
  serverId: string;
  stageRolePermissionsOp?: (roleId: string, op: PendingTabOp | null) => void;
  initialPermissionStates?: Map<Permission, boolean | null>;
  onPermissionStatesChange?: (roleId: string, states: Map<Permission, boolean | null>) => void;
}) => {
  const { user } = useAuthStore();
  const { rolePermissions, fetchRolePermissions, setRolePermission, deleteRolePermission } = useServerStore();

  const [permissionStates, setPermissionStates] = useState<Map<Permission, boolean | null>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        await fetchRolePermissions(serverId);
      } catch (error) {
        console.error("Failed to load permissions:", error);
        toast.error("Failed to load permissions");
      } finally {
        setIsLoading(false);
      }
    };

    loadPermissions();
  }, [serverId, user, fetchRolePermissions]);

  useEffect(() => {
    if (initialPermissionStates) {
      setPermissionStates(new Map(initialPermissionStates));
      return;
    }

    const states = new Map<Permission, boolean | null>();

    const allPermissions: Permission[] = Object.keys(PERMISSION_META) as Permission[];

    for (const perm of allPermissions) {
      states.set(perm, null);
    }

    const relevantPermissions = rolePermissions.filter((rp) => rp.role_id === role.id);

    for (const rp of relevantPermissions) {
      states.set(rp.permission, rp.allowed);
    }

    setPermissionStates(states);
  }, [rolePermissions, role, initialPermissionStates]);

  const [confirmAction, setConfirmAction] = useState<{ type: 'deny' | 'allow'; permissions: Permission[] } | null>(null);

  const handlePermissionChange = (permission: Permission, value: boolean | null) => {
    setPermissionStates((prev) => {
      const next = new Map(prev);
      next.set(permission, value);
      return next;
    });
  };

  const handleBulkSet = (permissions: Permission[], value: boolean | null) => {
    setPermissionStates((prev) => {
      const next = new Map(prev);
      for (const perm of permissions) {
        const meta = PERMISSION_META[perm];
        if (meta.enabled) {
          next.set(perm, value);
        }
      }
      return next;
    });
  };

  const allPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions);

  const handleGlobalBulkSet = (value: boolean | null) => {
    if (value !== null) {
      setConfirmAction({ type: value ? 'allow' : 'deny', permissions: allPermissions });
    } else {
      handleBulkSet(allPermissions, null);
    }
  };

  useEffect(() => {
    onPermissionStatesChange?.(role.id, new Map(permissionStates));
  }, [permissionStates, role.id, onPermissionStatesChange]);

  useEffect(() => {
    if (!user || isLoading || !stageRolePermissionsOp) return;

    const currentDbPermissions = rolePermissions.filter((rp) => rp.role_id === role.id);
    const currentDbPermMap = new Map(currentDbPermissions.map((rp) => [rp.permission, rp]));
    const hasChanges = Array.from(permissionStates.entries()).some(([permission, state]) => {
      const currentDb = currentDbPermMap.get(permission);
      if (state === null) return !!currentDb;
      if (!currentDb) return true;
      return currentDb.allowed !== state;
    });

    if (!hasChanges) {
      stageRolePermissionsOp(role.id, null);
      return;
    }

    const op: PendingTabOp = {
      id: `role-perms-${role.id}`,
      label: `Update permissions for ${role.name}`,
      run: async () => {
        const latestDbPermissions = rolePermissions.filter((rp) => rp.role_id === role.id);
        const latestDbPermMap = new Map(latestDbPermissions.map((rp) => [rp.permission, rp]));
        const savePromises: Promise<void>[] = [];
        for (const [permission, state] of permissionStates.entries()) {
          const currentDb = latestDbPermMap.get(permission);
          if (state !== null) {
            if (currentDb) {
              if (currentDb.allowed !== state) {
                savePromises.push(setRolePermission(serverId, user.id, permission, role.id, undefined, state));
              }
            } else {
              savePromises.push(setRolePermission(serverId, user.id, permission, role.id, undefined, state));
            }
          } else if (currentDb) {
            savePromises.push(deleteRolePermission(currentDb.id, user.id));
          }
        }
        await Promise.all(savePromises);
        await fetchRolePermissions(serverId);
      },
    };
    stageRolePermissionsOp(role.id, op);
  }, [permissionStates, rolePermissions, role.id, role.name, serverId, user, isLoading, stageRolePermissionsOp, setRolePermission, deleteRolePermission, fetchRolePermissions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global bulk set */}
      <div className="pb-3 border-b border-border/50">
        <BulkPermissionButtons
          onSet={handleGlobalBulkSet}
          label="Set all permissions:"
        />
      </div>

      {PERMISSION_GROUPS.map((group) => (
        <div key={group.label} className="space-y-1">
          <div className="mb-3">
            <h4 className="text-xs font-mono tracking-tight text-muted-foreground">{group.label}</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
          </div>
          <BulkPermissionButtons
            onSet={(value) => handleBulkSet(group.permissions, value)}
            className="mb-1"
          />
          <div className="space-y-0.5">
            {group.permissions.map((permission) => {
              const meta = PERMISSION_META[permission];
              const state = permissionStates.get(permission);
              const isDisabled = !meta.enabled;

              return (
                <div
                  key={permission}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg transition-colors",
                    isDisabled ? "opacity-50" : "hover:bg-secondary/50",
                  )}
                >
                  <div className="flex-1 min-w-0 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{meta.label}</span>
                      {isDisabled && (
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 h-4 font-medium text-muted-foreground border-muted-foreground/30"
                        >
                          Coming soon
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{meta.description}</p>
                  </div>
                  <div
                    className={cn(
                      "flex bg-secondary/80 rounded-lg p-0.5 border border-border/50 flex-shrink-0",
                      isDisabled && "pointer-events-none",
                    )}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePermissionChange(permission, false)}
                      disabled={isDisabled}
                      className={cn(
                        "h-6 px-2.5 py-1 text-[10px] font-medium",
                        state === false
                          ? "bg-destructive text-destructive-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      ✕
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePermissionChange(permission, null)}
                      disabled={isDisabled}
                      className={cn(
                        "h-6 px-2.5 py-1 text-[10px] font-medium",
                        state === null
                          ? "bg-background text-foreground shadow-sm border border-border"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      /
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePermissionChange(permission, true)}
                      disabled={isDisabled}
                      className={cn(
                        "h-6 px-2.5 py-1 text-[10px] font-medium",
                        state === true
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      ✓
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="pt-1 text-xs text-muted-foreground">
        Permission changes are staged and saved with sidebar Save changes.
      </div>

      {/* Confirmation dialog for global Deny/Allow All */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'deny' ? 'Deny All Permissions?' : 'Allow All Permissions?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to set ALL permissions to {confirmAction?.type === 'deny' ? 'Deny' : 'Allow'}? This will override any individual settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[3px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction) {
                  handleBulkSet(confirmAction.permissions, confirmAction.type === 'allow');
                }
                setConfirmAction(null);
              }}
              className={cn(
                "rounded-[3px]",
                confirmAction?.type === 'deny' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : '',
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
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

export const ServerSettingsPage = () => {
  const { closeServerSettings, isServerSettingsOpen, openModal } = useUIStore();
  const {
    currentServer,
    servers,
    members,
    roles,
    channels,
    categories,
    fetchMembers,
    fetchRoles,
    fetchServers,
    createRole,
    updateRole,
    deleteRole,
    reorderRoles,
    assignRoleToMember,
    removeRoleFromMember,
    setRolePermission,
    fetchRolePermissions,
    updateServer,
    deleteServer,
    kickMember,
    banMember,
    updateMember,
  } = useServerStore();
  const { user } = useAuthStore();
  const isMobile = useIsMobile();
  const checkModLimit = useRateLimit(10, 30_000);

  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [isSavingTabChanges, setIsSavingTabChanges] = useState(false);
  const [pendingTabOps, setPendingTabOps] = useState<Record<string, PendingTabOp[]>>({});

  // Transfer ownership state
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferConfirmName, setTransferConfirmName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [memberDisplayCount, setMemberDisplayCount] = useState(50);
  const [systemChannelJoinId, setSystemChannelJoinId] = useState<string>("");
  const [systemChannelLeaveId, setSystemChannelLeaveId] = useState<string>("");
  const [invites, setInvites] = useState<ServerInviteDraft[]>([]);
  const [pendingInviteDrafts, setPendingInviteDrafts] = useState<ServerInviteDraft[]>([]);
  const [pendingRevokedInviteIds, setPendingRevokedInviteIds] = useState<Set<string>>(new Set());
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);
  const [inviteExpiresIn, setInviteExpiresIn] = useState<string>("never");
  const [inviteMaxUses, setInviteMaxUses] = useState<string>("unlimited");
  const [publicationEligibility, setPublicationEligibility] = useState<PublicationEligibility | null>(null);
  const [isLoadingPublicationEligibility, setIsLoadingPublicationEligibility] = useState(false);
  const [isNsfwDraft, setIsNsfwDraft] = useState(false);
  const [minAccountAgeDraft, setMinAccountAgeDraft] = useState<number>(0);
  const [isPublishedDraft, setIsPublishedDraft] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomServerRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleColor, setRoleColor] = useState("#5865F2");
  const [roleIcon, setRoleIcon] = useState<string>("");
  const [roleIsSelfAssignable, setRoleIsSelfAssignable] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [stagedRoles, setStagedRoles] = useState<CustomServerRole[]>([]);
  const [baselineRoles, setBaselineRoles] = useState<CustomServerRole[]>([]);
  const [stagedRolePermissionStates, setStagedRolePermissionStates] = useState<
    Record<string, Map<Permission, boolean | null>>
  >({});
  const [mobileRoleCreateView, setMobileRoleCreateView] = useState(false);
  const stagedRolesRef = useRef<CustomServerRole[]>([]);
  const baselineRolesRef = useRef<CustomServerRole[]>([]);
  const stagedRolePermissionStatesRef = useRef<Record<string, Map<Permission, boolean | null>>>({});

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
  const roleEditContainerRef = useRef<HTMLDivElement>(null);

  // Track explicit removals so displayUrl becomes null immediately
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
  const [serverEmojis, setServerEmojis] = useState<ServerEmojiDraft[]>([]);
  const emojiInputRef = useRef<HTMLInputElement>(null);
  const [editingEmojiId, setEditingEmojiId] = useState<string | null>(null);
  const [editingEmojiName, setEditingEmojiName] = useState("");
  const [selectedEmojiIds, setSelectedEmojiIds] = useState<Set<string>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isDeletingEmojis, setIsDeletingEmojis] = useState(false);

  // Memoize emoji URLs to prevent regenerating on every render
  const serverEmojisWithUrls = useMemo(() => {
    return serverEmojis.map((emoji) => {
      return { ...emoji, url: emoji.preview_url || getCdnUrl("server-emojis", emoji.file_path) };
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
  const [stagedMembers, setStagedMembers] = useState<ServerMember[]>([]);

  const server = currentServer;

  useEffect(() => {
    stagedRolesRef.current = stagedRoles;
  }, [stagedRoles]);

  useEffect(() => {
    baselineRolesRef.current = baselineRoles;
  }, [baselineRoles]);

  useEffect(() => {
    stagedRolePermissionStatesRef.current = stagedRolePermissionStates;
  }, [stagedRolePermissionStates]);

  useEffect(() => {
    if ((pendingTabOps.roles || []).some((op) => op.id === "roles-sync")) return;
    setBaselineRoles(roles);
    setStagedRoles(roles);
    setStagedRolePermissionStates({});
  }, [roles, pendingTabOps.roles]);

  useEffect(() => {
    if ((pendingTabOps.members || []).length > 0) return;
    setStagedMembers(members);
  }, [members, pendingTabOps.members]);

  const visibleRoles = useMemo(() => stagedRoles, [stagedRoles]);
  const roleIds = useMemo(() => visibleRoles.map((role) => role.id), [visibleRoles]);
  const selectedRole = useMemo(
    () => (selectedRoleId ? stagedRoles.find((role) => role.id === selectedRoleId) || null : null),
    [selectedRoleId, stagedRoles],
  );
  const displayedInvites = useMemo(() => {
    const updated = invites.map((invite) =>
      pendingRevokedInviteIds.has(invite.id)
        ? { ...invite, revoked_at: invite.revoked_at || new Date().toISOString(), revoked_by_username: "Pending" }
        : invite,
    );
    return [...pendingInviteDrafts, ...updated];
  }, [invites, pendingInviteDrafts, pendingRevokedInviteIds]);

  const selectRoleForEditing = (role: CustomServerRole) => {
    setSelectedRoleId(role.id);
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
    setRoleIsSelfAssignable(Boolean(role.is_self_assignable));
    setMobileRoleCreateView(false);
    setTimeout(() => roleEditContainerRef.current?.scrollTo({ top: 0 }), 0);
  };

  const resetRoleEditor = () => {
    setSelectedRoleId(null);
    setEditingRole(null);
    setRoleName("");
    setRoleColor("#5865F2");
    setRoleIcon("");
    setRoleIsSelfAssignable(false);
    setColorType("solid");
    setGradientColors(["#5865F2", "#7289DA"]);
    setGradientAngle(135);
    setMobileRoleCreateView(false);
  };

  const roleSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleRoleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stagedRoles.findIndex((role) => role.id === active.id);
    const newIndex = stagedRoles.findIndex((role) => role.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const nextRoles = arrayMove(stagedRoles, oldIndex, newIndex).map((role, index) => ({ ...role, position: index }));
    setStagedRoles(nextRoles);
    stageRolesSyncOp(nextRoles);
  };

  const RoleRow = ({ role }: { role: CustomServerRole }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: role.id,
      data: { type: "role", role },
    });
    const isSelected = selectedRole?.id === role.id;
    const isGradient = role.color.startsWith("linear-gradient");
    const roleNameStyle = isGradient
      ? ({
          background: role.color,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        } as React.CSSProperties)
      : ({ color: role.color } as React.CSSProperties);
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    } as React.CSSProperties;

    return (
      <div
        ref={setNodeRef}
        style={style}
        role="button"
        tabIndex={0}
        onPointerDown={() => selectRoleForEditing(role)}
        onClick={() => selectRoleForEditing(role)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            selectRoleForEditing(role);
          }
        }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/50 transition-colors cursor-pointer",
          isSelected && "bg-secondary/70 ring-1 ring-primary/50",
          isDragging && "opacity-80 bg-secondary/60 ring-1 ring-primary/30 shadow-md relative z-50",
        )}
      >
        <div
          {...attributes}
          {...listeners}
          className="text-muted-foreground flex-shrink-0 cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={cn("text-sm font-medium truncate", isGradient && "text-transparent")} style={roleNameStyle}>
            {role.name}
          </span>
        </div>
        {role.is_self_assignable && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <CircleUser className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="left">
                <p>This is a self assignable role</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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
  const { hasPermission, canModerate } = useMemberPermissions();
  const canManageServer = hasPermission("manage_server");
  const canManageRoles = hasPermission("manage_roles");
  const canManageChannels = hasPermission("manage_channels");
  const canManageInvites = hasPermission("manage_invites");
  const canManageEmojis = hasPermission("manage_emojis");
  const canKickMembers = hasPermission("kick_members");
  const canBanMembers = hasPermission("ban_members");

  // For backward compatibility and specific checks
  const isOwner = userRole === "owner";
  const isAdmin = userRole === "admin";

  const loadPublicationEligibility = async () => {
    if (!server?.id || !user?.id || !isOwner) {
      setPublicationEligibility(null);
      return;
    }

    setIsLoadingPublicationEligibility(true);
    try {
      const { data, error } = await supabase.rpc("get_server_publication_eligibility", {
        _server_id: server.id,
        _user_id: user.id,
      });

      if (error) throw error;
      setPublicationEligibility((data ?? null) as PublicationEligibility | null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load publication requirements.";
      setPublicationEligibility({ success: false, error: message });
    } finally {
      setIsLoadingPublicationEligibility(false);
    }
  };

  const queueTabOp = (tab: string, label: string, run: () => Promise<void>) => {
    const opId = `${tab}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setPendingTabOps((prev) => ({
      ...prev,
      [tab]: [...(prev[tab] || []), { id: opId, label, run }],
    }));
  };

  const clearTabOps = (tab: string) => {
    setPendingTabOps((prev) => ({ ...prev, [tab]: [] }));
  };

  const stageRolePermissionsOp = (roleId: string, op: PendingTabOp | null) => {
    const opId = `role-perms-${roleId}`;
    setPendingTabOps((prev) => {
      const rolesOps = (prev.roles || []).filter((item) => item.id !== opId);
      return {
        ...prev,
        roles: op ? [...rolesOps, { ...op, id: opId }] : rolesOps,
      };
    });
  };

  const roleFieldsChanged = (a: CustomServerRole, b: CustomServerRole) =>
    a.name !== b.name ||
    a.color !== b.color ||
    (a.icon || null) !== (b.icon || null) ||
    Boolean(a.is_self_assignable) !== Boolean(b.is_self_assignable);

  const handleRolePermissionStatesChange = useCallback((roleId: string, states: Map<Permission, boolean | null>) => {
    setStagedRolePermissionStates((prev) => {
      const current = prev[roleId];
      const unchanged =
        current?.size === states.size &&
        Array.from(states.entries()).every(([permission, state]) => current.get(permission) === state);
      if (unchanged) return prev;
      return { ...prev, [roleId]: new Map(states) };
    });
  }, []);

  const stageRolesSyncOp = (nextRoles: CustomServerRole[]) => {
    const opId = "roles-sync";
    const initialRoles = baselineRolesRef.current;
    const initialById = new Map(initialRoles.map((role) => [role.id, role]));
    const nextById = new Map(nextRoles.map((role) => [role.id, role]));
    const hasRoleChanges =
      initialRoles.some((role) => !nextById.has(role.id)) ||
      nextRoles.some((role, index) => {
        if (role.id.startsWith("pending-role-")) return true;
        const initial = initialById.get(role.id);
        return !initial || roleFieldsChanged(role, initial) || initialRoles[index]?.id !== role.id;
      });

    setPendingTabOps((prev) => {
      const rolesOps = (prev.roles || []).filter((item) => item.id !== opId);
      if (!hasRoleChanges) {
        return { ...prev, roles: rolesOps };
      }

      const op: PendingTabOp = {
        id: opId,
        label: "Update roles",
        run: async () => {
          if (!server?.id || !user?.id) return;
          const currentDraft = stagedRolesRef.current;
          const baseline = baselineRolesRef.current;
          const baselineById = new Map(baseline.map((role) => [role.id, role]));
          const savedIdByDraftId = new Map<string, string>();
          const permissionDrafts = stagedRolePermissionStatesRef.current;

          for (const oldRole of baseline) {
            if (!currentDraft.some((role) => role.id === oldRole.id)) {
              await deleteRole(oldRole.id, user.id);
            }
          }

          for (const draftRole of currentDraft) {
            if (draftRole.id.startsWith("pending-role-")) {
              const created = await createRole(
                server.id,
                user.id,
                draftRole.name,
                draftRole.color,
                draftRole.icon || null,
                Boolean(draftRole.is_self_assignable),
              );
              if (created?.id) {
                savedIdByDraftId.set(draftRole.id, created.id);
                const pendingPermissionStates = permissionDrafts[draftRole.id];
                if (pendingPermissionStates) {
                  const savePromises: Promise<void>[] = [];
                  for (const [permission, state] of pendingPermissionStates.entries()) {
                    if (state !== null) {
                      savePromises.push(setRolePermission(server.id, user.id, permission, created.id, undefined, state));
                    }
                  }
                  await Promise.all(savePromises);
                }
              }
              continue;
            }

            const initial = baselineById.get(draftRole.id);
            if (initial && roleFieldsChanged(draftRole, initial)) {
              const updates: { name?: string; color?: string; icon?: string | null; is_self_assignable?: boolean } = {
                name: draftRole.name,
                color: draftRole.color,
                icon: draftRole.icon || null,
              };
              if (
                draftRole.name !== "@everyone" &&
                Boolean(draftRole.is_self_assignable) !== Boolean(initial.is_self_assignable)
              ) {
                updates.is_self_assignable = Boolean(draftRole.is_self_assignable);
              }
              await updateRole(draftRole.id, user.id, {
                ...updates,
              });
            }
          }

          const orderedRoleIds = currentDraft
            .map((role) => savedIdByDraftId.get(role.id) || role.id)
            .filter((roleId) => !roleId.startsWith("pending-role-"));
          if (orderedRoleIds.length > 0) {
            await reorderRoles(server.id, user.id, orderedRoleIds);
          }
          await fetchRolePermissions(server.id);
        },
      };

      return { ...prev, roles: [op, ...rolesOps] };
    });
  };

  useEffect(() => {
    if (!selectedRole || activeTab !== "roles" || !roleName.trim()) return;

    const finalColor = colorType === "gradient" ? createGradientString(gradientColors, gradientAngle) : roleColor;
    const nextIcon = roleIcon.trim() ? roleIcon.trim() : null;
    const nextSelfAssignable = selectedRole.name === "@everyone" ? false : Boolean(roleIsSelfAssignable);
    const current = stagedRoles.find((role) => role.id === selectedRole.id);
    if (!current) return;

    const hasChanges =
      current.name !== roleName.trim() ||
      current.color !== finalColor ||
      (current.icon || null) !== nextIcon ||
      Boolean(current.is_self_assignable) !== nextSelfAssignable;

    if (!hasChanges) return;

    const nextRoles = stagedRoles.map((role) =>
      role.id === selectedRole.id
        ? {
            ...role,
            name: roleName.trim(),
            color: finalColor,
            icon: nextIcon,
            is_self_assignable: nextSelfAssignable,
          }
        : role,
    );
    setStagedRoles(nextRoles);
    stageRolesSyncOp(nextRoles);
  }, [
    activeTab,
    selectedRole,
    roleName,
    roleColor,
    roleIcon,
    roleIsSelfAssignable,
    colorType,
    gradientColors,
    gradientAngle,
    stagedRoles,
  ]);

  const saveActiveTabChanges = async () => {
    if (!server || !user) return;

    if (activeTab === "overview") {
      await handleSubmit(onSubmit)();
      return;
    }

    const ops = pendingTabOps[activeTab] || [];
    if (!ops.length) return;

    setIsSavingTabChanges(true);
    try {
      for (const op of ops) {
        await op.run();
      }
      clearTabOps(activeTab);
      await fetchServers(user.id);
      if (activeTab === "roles") {
        await fetchRoles(server.id);
        const refreshedRoles = useServerStore.getState().roles;
        setBaselineRoles(refreshedRoles);
        setStagedRoles(refreshedRoles);
      }
      if (activeTab === "members") {
        await fetchMembers(server.id, { force: true, full: true });
        setStagedMembers(useServerStore.getState().members);
      }
      if (activeTab === "invites") {
        await loadInvites();
        setPendingInviteDrafts([]);
        setPendingRevokedInviteIds(new Set());
      }
      if (activeTab === "bans") {
        const { data } = await supabase.rpc("get_banned_members", {
          _server_id: server.id,
          _user_id: user.id,
        });
        setBannedMembers((data ?? []) as any);
      }
      if (activeTab === "emojis") {
        const { data } = await supabase
          .from("server_emojis")
          .select("id, name, file_path")
          .eq("server_id", server.id)
          .order("created_at", { ascending: true });
        setServerEmojis((data ?? []) as ServerEmojiDraft[]);
      }
      toast.success("Changes saved");
    } catch (error: any) {
      toast.error(error?.message || "Failed to save changes");
    } finally {
      setIsSavingTabChanges(false);
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    getValues,
    reset,
  } = useForm<ServerSettingsForm>({
    resolver: zodResolver(serverSettingsSchema),
    defaultValues: { name: server?.name || "", about: server?.about || "" },
  });

  const resetActiveTabChanges = async () => {
    if (!server) return;

    clearTabOps(activeTab);

    if (activeTab === "overview") {
      reset({ name: server.name, about: server.about || "" });
      setSystemChannelJoinId(server.system_channel_join_id || "");
      setSystemChannelLeaveId(server.system_channel_leave_id || "");
      setIsNsfwDraft(!!server.is_nsfw);
      setMinAccountAgeDraft(Number(server.min_account_age_days || 0));
      setIsPublishedDraft(!!server.is_published);
      setIconFile(null);
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
      setBannerFile(null);
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      setBannerPreview(null);
      setIconRemoved(false);
      setBannerRemoved(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (bannerInputRef.current) bannerInputRef.current.value = "";
      return;
    }

    if (activeTab === "roles") {
      const restoredRoles = baselineRolesRef.current;
      setStagedRoles(restoredRoles);
      setStagedRolePermissionStates({});
      resetRoleEditor();
      return;
    }

    if (activeTab === "members") {
      setStagedMembers(members);
      return;
    }

    if (activeTab === "invites") {
      setPendingInviteDrafts([]);
      setPendingRevokedInviteIds(new Set());
      return;
    }

    if (activeTab === "emojis") {
      clearEmoji();
      setEditingEmojiId(null);
      setEditingEmojiName("");
      setSelectedEmojiIds(new Set());
      setIsMultiSelectMode(false);
      if (server.id) {
        const { data } = await supabase
          .from("server_emojis")
          .select("id, name, file_path")
          .eq("server_id", server.id)
          .order("created_at", { ascending: true });
        setServerEmojis((data ?? []) as ServerEmojiDraft[]);
      }
      return;
    }

    if (activeTab === "bans" && user?.id) {
      const { data } = await supabase.rpc("get_banned_members", {
        _server_id: server.id,
        _user_id: user.id,
      });
      setBannedMembers((data ?? []) as any);
    }
  };

  // Real-time members updates
  useRealtimeMembers(server ? server.id : null, { full: activeTab === "members" });

  // Load + subscribe to banned members for the Bans tab
  useEffect(() => {
    if (!isServerSettingsOpen) return;
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
  }, [isServerSettingsOpen, server?.id, user?.id]);

  useEffect(() => {
    if (!isServerSettingsOpen) return;
    void loadPublicationEligibility();
  }, [isServerSettingsOpen, server?.id, user?.id, isOwner]);

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

  // ESC key to close server settings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeServerSettings();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeServerSettings]);

  // Fetch roles and initialize settings when page opens
  useEffect(() => {
    if (server) {
      fetchRoles(server.id);
      const pendingTab = localStorage.getItem("kloak:server-settings-tab");
      if (pendingTab) {
        setActiveTab(pendingTab);
        localStorage.removeItem("kloak:server-settings-tab");
      }
      reset({ name: server.name, about: server.about || "" });

      // Initialize system message channel settings
      setSystemChannelJoinId(server.system_channel_join_id || "");
      setSystemChannelLeaveId(server.system_channel_leave_id || "");
      setIsNsfwDraft(!!server.is_nsfw);
      setMinAccountAgeDraft(Number(server.min_account_age_days || 0));
      setIsPublishedDraft(!!server.is_published);
      setPendingTabOps({});
      setBaselineRoles(roles);
      setStagedRoles(roles);
      setStagedMembers(members);
      setPendingInviteDrafts([]);
      setPendingRevokedInviteIds(new Set());

      // Reset icon state
      setIconFile(null);
      setIconPreview(null);
      // Reset banner state
      setBannerFile(null);
      setBannerPreview(null);
      // Reset emoji state
      setEmojiFile(null);
      setEmojiName("");
      if (emojiPreview) {
        URL.revokeObjectURL(emojiPreview);
      }
      setEmojiPreview(null);
      setServerEmojis([]);
      setIconRemoved(false);
      setBannerRemoved(false);
      // Reset role form
      setEditingRole(null);
      setRoleName("");
      setRoleColor("#5865F2");
      setRoleIcon("");
      setRoleIsSelfAssignable(false);
      setSelectedRoleId(null);
      setColorType("solid");
      setGradientColors(["#5865F2", "#7289DA"]);
      setGradientAngle(135);
    }
  }, [server, fetchRoles, reset]);

  // Load full member roster only when the Members tab is active.
  useEffect(() => {
    if (!server?.id) return;
    if (activeTab !== "members") return;
    fetchMembers(server.id, { full: true });
  }, [server?.id, activeTab, fetchMembers]);

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
      setInvites((data ?? []) as ServerInviteDraft[]);
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
        const { data, error } = await supabase.rpc("list_server_invites", {
          _server_id: server.id,
          _user_id: user.id,
        });

        if (error) throw error;
        if (cancelled) return;
        setInvites((data ?? []) as ServerInviteDraft[]);
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

  // Load server emojis when settings open
  useEffect(() => {
    if (!isServerSettingsOpen) return;
    if (!server?.id) return;
    if (!canManageEmojis) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from("server_emojis")
          .select("id, name, file_path")
          .eq("server_id", server.id)
          .order("created_at", { ascending: true });

        if (error) throw error;
        if (cancelled) return;
        setServerEmojis((data ?? []) as ServerEmojiDraft[]);
      } catch {
        if (!cancelled) setServerEmojis([]);
      }
    })();

    const handleEmojisChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.serverId === server?.id) {
        (async () => {
          const { data } = await supabase
            .from("server_emojis")
            .select("id, name, file_path")
            .eq("server_id", server!.id)
            .order("created_at", { ascending: true });
          setServerEmojis((data ?? []) as ServerEmojiDraft[]);
        })();
      }
    };
    window.addEventListener("server-emojis-changed", handleEmojisChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("server-emojis-changed", handleEmojisChanged);
    };
  }, [isServerSettingsOpen, server?.id, canManageEmojis]);

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

    queueTabOp("invites", "Create invite", async () => {
      const { error } = await supabase.rpc("create_server_invite", {
        _server_id: server.id,
        _user_id: user.id,
        _expires_in_seconds: expiresInSeconds,
        _max_uses: maxUsesValue,
      });
      if (error) throw error;
    });
    setPendingInviteDrafts((prev) => [
      {
        id: `pending-invite-${crypto.randomUUID()}`,
        code: "Pending",
        created_at: new Date().toISOString(),
        created_by_username: "You",
        expires_at: null,
        max_uses: maxUsesValue,
        uses_count: 0,
        revoked_at: null,
        revoked_by_username: null,
        isPending: true,
      },
      ...prev,
    ]);
  };

  const revokeInvite = async (inviteId: string) => {
    if (!server?.id || !user?.id) return;
    if (!canManageInvites) return;
    if (!confirm("Revoke this invite?")) return;

    queueTabOp("invites", "Revoke invite", async () => {
      const { error } = await supabase.rpc("revoke_server_invite", {
        _invite_id: inviteId,
        _user_id: user.id,
      });
      if (error) throw error;
    });
    setPendingRevokedInviteIds((prev) => {
      const next = new Set(prev);
      next.add(inviteId);
      return next;
    });
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

    // Enforce 50 emoji cap (also enforced in DB via trigger)
    try {
      const { count, error } = await supabase
        .from("server_emojis")
        .select("*", { count: "exact", head: true })
        .eq("server_id", server.id);

      if (error) throw error;
      if ((count ?? 0) + serverEmojis.filter((emoji) => emoji.isPending).length >= MAX_SERVER_EMOJIS) {
        toast.error(`This server already has ${MAX_SERVER_EMOJIS} custom emojis`);
        return;
      }
    } catch (e) {
      console.error("Failed to check emoji limit:", e);
      // If we can't verify, don't allow upload (safer for team-shared)
      toast.error("Unable to verify emoji limit. Please try again.");
      return;
    }

    const normalized = emojiName.trim().toLowerCase();
    if (!EMOJI_NAME_REGEX.test(normalized)) {
      toast.error("Emoji name must be 2-12 characters (a-z, 0-9, underscore)");
      return;
    }

    const selectedFile = emojiFile;
    const previewUrl = emojiPreview;
    queueTabOp("emojis", `Upload emoji :${normalized}:`, async () => {
      const ext = (selectedFile.name.split(".").pop() || "png").toLowerCase();
      const filePath = `${server.id}/${normalized}-${crypto.randomUUID()}.${ext}`;
      await secureUpload("server-emojis", filePath, selectedFile, {
        contentType: selectedFile.type,
        upsert: false,
      });
      const { error: insertError } = await (supabase.rpc as any)("upload_server_emoji", {
        _server_id: server.id,
        _user_id: user.id,
        _name: normalized,
        _file_path: filePath,
      });
      if (insertError) throw insertError;
      invalidateServerEmojis(server.id);
      invalidateGlobalEmojiCache();
      window.dispatchEvent(new CustomEvent("server-emojis-changed", { detail: { serverId: server.id } }));
    });
    setServerEmojis((prev) => [
      ...prev,
      {
        id: `pending-emoji-${crypto.randomUUID()}`,
        name: normalized,
        file_path: "",
        preview_url: previewUrl || undefined,
        isPending: true,
      },
    ]);
    setEmojiFile(null);
    setEmojiName("");
    setEmojiPreview(null);
    if (emojiInputRef.current) {
      emojiInputRef.current.value = "";
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
      toast.error("Emoji name must be 2-12 lowercase letters, numbers, or underscores");
      return;
    }
    if (serverEmojis.some((e) => e.name === trimmed && e.id !== emojiId)) {
      toast.error("That emoji name is already taken");
      return;
    }
    queueTabOp("emojis", `Rename emoji to :${trimmed}:`, async () => {
      const { error } = await (supabase.rpc as any)("rename_server_emoji", {
        _emoji_id: emojiId,
        _user_id: user.id,
        _new_name: trimmed,
      });
      if (error) throw error;
      invalidateServerEmojis(server.id);
      invalidateGlobalEmojiCache();
      window.dispatchEvent(new CustomEvent("server-emojis-changed", { detail: { serverId: server.id } }));
    });
    setServerEmojis((prev) => prev.map((e) => (e.id === emojiId ? { ...e, name: trimmed } : e)));
    setEditingEmojiId(null);
  };

  const deleteServerEmoji = async (emoji: { id: string; name: string; file_path: string }) => {
    if (!server) return;
    if (!canManageEmojis) {
      toast.error("You do not have permission to manage emojis");
      return;
    }
    if (!confirm(`Delete emoji "${emoji.name}"?`)) return;

    queueTabOp("emojis", `Delete emoji :${emoji.name}:`, async () => {
      const { data: filePath, error } = await (supabase.rpc as any)("delete_server_emoji", {
        _emoji_id: emoji.id,
        _user_id: user.id,
      });
      if (error) throw error;
      if (filePath) await secureDelete("server-emojis", filePath as string);
      invalidateServerEmojis(server.id);
      invalidateGlobalEmojiCache();
      window.dispatchEvent(new CustomEvent("server-emojis-changed", { detail: { serverId: server.id } }));
    });
    setServerEmojis((prev) => prev.filter((e) => e.id !== emoji.id));
  };

  const bulkDeleteEmojis = async () => {
    if (!server || !user || selectedEmojiIds.size === 0) return;
    if (
      !confirm(`Delete ${selectedEmojiIds.size} emoji${selectedEmojiIds.size > 1 ? "s" : ""}? This cannot be undone.`)
    )
      return;

    const ids = Array.from(selectedEmojiIds);
    queueTabOp("emojis", `Delete ${ids.length} selected emojis`, async () => {
      for (const emojiId of ids) {
        const { data: filePath, error } = await (supabase.rpc as any)("delete_server_emoji", {
          _emoji_id: emojiId,
          _user_id: user.id,
        });
        if (error) throw error;
        if (filePath) await secureDelete("server-emojis", filePath as string);
      }
      invalidateServerEmojis(server.id);
      invalidateGlobalEmojiCache();
      window.dispatchEvent(new CustomEvent("server-emojis-changed", { detail: { serverId: server.id } }));
    });
    setServerEmojis((prev) => prev.filter((e) => !selectedEmojiIds.has(e.id)));
    setSelectedEmojiIds(new Set());
    setIsMultiSelectMode(false);
  };

  const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_ICON_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, or WebP image");
      return;
    }

    if (file.size > MAX_ICON_SIZE) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
    setIconRemoved(false);
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
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${serverId}/icon-${Date.now()}.${ext}`;

    try {
      const result = await secureUpload("server-icons", filePath, file, { upsert: true });
      return result.publicUrl;
    } catch (err) {
      console.error("Failed to upload icon:", err);
      return null;
    }
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_BANNER_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, WebP, or GIF image");
      return;
    }

    if (file.size > MAX_BANNER_SIZE) {
      toast.error("Image must be less than 8MB");
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
      setBannerFile(compressed);
      // staged until sidebar Save changes
    } catch (err) {
      console.error("Failed to upload banner:", err);
      toast.error("Failed to process server banner");
      URL.revokeObjectURL(preview);
      setBannerPreview(null);
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
    const ext = file.name.split(".").pop() || "png";
    const filePath = `${serverId}/banner-${Date.now()}.${ext}`;

    try {
      const result = await secureUpload("server-icons", filePath, file, { upsert: true });
      return result.publicUrl;
    } catch (err) {
      console.error("Failed to upload banner:", err);
      return null;
    }
  };

  const handleRemoveBanner = async () => {
    if (!server || !user) return;
    setBannerPreview(null);
    setBannerFile(null);
    setBannerRemoved(true);
    // staged until sidebar Save changes
  };

  const handleRemoveIcon = async () => {
    if (!server || !user) return;
    setIconPreview(null);
    setIconFile(null);
    setIconRemoved(true);
    // staged until sidebar Save changes
  };

  const onSubmit = async (data: ServerSettingsForm) => {
    if (!server || !user) return;

    setIsLoading(true);
    try {
      let iconUrl = iconRemoved ? null : server.icon_url;
      let bannerUrl = bannerRemoved ? null : server.banner_url;

      // Upload new icon if selected
      if (iconFile) {
        setIsUploadingIcon(true);
        const uploadedUrl = await uploadIcon(server.id, iconFile);
        if (uploadedUrl) {
          iconUrl = uploadedUrl;
        }
        setIsUploadingIcon(false);
      }

      if (bannerFile) {
        setIsUploadingBanner(true);
        const uploadedBannerUrl = await uploadBanner(server.id, bannerFile);
        if (uploadedBannerUrl) {
          bannerUrl = uploadedBannerUrl;
        }
        setIsUploadingBanner(false);
      }

      const aboutValue = (data.about || "").trim();

      // Always include system message fields explicitly, even if null
      const updates: any = {
        name: data.name,
      };

      if (iconUrl !== undefined) {
        updates.icon_url = iconUrl;
      }
      if (bannerUrl !== undefined) {
        updates.banner_url = bannerUrl;
      }
      if (aboutValue !== undefined) {
        updates.about = aboutValue || null;
      }

      // Always include system message fields
      updates.system_channel_join_id = systemChannelJoinId || null;
      updates.system_channel_leave_id = systemChannelLeaveId || null;
      updates.enable_join_messages = !!systemChannelJoinId;
      updates.enable_leave_messages = !!systemChannelLeaveId;
      updates.is_nsfw = !!isNsfwDraft;
      updates.min_account_age_days = Number(minAccountAgeDraft || 0);
      updates.is_published = !!isPublishedDraft;

      await updateServer(server.id, user.id, updates);

      // Refresh server data to get updated fields
      await fetchServers(user.id);

      // Update local state from the refreshed server data
      const updatedServer = useServerStore.getState().currentServer;
      if (updatedServer) {
        reset({ name: updatedServer.name, about: updatedServer.about || "" });
        setSystemChannelJoinId(updatedServer.system_channel_join_id || "");
        setSystemChannelLeaveId(updatedServer.system_channel_leave_id || "");
        setIsNsfwDraft(!!updatedServer.is_nsfw);
        setMinAccountAgeDraft(Number(updatedServer.min_account_age_days || 0));
        setIsPublishedDraft(!!updatedServer.is_published);
      }

      await loadPublicationEligibility();

      toast.success("Server settings updated!");
      clearIcon();
      clearBanner();
      clearTabOps("overview");
    } catch (error) {
      toast.error("Failed to update server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteServer = async () => {
    if (!server) return;

    setIsLoading(true);
    try {
      await deleteServer(server.id);
      toast.success("Server deleted");
      setShowDeleteConfirm(false);
      closeServerSettings();
    } catch (error) {
      toast.error("Failed to delete server");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKickMember = async (member: ServerMember) => {
    if (!server) return;
    if (!checkModLimit()) { rateLimitToast("Moderation actions too fast"); return; }
    queueTabOp("members", `Kick ${member.user?.username || "user"}`, async () => {
      await kickMember(server.id, member.user_id);
    });
    setStagedMembers((prev) => prev.filter((item) => item.id !== member.id));
  };

  const handleBanMember = async (member: ServerMember) => {
    if (!server) return;
    if (!checkModLimit()) { rateLimitToast("Moderation actions too fast"); return; }
    queueTabOp("members", `Ban ${member.user?.username || "user"}`, async () => {
      await banMember(server.id, member.user_id);
    });
    setStagedMembers((prev) => prev.filter((item) => item.id !== member.id));
  };

  const handleCreateRole = async () => {
    if (!server || !user || !roleName.trim()) return;

    const finalColor = colorType === "gradient" ? createGradientString(gradientColors, gradientAngle) : roleColor;
    const draftRole: CustomServerRole = {
      id: `pending-role-${crypto.randomUUID()}`,
      server_id: server.id,
      name: roleName.trim(),
      color: finalColor,
      icon: roleIcon.trim() ? roleIcon.trim() : null,
      is_self_assignable: roleIsSelfAssignable,
      position: stagedRoles.length,
      created_at: new Date().toISOString(),
    };
    const nextRoles = [...stagedRoles, draftRole];
    setStagedRoles(nextRoles);
    setSelectedRoleId(draftRole.id);
    setEditingRole(draftRole);
    stageRolesSyncOp(nextRoles);
    if (isMobile) setMobileRoleCreateView(false);
  };

  const handleUpdateRole = async () => {
    if (!server || !user || !selectedRole || !roleName.trim()) return;

    const finalColor = colorType === "gradient" ? createGradientString(gradientColors, gradientAngle) : roleColor;
    const nextSelfAssignable = Boolean(roleIsSelfAssignable);
    const currentSelfAssignable = Boolean(selectedRole.is_self_assignable);
    const selfAssignableChanged = nextSelfAssignable !== currentSelfAssignable;

    const updates: { name?: string; color?: string; icon?: string | null; is_self_assignable?: boolean } = {
      name: roleName.trim(),
      color: finalColor,
      icon: roleIcon.trim() ? roleIcon.trim() : null,
    };

    if (selfAssignableChanged) {
      updates.is_self_assignable = nextSelfAssignable;
    }
    const nextRoles = stagedRoles.map((role) =>
      role.id === selectedRole.id
        ? {
            ...role,
            name: updates.name ?? role.name,
            color: updates.color ?? role.color,
            icon: updates.icon !== undefined ? updates.icon : role.icon,
            is_self_assignable:
              updates.is_self_assignable !== undefined ? updates.is_self_assignable : role.is_self_assignable,
          }
        : role,
    );
    setStagedRoles(nextRoles);
    setEditingRole(nextRoles.find((role) => role.id === selectedRole.id) || null);
    stageRolesSyncOp(nextRoles);
  };

  const handleDeleteRole = async (role: CustomServerRole) => {
    if (!server || !user) return;

    if (!confirm(`Are you sure you want to delete the role "${role.name}"?`)) return;

    const nextRoles = stagedRoles.filter((item) => item.id !== role.id).map((item, index) => ({ ...item, position: index }));
    setStagedRoles(nextRoles);
    stageRolesSyncOp(nextRoles);
    setSelectedRoleId(null);
    setEditingRole(null);
    setRoleName("");
    setRoleColor("#5865F2");
    setRoleIcon("");
    setRoleIsSelfAssignable(false);
    setColorType("solid");
    setGradientColors(["#5865F2", "#7289DA"]);
    setGradientAngle(135);
  };

  const handleAssignRole = async (member: ServerMember, role: CustomServerRole) => {
    if (!server || !user) return;

    queueTabOp("members", `Assign ${role.name} to ${member.user?.username || "user"}`, async () => {
      await assignRoleToMember(member.id, role.id, user.id);
    });
    setStagedMembers((prev) =>
      prev.map((item) =>
        item.id === member.id
          ? {
              ...item,
              roles: (item.roles || []).some((existing) => existing.id === role.id)
                ? item.roles || []
                : [...(item.roles || []), role].sort((a, b) => a.position - b.position),
            }
          : item,
      ),
    );
  };

  const handleRemoveRole = async (member: ServerMember, role: CustomServerRole) => {
    if (!server || !user) return;

    queueTabOp("members", `Remove ${role.name} from ${member.user?.username || "user"}`, async () => {
      await removeRoleFromMember(member.id, role.id, user.id);
    });
    setStagedMembers((prev) =>
      prev.map((item) =>
        item.id === member.id ? { ...item, roles: (item.roles || []).filter((existing) => existing.id !== role.id) } : item,
      ),
    );
  };

  if (!server) {
    return null;
  }

  // Determine which icon to show
  const displayIconUrl = iconRemoved ? null : iconPreview || server.icon_url;
  // Determine which banner to show
  const displayBannerUrl = bannerRemoved ? null : bannerPreview || server.banner_url;
  const overviewDirty =
    isDirty ||
    systemChannelJoinId !== (server.system_channel_join_id || "") ||
    systemChannelLeaveId !== (server.system_channel_leave_id || "") ||
    isNsfwDraft !== !!server.is_nsfw ||
    minAccountAgeDraft !== Number(server.min_account_age_days || 0) ||
    isPublishedDraft !== !!server.is_published ||
    !!iconFile ||
    !!bannerFile ||
    iconRemoved ||
    bannerRemoved;
  const activeTabPendingCount = (pendingTabOps[activeTab] || []).length;
  const showSidebarSave = activeTab === "overview" ? overviewDirty : activeTabPendingCount > 0;

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

      <div className="server-settings-reference h-full flex bg-[#363944] text-[#dbdee1]">
        {/* Sidebar Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex overflow-hidden">
          <div className="w-[250px] flex-shrink-0 bg-[#171a1f] flex flex-col overflow-hidden">
            {/* Server Name Header */}
            <div className="px-[30px] pt-[32px] pb-[12px]">
              <h2 className="text-xs font-medium uppercase tracking-widest text-[#a9adb7] truncate">
                Server settings
              </h2>
            </div>

            {/* Nav Items */}
            <ScrollArea className="flex-1 pb-6">
              <TabsList className="flex flex-col items-start w-full bg-transparent p-0 gap-0 rounded-none h-auto">
                {/* Overview */}
                <TabsTrigger
                  value="overview"
                  className="w-full h-9 justify-start rounded-none px-[30px] py-0 text-sm font-medium leading-none text-[#d7d9df] data-[state=active]:bg-[#2b2e34] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:hover:bg-[#202329] data-[state=inactive]:hover:text-white transition-colors"
                >
                  Overview
                </TabsTrigger>

                {canManageEmojis && (
                  <TabsTrigger
                    value="emojis"
                    className="w-full h-9 justify-start rounded-none px-[30px] py-0 text-sm font-medium leading-none text-[#d7d9df] data-[state=active]:bg-[#2b2e34] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:hover:bg-[#202329] data-[state=inactive]:hover:text-white transition-colors"
                  >
                    Emojis
                  </TabsTrigger>
                )}

                <TabsTrigger
                  value="roles"
                  className="w-full h-9 justify-start rounded-none px-[30px] py-0 text-sm font-medium leading-none text-[#d7d9df] data-[state=active]:bg-[#2b2e34] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:hover:bg-[#202329] data-[state=inactive]:hover:text-white transition-colors"
                >
                  Roles
                </TabsTrigger>
                {canManageInvites && (
                  <TabsTrigger
                    value="invites"
                    className="w-full h-9 justify-start rounded-none px-[30px] py-0 text-sm font-medium leading-none text-[#d7d9df] data-[state=active]:bg-[#2b2e34] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:hover:bg-[#202329] data-[state=inactive]:hover:text-white transition-colors"
                  >
                    Invites
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="members"
                  className="w-full h-9 justify-start rounded-none px-[30px] py-0 text-sm font-medium leading-none text-[#d7d9df] data-[state=active]:bg-[#2b2e34] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:hover:bg-[#202329] data-[state=inactive]:hover:text-white transition-colors"
                >
                  Members
                </TabsTrigger>
                <TabsTrigger
                  value="bans"
                  className="w-full h-9 justify-start rounded-none px-[30px] py-0 text-sm font-medium leading-none text-[#d7d9df] data-[state=active]:bg-[#2b2e34] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:hover:bg-[#202329] data-[state=inactive]:hover:text-white transition-colors"
                >
                  Bans
                </TabsTrigger>

                {canManageChannels && (
                  <TabsTrigger
                    value="integrations"
                    className="w-full h-9 justify-start rounded-none px-[30px] py-0 text-sm font-medium leading-none text-[#d7d9df] data-[state=active]:bg-[#2b2e34] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:hover:bg-[#202329] data-[state=inactive]:hover:text-white transition-colors"
                  >
                    Integrations
                  </TabsTrigger>
                )}

                {/* Transfer Ownership & Delete Server - at bottom, separated */}
                {isOwner && (
                  <>
                    <Separator className="my-5 bg-[#2b2e34]" />
                    <TabsTrigger
                      value="transfer"
                      className="w-full h-9 justify-start rounded-none px-[30px] py-0 text-sm font-medium leading-none text-[#d7d9df] data-[state=active]:bg-[#2b2e34] data-[state=active]:text-white data-[state=active]:shadow-none data-[state=inactive]:hover:bg-[#202329] data-[state=inactive]:hover:text-white transition-colors"
                    >
                      Transfer Ownership
                    </TabsTrigger>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="!flex !h-9 !w-full !justify-start !gap-0 !rounded-none !bg-transparent !px-[30px] !py-0 !text-left !text-sm !font-medium !leading-none !text-[#f05d5d] hover:!bg-[#202329] hover:!text-[#ff7373] sm:!text-sm"
                    >
                      Delete Server
                    </Button>
                  </>
                )}
              </TabsList>
            </ScrollArea>

            {showSidebarSave && (
              <div className="px-4 pb-4 pt-2 border-t border-[#2b2e34] space-y-2">
                <Button
                  type="button"
                  onClick={saveActiveTabChanges}
                  disabled={isSavingTabChanges || isLoading || isUploadingIcon || isUploadingBanner}
                  className="w-full h-9 bg-[#f1c40f] hover:bg-[#ddb40d] text-[#1a1c21] font-semibold"
                >
                  {(isSavingTabChanges || isLoading || isUploadingIcon || isUploadingBanner) && (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  )}
                  Save changes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void resetActiveTabChanges()}
                  className="w-full h-7 bg-transparent text-xs text-[#9ea2ad] hover:bg-[#202329] hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-y-auto relative bg-[#363944]">
            {/* Close Button (ESC) */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={closeServerSettings}
              className="absolute top-[48px] right-[46px] z-10 h-10 w-10 bg-transparent text-[#aeb1bb] hover:bg-[#202329] hover:text-white"
              aria-label="Close server settings"
            >
              <X className="w-7 h-7" />
            </Button>

            {/* Overview Tab */}
            <TabsContent value="overview" className="m-0 px-[40px] py-[32px] pr-[84px]">
              <h2 className="text-[20px] leading-7 font-bold mb-[26px] text-white">Overview</h2>
              <form id="server-settings-overview-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-w-3xl">
                {/* Server Information */}
                <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-4">
                  <Label className="text-sm font-medium">Server Information</Label>

                  <div className="flex flex-col sm:flex-row gap-5">
                    {/* Server Icon */}
                    <div className="flex flex-col items-start gap-2">
                      <Label className="text-xs text-muted-foreground">Server Icon</Label>
                      <div className="relative">
                        <div
                          onClick={() => canManageServer && fileInputRef.current?.click()}
                          className={cn(
                            "w-20 h-20 rounded-2xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 transition-colors flex-shrink-0 overflow-hidden",
                            canManageServer && "cursor-pointer hover:border-primary",
                          )}
                        >
                          {displayIconUrl ? (
                            <img src={displayIconUrl} alt={server.name} className="w-full h-full object-cover" />
                          ) : (
                            <Upload className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                        {canManageServer && displayIconUrl && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (iconPreview) {
                                clearIcon();
                              } else {
                                handleRemoveIcon();
                              }
                            }}
                            disabled={isUploadingIcon}
                            className="absolute -top-1 -right-1 h-6 w-6 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">Recommended 512×512</p>
                    </div>

                    {/* Server Name */}
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="serverName" className="text-xs text-muted-foreground">
                        Server Name
                      </Label>
                      <Input
                        id="serverName"
                        {...register("name")}
                        className={cn("h-10 text-sm", errors.name ? "border-destructive" : "")}
                        disabled={!canManageServer}
                      />
                      {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                    </div>
                  </div>

                  {/* Server Banner */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Server Banner</Label>
                    <div className="relative">
                      <div
                        onClick={() => canManageServer && bannerInputRef.current?.click()}
                        className={cn(
                          "flex h-32 w-full items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-muted-foreground/50 bg-secondary transition-colors sm:h-36",
                          canManageServer && "cursor-pointer hover:border-primary",
                        )}
                      >
                        {displayBannerUrl ? (
                          <>
                            <img src={displayBannerUrl} alt="Server banner" className="h-full w-full object-cover" />
                            {isUploadingBanner && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                                <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                            <Upload className="h-5 w-5" />
                            <span className="text-xs">Click to upload banner</span>
                          </div>
                        )}
                      </div>
                      {canManageServer && displayBannerUrl && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (bannerPreview) {
                              clearBanner();
                            } else {
                              handleRemoveBanner();
                            }
                          }}
                          disabled={isUploadingBanner}
                          className="absolute right-2 top-2 h-7 w-7 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {canManageServer ? "Recommended 960x540 - shown in server list" : "Shown in server list"}
                    </p>
                  </div>

                  {/* Server Description */}
                  <div className="space-y-2">
                    <Label htmlFor="serverAbout" className="text-xs text-muted-foreground">
                      Server Description
                    </Label>
                    <Textarea
                      id="serverAbout"
                      {...register("about")}
                      className={cn("min-h-[100px] text-sm resize-none", errors.about ? "border-destructive" : "")}
                      disabled={!canManageServer}
                      placeholder="Tell people what your server is about..."
                      maxLength={500}
                    />
                    {errors.about && <p className="text-xs text-destructive">{errors.about.message}</p>}
                    <p className="text-xs text-muted-foreground">
                      This description will be shown in the Explore page (if public) and server overview.
                    </p>
                  </div>
                </div>


                {/* Age-Restricted Server (owner-only) */}
                {isOwner && (
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                    <Label className="text-sm font-medium">Age-Restricted Server (NSFW)</Label>
                    <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Mark as NSFW</p>
                        <p className="text-xs text-muted-foreground">
                          Mark this server as containing age-restricted content. Users must enable NSFW in their settings to see this server in Explore.
                        </p>
                      </div>
                      <Switch
                        checked={isNsfwDraft}
                        onCheckedChange={setIsNsfwDraft}
                        disabled={isLoading || isUploadingIcon || isUploadingBanner}
                      />
                    </div>
                  </div>
                )}

                {/* Minimum Account Age */}
                {canManageServer && (
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                    <Label className="text-sm font-medium">Minimum Account Age to Join</Label>
                    <div className="p-3 rounded-lg border border-border/50 bg-secondary/30 space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Require new members to have an account older than this to join your server. Helps prevent raids from freshly created accounts.
                      </p>
                      <Select
                        value={String(minAccountAgeDraft)}
                        onValueChange={(value) => setMinAccountAgeDraft(Number(value))}
                        disabled={isLoading || isUploadingIcon || isUploadingBanner}
                      >
                        <SelectTrigger className="w-full sm:w-[220px] bg-background/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">No restriction</SelectItem>
                          <SelectItem value="1">1 day</SelectItem>
                          <SelectItem value="5">5 days</SelectItem>
                          <SelectItem value="14">14 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Publish Server (owner-only) */}
                {isOwner && (
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                    <Label className="text-sm font-medium">Publish Server</Label>
                    <div className="space-y-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">Make this server public</p>
                          <p className="text-xs text-muted-foreground">
                            Public servers appear in Explore only after meeting the minimum quality requirements.
                          </p>
                        </div>
                        <Switch
                          checked={isPublishedDraft}
                          onCheckedChange={setIsPublishedDraft}
                          disabled={isLoading || isLoadingPublicationEligibility || (!isPublishedDraft && !publicationEligibility?.eligible)}
                        />
                      </div>

                      {isLoadingPublicationEligibility ? (
                        <p className="text-xs text-muted-foreground">Checking requirements...</p>
                      ) : publicationEligibility?.requirements?.length ? (
                        <div className="space-y-2">
                          {publicationEligibility.requirements.map((requirement) => (
                            <div
                              key={requirement.key}
                              className="flex items-center justify-between gap-3 rounded-md border border-border/40 bg-background/40 px-3 py-2"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                {requirement.met ? (
                                  <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                                ) : (
                                  <X className="h-4 w-4 flex-shrink-0 text-destructive" />
                                )}
                                <span className="text-xs text-foreground">{requirement.label}</span>
                              </div>
                              <span className="text-right text-xs text-muted-foreground">
                                {typeof requirement.current === "boolean"
                                  ? requirement.current
                                    ? "Set"
                                    : "Missing"
                                  : `${requirement.current}/${requirement.required} ${requirement.unit}`}
                              </span>
                            </div>
                          ))}
                          {!publicationEligibility.eligible && publicationEligibility.unmet_requirements?.length ? (
                            <p className="text-xs text-muted-foreground">
                              Missing: {publicationEligibility.unmet_requirements.join(" | ")}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {publicationEligibility?.error || "Unable to load publication requirements."}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* User Messages */}
                {canManageServer && (
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                    <Label className="text-sm font-medium">User Messages</Label>

                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-sm text-muted-foreground">User Joined Messages</Label>
                      <Select
                        value={systemChannelJoinId || "none"}
                        onValueChange={(value) => setSystemChannelJoinId(value === "none" ? "" : value)}
                        disabled={isLoading || isUploadingIcon || isUploadingBanner}
                      >
                        <SelectTrigger className="h-9 text-sm w-48">
                          <SelectValue placeholder="Select a channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {channels
                            .filter((ch) => ch.server_id === server.id && ch.type === "text")
                            .map((channel) => {
                              const category = categories.find((c) => c.id === channel.category_id);
                              return (
                                <SelectItem key={channel.id} value={channel.id}>
                                  {category ? `${category.name} › ` : ""}#{channel.name}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-sm text-muted-foreground">User Left Messages</Label>
                      <Select
                        value={systemChannelLeaveId || "none"}
                        onValueChange={(value) => setSystemChannelLeaveId(value === "none" ? "" : value)}
                        disabled={isLoading || isUploadingIcon || isUploadingBanner}
                      >
                        <SelectTrigger className="h-9 text-sm w-48">
                          <SelectValue placeholder="Select a channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {channels
                            .filter((ch) => ch.server_id === server.id && ch.type === "text")
                            .map((channel) => {
                              const category = categories.find((c) => c.id === channel.category_id);
                              return (
                                <SelectItem key={channel.id} value={channel.id}>
                                  {category ? `${category.name} › ` : ""}#{channel.name}
                                </SelectItem>
                              );
                            })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

              </form>
            </TabsContent>

            {/* Members Tab */}
            <TabsContent value="members" className="m-0 px-[40px] py-[32px] pr-[84px]">
              <h2 className="text-xl font-medium mb-1">Members</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {stagedMembers.length} member{stagedMembers.length !== 1 ? "s" : ""}
              </p>

              {/* Search */}
              <div className="relative mb-4 max-w-4xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={memberSearch}
                  onChange={(e) => { setMemberSearch(e.target.value); setMemberDisplayCount(50); }}
                  className="pl-10 h-10 rounded-xl border-border/50 bg-secondary/30"
                />
              </div>

              <ScrollArea className="h-[calc(100vh-20rem)] pr-4">
                {(() => {
                  const searchLower = memberSearch.toLowerCase();
                  const filtered = memberSearch
                    ? stagedMembers.filter((m) => {
                        const username = m.user?.username?.toLowerCase() || "";
                        const display = m.user?.display_name?.toLowerCase() || "";
                        const nick = m.nickname?.toLowerCase() || "";
                        return username.includes(searchLower) || display.includes(searchLower) || nick.includes(searchLower);
                      })
                    : stagedMembers;
                  const visible = filtered.slice(0, memberDisplayCount);
                  const hasMore = filtered.length > memberDisplayCount;

                  return (
                    <div className="space-y-2 max-w-4xl">
                      {memberSearch && (
                        <p className="text-xs text-muted-foreground mb-2">
                          Showing {Math.min(memberDisplayCount, filtered.length)} of {filtered.length} matching members
                        </p>
                      )}
                      {visible.map((member) => {
                        const memberRoles = member.roles || [];
                        const hasRoles = memberRoles.length > 0;

                        return (
                          <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
                            <Avatar className="w-10 h-10 flex-shrink-0">
                              <AvatarImage src={member.user?.avatar_url || undefined} />
                              <AvatarFallback style={{ backgroundColor: member.user?.banner_color || "#5865F2" }}>
                                {member.user?.username?.[0]?.toUpperCase() || "?"}
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
                                      const isGradient = role.color.startsWith("linear-gradient");
                                      return (
                                        <Badge
                                          key={role.id}
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0 h-4 font-medium border-0"
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
                                {member.user?.username} • {getRoleLabel(member.role)}
                              </p>
                            </div>

                            {/* Actions — each gated on its own permission + hierarchy */}
                            {member.user_id !== user?.id &&
                              (() => {
                                const targetIsOwner = member.role === "owner";
                                const actorCanModerate = canModerate(member.roles, member.role as any, targetIsOwner);
                                const showRoles = canManageRoles && actorCanModerate && visibleRoles.length > 0;
                                const showKick = canKickMembers && actorCanModerate;
                                const showBan = canBanMembers && actorCanModerate;
                                if (!showRoles && !showKick && !showBan) return null;
                                return (
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    {showRoles && (
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
                                          {visibleRoles.filter((r) => r.name !== "@everyone").map((role) => {
                                            const hasRole = memberRoles.some((r) => r.id === role.id);
                                            return (
                                              <DropdownMenuItem
                                                key={role.id}
                                                onClick={() =>
                                                  hasRole ? handleRemoveRole(member, role) : handleAssignRole(member, role)
                                                }
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
                                                  {hasRole && <span className="text-xs text-primary">●</span>}
                                                </div>
                                              </DropdownMenuItem>
                                            );
                                          })}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    )}
                                    {showKick && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleKickMember(member)}
                                        className="text-muted-foreground hover:text-destructive text-xs h-8 px-3"
                                      >
                                        Kick
                                      </Button>
                                    )}
                                    {showBan && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleBanMember(member)}
                                        className="text-muted-foreground hover:text-destructive text-xs h-8 px-3"
                                      >
                                        Ban
                                      </Button>
                                    )}
                                  </div>
                                );
                              })()}
                          </div>
                        );
                      })}

                      {hasMore && (
                        <Button
                          variant="outline"
                          className="w-full mt-2 rounded-xl"
                          onClick={() => setMemberDisplayCount((c) => c + 50)}
                        >
                          Show more ({filtered.length - memberDisplayCount} remaining)
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </ScrollArea>
            </TabsContent>

            {/* Roles Tab */}
            <TabsContent value="roles" className="m-0 h-full pr-[84px]">
              {canManageRoles ? (
                <div className={cn("flex h-full", isMobile && "flex-col")}>
                  {/* Roles List */}
                  <div
                    className={cn(
                      "border-border flex flex-col flex-shrink-0",
                      isMobile
                        ? selectedRole || mobileRoleCreateView
                          ? "w-full h-56 border-b"
                          : "w-full h-full border-b"
                        : "w-64 border-r",
                    )}
                  >
                    <div className="p-4 border-b border-border">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium">Roles</h4>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedRoleId(null);
                            setEditingRole(null);
                            setRoleName("");
                            setRoleColor("#5865F2");
                            setRoleIcon("");
                            setRoleIsSelfAssignable(false);
                            setColorType("solid");
                            setGradientColors(["#5865F2", "#7289DA"]);
                            setGradientAngle(135);
                            if (isMobile) setMobileRoleCreateView(true);
                          }}
                          className="h-8 w-8 p-0"
                          title="Create New Role"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Select a role to edit</p>
                    </div>
                    <ScrollArea className="flex-1">
                      {visibleRoles.length > 0 ? (
                        <div className="p-2">
                          <DndContext
                            sensors={roleSensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleRoleDragEnd}
                          >
                            <SortableContext items={roleIds} strategy={verticalListSortingStrategy}>
                              <div className="space-y-1">
                                {visibleRoles.map((role) => (
                                  <RoleRow key={role.id} role={role} />
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

                  {/* Right Side - Role Settings (full screen on mobile) */}
                  {(!isMobile || selectedRole || mobileRoleCreateView) && (
                  <div className="flex-1 overflow-y-auto" ref={roleEditContainerRef}>
                    {selectedRole ? (
                      <div className="p-6 space-y-6 max-w-2xl">
                        {/* Back button on mobile */}
                        {isMobile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRoleId(null);
                              setEditingRole(null);
                              setRoleName("");
                              setRoleColor("#5865F2");
                              setRoleIcon("");
                              setRoleIsSelfAssignable(false);
                              setColorType("solid");
                              setGradientColors(["#5865F2", "#7289DA"]);
                              setGradientAngle(135);
                              setMobileRoleCreateView(false);
                            }}
                            className="flex items-center gap-1 -ml-2 mb-2"
                          >
                            <ArrowLeft className="w-4 h-4" />
                            Back to Roles
                          </Button>
                        )}
                        {/* Role Details Section */}
                        <div>
                          <h3 className="text-lg font-medium mb-1">Edit Role</h3>
                          <p className="text-sm text-muted-foreground">
                            Customize appearance and permissions for this role
                          </p>
                        </div>

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
                                      className="w-7 h-7"
                                      onClick={() => setRoleIcon("")}
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

                          {selectedRole.name !== "@everyone" && (
                            <div className="flex items-start justify-between gap-4 py-1">
                              <div className="flex-1 min-w-0">
                                <label htmlFor="editRoleSelfAssignable" className="text-sm font-medium cursor-pointer">
                                  Self Assignable
                                </label>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                  Members can assign this role to themselves
                                </p>
                              </div>
                              <Switch
                                id="editRoleSelfAssignable"
                                checked={roleIsSelfAssignable}
                                onCheckedChange={setRoleIsSelfAssignable}
                              />
                            </div>
                          )}

                        </div>

                        {/* Permissions Section */}
                        <Separator />
                        <div>
                          <h3 className="text-lg font-medium mb-1">Permissions</h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            Configure what members with this role can do. Greyed-out permissions are not yet available.
                          </p>
                          <RolePermissionsEditorInline
                            role={selectedRole}
                            serverId={server.id}
                            stageRolePermissionsOp={selectedRole.id.startsWith("pending-role-") ? undefined : stageRolePermissionsOp}
                            initialPermissionStates={
                              selectedRole.id.startsWith("pending-role-")
                                ? stagedRolePermissionStates[selectedRole.id]
                                : undefined
                            }
                            onPermissionStatesChange={handleRolePermissionStatesChange}
                          />
                        </div>

                        {/* Delete Role - hidden for @everyone */}
                        {selectedRole.name !== "@everyone" && (
                          <>
                            <Separator />
                            <div className="pb-8">
                              <h4 className="text-sm font-medium text-destructive mb-2">Delete Role</h4>
                              <p className="text-xs text-muted-foreground mb-3">
                                Permanently delete this role. It will be removed from all members who have it.
                              </p>
                              <Button variant="destructive" size="sm" onClick={() => handleDeleteRole(selectedRole)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Role
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="p-6 max-w-2xl">
                        <div className="space-y-5">
                          {/* Back button on mobile for create view */}
                          {isMobile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingRole(null);
                                setRoleName("");
                                setRoleColor("#5865F2");
                                setRoleIcon("");
                                setRoleIsSelfAssignable(false);
                                setColorType("solid");
                                setGradientColors(["#5865F2", "#7289DA"]);
                                setGradientAngle(135);
                                setMobileRoleCreateView(false);
                              }}
                              className="flex items-center gap-1 -ml-2 mb-2"
                            >
                              <ArrowLeft className="w-4 h-4" />
                              Back to Roles
                            </Button>
                          )}
                          <div>
                            <h3 className="text-lg font-medium mb-1">Create New Role</h3>
                            <p className="text-sm text-muted-foreground">Create a new role for your server</p>
                          </div>

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
                                        className="w-7 h-7"
                                        onClick={() => setRoleIcon("")}
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

                            <div className="flex items-start justify-between gap-4 py-1">
                              <div className="flex-1 min-w-0">
                                <label htmlFor="createRoleSelfAssignable" className="text-sm font-medium cursor-pointer">
                                  Self Assignable
                                </label>
                                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                  Members can assign this role to themselves
                                </p>
                              </div>
                              <Switch
                                id="createRoleSelfAssignable"
                                checked={roleIsSelfAssignable}
                                onCheckedChange={setRoleIsSelfAssignable}
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                              <Button
                                onClick={handleCreateRole}
                                disabled={!roleName.trim()}
                                size="sm"
                                className="flex-1"
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Create Role
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">Only admins can manage roles</p>
                </div>
              )}
            </TabsContent>

            {/* Invites Tab */}
            <TabsContent value="invites" className="m-0 px-[40px] py-[32px] pr-[84px]">
              {canManageInvites ? (
                <div className="space-y-4 max-w-4xl">
                  <h2 className="text-xl font-medium">Invites</h2>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">Create, copy, and revoke invite links.</p>
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
                  ) : displayedInvites.length > 0 ? (
                    <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
                      <div className="space-y-2">
                        {displayedInvites.map((invite) => {
                          const isRevoked = !!invite.revoked_at;
                          const isExpired = !!invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now();
                          const usesCount = invite.uses_count ?? 0;
                          const maxUses = invite.max_uses ?? null;
                          const isMaxed = maxUses !== null && usesCount >= maxUses;
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
                          const maxUsesLabel = maxUses !== null ? String(maxUses) : "∞";
                          return (
                            <div
                              key={invite.id}
                              className="flex items-center gap-3 p-3 rounded-lg border bg-secondary/30"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-sm tracking-widest">{invite.code}</span>
                                  {invite.isPending && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                      Pending save
                                    </Badge>
                                  )}
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
                                  Created by{" "}
                                  <span className="font-medium text-foreground">{invite.created_by_username}</span> •{" "}
                                  {new Date(invite.created_at).toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Expires: <span className="font-medium text-foreground">{expiresLabel}</span> • Uses:{" "}
                                  <span className="font-medium text-foreground">
                                    {usesCount}/{maxUsesLabel}
                                  </span>
                                </p>
                                {isRevoked && invite.revoked_by_username && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    Revoked by{" "}
                                    <span className="font-medium text-foreground">{invite.revoked_by_username}</span>
                                  </p>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => copyInviteLink(invite.code, invite.id)}
                                  disabled={invite.isPending}
                                  className="h-8 px-3"
                                >
                                  {copiedInviteId === invite.id ? (
                                    <Check className="w-4 h-4" />
                                  ) : (
                                    <Copy className="w-4 h-4" />
                                  )}
                                </Button>
                                {!isRevoked && !invite.isPending && (
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
            <TabsContent value="bans" className="m-0 px-[40px] py-[32px] pr-[84px]">
              <h2 className="text-xl font-medium mb-4">Bans</h2>
              {bannedMembers.length > 0 ? (
                <ScrollArea className="h-[calc(100vh-16rem)] pr-4">
                  <div className="space-y-2 max-w-4xl">
                    {bannedMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary/50">
                        <Avatar className="w-10 h-10 flex-shrink-0">
                          <AvatarImage src={member.user?.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: (member.user as any)?.banner_color || "#5865F2" }}>
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
                            onClick={() => {
                              if (!user) return;
                              queueTabOp("bans", `Unban ${member.user?.username || "user"}`, async () => {
                                const { error } = await supabase.rpc("unban_member", {
                                  _server_id: server.id,
                                  _user_id: user.id,
                                  _target_user_id: member.user_id,
                                });
                                if (error) throw error;
                              });
                              setBannedMembers((prev) => prev.filter((item) => item.id !== member.id));
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
                  <p className="text-xs text-muted-foreground mt-1">Users you ban will appear here</p>
                </div>
              )}
            </TabsContent>

            {/* Emojis Tab */}
            <TabsContent value="emojis" className="m-0 px-[40px] py-[32px] pr-[84px]">
              {canManageEmojis ? (
                <div className="space-y-5 max-w-4xl">
                  <h2 className="text-xl font-medium">Emojis</h2>

                  {/* Import from emoji.gg - highlighted */}
                  <div className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'hsl(238, 84%, 65%)' }}>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-white">Import from emoji.gg</h4>
                      <p className="text-xs text-white/70 mt-0.5">
                        Browse and import emoji packs from emoji.gg
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openModal("import-emoji-pack")}
                      className="h-9 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white"
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Import Pack
                    </Button>
                  </div>

                  {/* Custom Emojis box */}
                  <div className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
                    <div className="p-4 border-b border-border/50">
                      <h4 className="text-sm font-medium">Custom Emojis</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Upload an emoji and set a name (2-12 chars: a-z, 0-9, underscore). Use it in chat as{" "}
                        <span className="font-mono">:name:</span>
                      </p>
                    </div>

                    {/* Upload row */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end p-4">
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => emojiInputRef.current?.click()}
                          className={cn(
                            "w-14 h-14 rounded-xl bg-secondary flex items-center justify-center border-2 border-dashed border-muted-foreground/50 transition-colors flex-shrink-0 overflow-hidden cursor-pointer hover:border-primary",
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
                        <Label className="text-sm" htmlFor="emojiName">
                          Emoji Name
                        </Label>
                        <Input
                          id="emojiName"
                          value={emojiName}
                          onChange={(e) => setEmojiName(e.target.value)}
                          placeholder="e.g. cat"
                          className="h-10 text-sm"
                          maxLength={12}
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={clearEmoji}
                          disabled={isUploadingEmoji && !!emojiFile}
                          className="h-9 rounded-[3px] border-[#4a4f5a] bg-transparent px-4 text-[#d7dbe3] hover:bg-[#3e434d] hover:text-white"
                        >
                          Clear
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={uploadServerEmoji}
                          disabled={isUploadingEmoji || !emojiFile || !emojiName.trim()}
                          className="h-9 flex-1 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white disabled:bg-[#6f7480] disabled:text-[#2f333b] sm:flex-none"
                        >
                          {isUploadingEmoji && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          Upload
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Server Emojis box */}
                  <div className="rounded-xl border border-border bg-secondary/20 overflow-hidden">
                    <div className="p-4 border-b border-border/50">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-sm font-medium">Server Emojis</h4>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {serverEmojis.length}/{MAX_SERVER_EMOJIS} slots
                          </span>
                          {serverEmojis.length > 0 && (
                            <Button
                              type="button"
                              variant={isMultiSelectMode ? "secondary" : "outline"}
                              size="sm"
                              onClick={() => {
                                setIsMultiSelectMode(!isMultiSelectMode);
                                setSelectedEmojiIds(new Set());
                              }}
                              className="text-xs h-7"
                            >
                              {isMultiSelectMode ? "Cancel" : "Select"}
                            </Button>
                          )}
                        </div>
                      </div>
                      {isMultiSelectMode && serverEmojis.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap mt-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => {
                              const selectableEmojiIds = serverEmojis.filter((e) => !e.isPending).map((e) => e.id);
                              if (selectedEmojiIds.size === selectableEmojiIds.length) {
                                setSelectedEmojiIds(new Set());
                              } else {
                                setSelectedEmojiIds(new Set(selectableEmojiIds));
                              }
                            }}
                          >
                            {selectedEmojiIds.size === serverEmojis.filter((e) => !e.isPending).length ? "Deselect All" : "Select All"}
                          </Button>
                          {selectedEmojiIds.size > 0 && (
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="text-xs h-7"
                              onClick={bulkDeleteEmojis}
                              disabled={isDeletingEmojis}
                            >
                              {isDeletingEmojis ? (
                                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3 mr-1.5" />
                              )}
                              Delete Selected ({selectedEmojiIds.size})
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    {serverEmojis.length > 0 ? (
                      <>
                        {/* Table header */}
                        <div className="flex items-center gap-4 px-4 py-2 bg-secondary/40 border-b border-border/50 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                          {isMultiSelectMode && <span className="w-6" />}
                          <span className="w-10">Image</span>
                          <span className="flex-1">Name</span>
                          {!isMultiSelectMode && <span className="w-20 text-right">Actions</span>}
                        </div>
                        {/* Table rows */}
                        <div className="max-h-[400px] overflow-y-auto overscroll-contain">
                          <div className="divide-y divide-border/50">
                            {serverEmojisWithUrls.map((emoji) => (
                              <div
                                key={emoji.id}
                                className={cn(
                                  "group flex items-center gap-4 px-4 py-2.5 transition-colors",
                                  isMultiSelectMode ? "cursor-pointer hover:bg-secondary/30" : "hover:bg-secondary/20",
                                  isMultiSelectMode && selectedEmojiIds.has(emoji.id) && "bg-primary/10",
                                )}
                                onClick={
                                  isMultiSelectMode
                                    ? () => {
                                        if (emoji.isPending) return;
                                        setSelectedEmojiIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(emoji.id)) next.delete(emoji.id);
                                          else next.add(emoji.id);
                                          return next;
                                        });
                                      }
                                    : undefined
                                }
                              >
                                {isMultiSelectMode && (
                                  <div className="w-6 flex items-center justify-center">
                                    <Checkbox
                                      checked={selectedEmojiIds.has(emoji.id)}
                                      disabled={emoji.isPending}
                                      onCheckedChange={() => {
                                        if (emoji.isPending) return;
                                        setSelectedEmojiIds((prev) => {
                                          const next = new Set(prev);
                                          if (next.has(emoji.id)) next.delete(emoji.id);
                                          else next.add(emoji.id);
                                          return next;
                                        });
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </div>
                                )}
                                <img
                                  src={emoji.url}
                                  alt={emoji.name}
                                  className="w-10 h-10 flex-shrink-0 rounded object-contain"
                                  loading="lazy"
                                />
                                <div className="min-w-0 flex-1">
                                  {editingEmojiId === emoji.id && !isMultiSelectMode ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        renameServerEmoji(emoji.id, editingEmojiName);
                                      }}
                                    >
                                      <input
                                        autoFocus
                                        className="w-full max-w-[200px] text-sm font-medium bg-secondary/50 border border-border rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring/50"
                                        value={editingEmojiName}
                                        onChange={(e) =>
                                          setEditingEmojiName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Escape") setEditingEmojiId(null);
                                        }}
                                        onBlur={() => setTimeout(() => setEditingEmojiId(null), 150)}
                                        maxLength={12}
                                      />
                                    </form>
                                  ) : (
                                    <span className="text-sm font-medium">
                                      :{emoji.name}:{emoji.isPending ? " (pending save)" : ""}
                                    </span>
                                  )}
                                </div>
                                {!isMultiSelectMode && (
                                  <div className="flex items-center gap-1 w-20 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={emoji.isPending}
                                      onClick={() => {
                                        setEditingEmojiId(emoji.id);
                                        setEditingEmojiName(emoji.name);
                                      }}
                                      className="text-muted-foreground hover:text-foreground h-8 w-8 p-0"
                                      title="Rename emoji"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      disabled={emoji.isPending}
                                      onClick={() => deleteServerEmoji(emoji)}
                                      className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                                      title="Delete emoji"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Smile className="w-12 h-12 text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">No custom emojis yet</p>
                        <p className="text-xs text-muted-foreground mt-1">Upload your first emoji above</p>
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

            {/* Integrations Tab */}
            {canManageChannels && (
              <TabsContent value="integrations" className="m-0 px-[40px] py-[32px] pr-[84px]">
                <div className="space-y-5 max-w-3xl">
                  <h2 className="text-xl font-medium">Integrations</h2>
                  <p className="text-sm text-muted-foreground">
                    Connect external services and import data from other platforms.
                  </p>

                  {/* Discord Import */}
                  <div className="space-y-2 border border-border rounded-lg p-4 bg-secondary/30">
                    <Label className="text-sm font-medium">Discord Server Template</Label>
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">Import from Discord</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Import categories, channels, and roles from a Discord server template. This will add the
                          imported items to your server.
                        </p>
                      </div>
                      <Button
                      type="button"
                      size="sm"
                      onClick={() => openModal("import-discord-template")}
                      className="h-9 flex-shrink-0 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Import
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            )}

            {/* Transfer Ownership Tab */}
            {isOwner && (
              <TabsContent value="transfer" className="m-0 px-[40px] py-[32px] pr-[84px]">
                <div className="space-y-5 max-w-3xl">
                  <div>
                    <h2 className="text-xl font-medium text-destructive">Transfer Ownership</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Transfer this server to another member. You will lose ownership and become an admin.
                      This action cannot be undone.
                    </p>
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="flex-1 max-w-xs space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Select new owner</Label>
                      <Select
                        value={transferTargetId || ""}
                        onValueChange={(value) => setTransferTargetId(value || null)}
                      >
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Select a member..." />
                        </SelectTrigger>
                        <SelectContent>
                          <ScrollArea className="max-h-60">
                            {members
                              .filter((m) => m.user_id !== user?.id && m.role !== "owner" && !m.is_banned)
                              .map((member) => (
                                <SelectItem key={member.user_id} value={member.user_id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="w-5 h-5">
                                      <AvatarImage src={member.user?.avatar_url || undefined} />
                                      <AvatarFallback className="text-[10px]" style={{ backgroundColor: member.user?.banner_color || "#5865F2" }}>
                                        {member.user?.username?.[0]?.toUpperCase() || "?"}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{member.user?.username || "Unknown"}</span>
                                  </div>
                                </SelectItem>
                              ))}
                          </ScrollArea>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={!transferTargetId}
                      onClick={() => {
                        setTransferConfirmName("");
                        setShowTransferConfirm(true);
                      }}
                    >
                      <Crown className="w-4 h-4 mr-2" />
                      Transfer Ownership
                    </Button>
                  </div>
                </div>
              </TabsContent>
            )}
          </div>
        </Tabs>
      </div>

      {/* Role Permissions Editor */}
      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Server</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{server.name}</strong>? This action cannot be undone. All
              channels, messages, and members will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              className="h-9 !rounded-[3px] border-[#4a4f5a] bg-transparent px-4 text-[#d7dbe3] hover:bg-[#3e434d] hover:text-white"
            >
              Cancel
            </Button>
            <AlertDialogAction
              onClick={handleDeleteServer}
              className="rounded-[3px] bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Server
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Transfer Ownership Confirmation */}
      <AlertDialog open={showTransferConfirm} onOpenChange={setShowTransferConfirm}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Transfer Server Ownership</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  You are about to transfer ownership of <strong>{server.name}</strong> to{" "}
                  <strong>{members.find((m) => m.user_id === transferTargetId)?.user?.username || "Unknown"}</strong>.
                </p>
                <p>
                  You will be demoted to <strong>Admin</strong> and will no longer be able to delete the server or transfer ownership.
                  This action <strong>cannot be undone</strong>.
                </p>
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs text-muted-foreground">
                    Type <span className="font-mono font-medium text-foreground">{server.name}</span> to confirm
                  </Label>
                  <Input
                    value={transferConfirmName}
                    onChange={(e) => setTransferConfirmName(e.target.value)}
                    placeholder="Enter server name..."
                    className="h-9 text-sm"
                    autoComplete="off"
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[3px]" disabled={isTransferring}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={transferConfirmName !== server.name || isTransferring || !transferTargetId}
              onClick={async () => {
                if (!transferTargetId || !user) return;
                setIsTransferring(true);
                try {
                  const { error } = await supabase.rpc("transfer_ownership", {
                    _server_id: server.id,
                    _current_owner_id: user.id,
                    _new_owner_id: transferTargetId,
                  });
                  if (error) throw error;
                  toast.success("Ownership transferred successfully");
                  setShowTransferConfirm(false);
                  setTransferTargetId(null);
                  setTransferConfirmName("");
                  closeServerSettings();
                  await fetchServers(user.id);
                } catch (error: any) {
                  toast.error(error?.message || "Failed to transfer ownership");
                } finally {
                  setIsTransferring(false);
                }
              }}
            >
              {isTransferring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Crown className="w-4 h-4 mr-2" />}
              Transfer
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    </>
  );
};
