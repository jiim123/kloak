import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Ban, Bot, ChevronDown, Plus, Search, SlidersHorizontal, UserX, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRealtimeMembers } from "@/hooks/useRealtimeMembers";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { canModerateByRoles } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useUIStore } from "@/stores/uiStore";
import type { CustomServerRole, ServerMember, ServerRole } from "@/types";
import { toast } from "sonner";

type LastOnlineFilter = "last_24h" | "last_7d" | "last_31d" | "last_90d" | "older_90d";
type JoinedFilter =
  | "last_1h"
  | "last_3h"
  | "last_6h"
  | "last_12h"
  | "last_24h"
  | "last_7d"
  | "last_31d"
  | "last_90d"
  | "older_90d";
type UserTypeFilter = "users" | "bots";

const SYSTEM_ROLE_META: Record<ServerRole, { label: string; color: string }> = {
  owner: { label: "Owner", color: "#F0B232" },
  admin: { label: "Admin", color: "#C77DFF" },
  moderator: { label: "Moderator", color: "#67D17B" },
  member: { label: "Member", color: "#9AA0AA" },
};

const LAST_ONLINE_OPTIONS: Array<{ id: LastOnlineFilter; label: string; min?: number; max?: number }> = [
  { id: "last_24h", label: "Last 24 hours", max: 24 },
  { id: "last_7d", label: "Last 1 to 7 days", min: 24, max: 24 * 7 },
  { id: "last_31d", label: "Last 7 to 31 days", min: 24 * 7, max: 24 * 31 },
  { id: "last_90d", label: "Last 31 to 90 days", min: 24 * 31, max: 24 * 90 },
  { id: "older_90d", label: "More than 90 days", min: 24 * 90 },
];

const JOINED_OPTIONS: Array<{ id: JoinedFilter; label: string; min?: number; max?: number }> = [
  { id: "last_1h", label: "Last 1 hour", max: 1 },
  { id: "last_3h", label: "Last 1 to 3 hours", min: 1, max: 3 },
  { id: "last_6h", label: "Last 3 to 6 hours", min: 3, max: 6 },
  { id: "last_12h", label: "Last 6 to 12 hours", min: 6, max: 12 },
  { id: "last_24h", label: "Last 12 to 24 hours", min: 12, max: 24 },
  { id: "last_7d", label: "Last 1 to 7 days", min: 24, max: 24 * 7 },
  { id: "last_31d", label: "Last 7 to 31 days", min: 24 * 7, max: 24 * 31 },
  { id: "last_90d", label: "Last 31 to 90 days", min: 24 * 31, max: 24 * 90 },
  { id: "older_90d", label: "More than 90 days", min: 24 * 90 },
];

const formatElapsed = (iso: string | null | undefined, fallback = "Unknown") => {
  if (!iso) return fallback;
  const elapsedMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return fallback;
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.floor(days / 365)}y`;
};

const hoursSince = (iso: string | null | undefined) => {
  if (!iso) return null;
  const elapsed = (Date.now() - new Date(iso).getTime()) / 36e5;
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
};

const matchesRange = (hours: number | null, option: { min?: number; max?: number }) => {
  if (hours == null) return false;
  if (option.min != null && hours < option.min) return false;
  if (option.max != null && hours > option.max) return false;
  return true;
};

const roleLabel = (member: ServerMember) => {
  const customRole = [...(member.roles || [])].sort((a, b) => b.position - a.position)[0];
  return customRole?.name || SYSTEM_ROLE_META[member.role]?.label || "Member";
};

const roleColor = (role: CustomServerRole | undefined, fallbackRole: ServerRole) => {
  return role?.color || SYSTEM_ROLE_META[fallbackRole]?.color || "#9AA0AA";
};

const roleBadgeStyle = (color: string) => {
  if (color.startsWith("linear-gradient")) {
    return { background: color, borderColor: "rgba(255,255,255,0.22)", color: "#FFFFFF" };
  }
  return {
    borderColor: `${color}AA`,
    backgroundColor: `${color}26`,
    color,
  };
};

const getMemberName = (member: ServerMember) =>
  member.nickname || member.user?.display_name || member.user?.username || "Unknown";

const MemberCheckbox = ({
  checked,
  onCheckedChange,
  label,
  color,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  color?: string;
}) => (
  <label className="flex h-6 items-center gap-2 text-[12px] font-normal text-foreground">
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className="h-3.5 w-3.5 rounded-none border-border bg-transparent data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
    />
    <span className="truncate" style={color ? { color } : undefined}>
      {label}
    </span>
  </label>
);

export const ServerMembersPage = () => {
  const currentServer = useServerStore((s) => s.currentServer);
  const members = useServerStore((s) => s.members);
  const roles = useServerStore((s) => s.roles);
  const isMembersLoading = useServerStore((s) => s.isMembersLoading);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const fetchRoles = useServerStore((s) => s.fetchRoles);
  const assignRoleToMember = useServerStore((s) => s.assignRoleToMember);
  const removeRoleFromMember = useServerStore((s) => s.removeRoleFromMember);
  const user = useAuthStore((s) => s.user);
  const openModal = useUIStore((s) => s.openModal);
  const { hasPermission, isOwner } = useMemberPermissions();

  const [search, setSearch] = useState("");
  const [roleFilters, setRoleFilters] = useState<Set<string>>(new Set());
  const [lastOnlineFilters, setLastOnlineFilters] = useState<Set<LastOnlineFilter>>(new Set());
  const [joinedFilters, setJoinedFilters] = useState<Set<JoinedFilter>>(new Set());
  const [userTypeFilters, setUserTypeFilters] = useState<Set<UserTypeFilter>>(new Set());
  const [memberDisplayCount, setMemberDisplayCount] = useState(50);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

  const canManageRoles = isOwner || hasPermission("manage_roles");
  const canKickMembers = hasPermission("kick_members");
  const canBanMembers = hasPermission("ban_members");
  const canUseBulkModeration = canKickMembers || canBanMembers;

  useRealtimeMembers(currentServer?.id || null, { full: true });

  useEffect(() => {
    if (!currentServer?.id) return;
    void fetchMembers(currentServer.id, { full: true });
    void fetchRoles(currentServer.id);
  }, [currentServer?.id, fetchMembers, fetchRoles]);

  const filterRoleOptions = useMemo(() => {
    const customRoles = roles.filter((role) => role.name !== "@everyone").sort((a, b) => b.position - a.position);
    return [
      { id: "system:admin", label: "Admin", color: SYSTEM_ROLE_META.admin.color },
      ...customRoles.map((role) => ({ id: `custom:${role.id}`, label: role.name, color: role.color })),
    ];
  }, [roles]);

  const currentUserMember = useMemo(() => members.find((member) => member.user_id === user?.id) || null, [members, user?.id]);

  const getModerationAbilities = useCallback((member: ServerMember) => {
    const isSelf = member.user_id === user?.id;
    const isServerOwner = member.role === "owner" || member.user_id === currentServer?.owner_id;
    const canModerate =
      canModerateByRoles(isOwner, currentUserMember?.roles, isServerOwner, member.roles) || (isOwner && !isSelf);

    return {
      canKick: canKickMembers && canModerate && !isSelf,
      canBan: canBanMembers && canModerate && !isSelf,
    };
  }, [user?.id, currentServer?.owner_id, isOwner, currentUserMember?.roles, canKickMembers, canBanMembers]);

  const visibleMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return members
      .filter((member) => {
        if (!normalizedSearch) return true;
        const username = member.user?.username?.toLowerCase() || "";
        const displayName = member.user?.display_name?.toLowerCase() || "";
        const nickname = member.nickname?.toLowerCase() || "";
        return username.includes(normalizedSearch) || displayName.includes(normalizedSearch) || nickname.includes(normalizedSearch);
      })
      .filter((member) => {
        if (roleFilters.size === 0) return true;
        const customRoleIds = new Set((member.roles || []).map((role) => `custom:${role.id}`));
        if (roleFilters.has(`system:${member.role}`)) return true;
        for (const roleId of customRoleIds) {
          if (roleFilters.has(roleId)) return true;
        }
        return false;
      })
      .filter((member) => {
        if (lastOnlineFilters.size === 0) return true;
        if (member.user?.status === "online") return lastOnlineFilters.has("last_24h");
        const elapsedHours = hoursSince(member.user?.last_seen);
        return LAST_ONLINE_OPTIONS.some((option) => lastOnlineFilters.has(option.id) && matchesRange(elapsedHours, option));
      })
      .filter((member) => {
        if (joinedFilters.size === 0) return true;
        const elapsedHours = hoursSince(member.joined_at);
        return JOINED_OPTIONS.some((option) => joinedFilters.has(option.id) && matchesRange(elapsedHours, option));
      })
      .filter((member) => {
        if (userTypeFilters.size === 0) return true;
        const isBot = member.user?.is_bot === true;
        return (isBot && userTypeFilters.has("bots")) || (!isBot && userTypeFilters.has("users"));
      })
      .sort((a, b) => {
        const topRoleA = [...(a.roles || [])].sort((ra, rb) => rb.position - ra.position)[0]?.position ?? 0;
        const topRoleB = [...(b.roles || [])].sort((ra, rb) => rb.position - ra.position)[0]?.position ?? 0;
        if (topRoleA !== topRoleB) return topRoleB - topRoleA;
        return getMemberName(a).localeCompare(getMemberName(b));
      });
  }, [members, search, roleFilters, lastOnlineFilters, joinedFilters, userTypeFilters]);

  const toggleSetValue = <T extends string,>(setValue: Dispatch<SetStateAction<Set<T>>>, value: T, checked: boolean) => {
    setValue((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(value);
      } else {
        next.delete(value);
      }
      return next;
    });
  };

  const activeFilterCount = roleFilters.size + lastOnlineFilters.size + joinedFilters.size + userTypeFilters.size;
  const assignableRoles = useMemo(
    () => roles.filter((role) => role.name !== "@everyone").sort((a, b) => b.position - a.position),
    [roles],
  );
  const renderedMembers = useMemo(() => visibleMembers.slice(0, memberDisplayCount), [visibleMembers, memberDisplayCount]);
  const hasMoreMembers = visibleMembers.length > memberDisplayCount;
  const selectableRenderedMembers = useMemo(
    () => renderedMembers.filter((member) => {
      const abilities = getModerationAbilities(member);
      return abilities.canKick || abilities.canBan;
    }),
    [renderedMembers, getModerationAbilities],
  );
  const selectedMembers = useMemo(
    () => members.filter((member) => selectedMemberIds.has(member.user_id)),
    [members, selectedMemberIds],
  );
  const kickableSelectedMembers = useMemo(
    () => selectedMembers.filter((member) => getModerationAbilities(member).canKick),
    [selectedMembers, getModerationAbilities],
  );
  const bannableSelectedMembers = useMemo(
    () => selectedMembers.filter((member) => getModerationAbilities(member).canBan),
    [selectedMembers, getModerationAbilities],
  );
  const allRenderedSelectableSelected =
    selectableRenderedMembers.length > 0 &&
    selectableRenderedMembers.every((member) => selectedMemberIds.has(member.user_id));

  useEffect(() => {
    setMemberDisplayCount(50);
  }, [search, roleFilters, lastOnlineFilters, joinedFilters, userTypeFilters]);

  useEffect(() => {
    setSelectedMemberIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (members.some((member) => member.user_id === id)) {
          next.add(id);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [members]);

  useEffect(() => {
    setSelectedMemberIds(new Set());
  }, [currentServer?.id]);

  const handleToggleMemberRole = async (member: ServerMember, role: CustomServerRole, checked: boolean) => {
    if (!user?.id) return;
    try {
      if (checked) {
        await assignRoleToMember(member.id, role.id, user.id);
        toast.success(`Assigned ${role.name}`);
      } else {
        await removeRoleFromMember(member.id, role.id, user.id);
        toast.success(`Removed ${role.name}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    }
  };

  const toggleMemberSelection = (member: ServerMember, checked: boolean) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(member.user_id);
      } else {
        next.delete(member.user_id);
      }
      return next;
    });
  };

  const toggleSelectAllRendered = (checked: boolean) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      for (const member of selectableRenderedMembers) {
        if (checked) {
          next.add(member.user_id);
        } else {
          next.delete(member.user_id);
        }
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedMemberIds(new Set());
  };

  const openMassActionModal = (action: "massKick" | "massBan", targetMembers: ServerMember[]) => {
    if (targetMembers.length === 0) return;
    const actionVerb = action === "massKick" ? "Kick" : "Ban";
    const actionPhrase = action === "massKick" ? "kick" : "ban";

    openModal("confirmAction", {
      action,
      members: targetMembers,
      title: `${actionVerb} ${targetMembers.length} member${targetMembers.length > 1 ? "s" : ""}`,
      message: `Are you sure you want to ${actionPhrase} ${targetMembers.length} member${targetMembers.length > 1 ? "s" : ""} from the server?`,
    });
  };

  if (!currentServer) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto bg-layout-members text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
          <div className="mb-3 flex min-h-11 items-center gap-3">
            <div className="relative w-[220px] shrink-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search members"
                className="h-8 w-full rounded-full border border-white/8 bg-card pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-white/80"
              />
            </div>

            {selectedMemberIds.size > 0 && (
              <div className="flex min-h-8 flex-wrap items-center gap-2 rounded-full border border-white/10 bg-card px-3 py-1.5 text-[12px] text-foreground">
                <span className="font-medium text-white">{selectedMemberIds.size} selected</span>
                {canKickMembers && (
                  <button
                    type="button"
                    onClick={() => openMassActionModal("massKick", kickableSelectedMembers)}
                    disabled={kickableSelectedMembers.length === 0}
                    className="inline-flex h-6 items-center gap-1 rounded-full bg-[#A9662B] px-2.5 text-white transition-colors hover:bg-[#C47A34] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <UserX className="h-3.5 w-3.5" />
                    Kick
                  </button>
                )}
                {canBanMembers && (
                  <button
                    type="button"
                    onClick={() => openMassActionModal("massBan", bannableSelectedMembers)}
                    disabled={bannableSelectedMembers.length === 0}
                    className="inline-flex h-6 items-center gap-1 rounded-full bg-[#C83F4A] px-2.5 text-white transition-colors hover:bg-[#DB4D59] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Ban
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/8 hover:text-white"
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "ml-auto flex h-8 w-8 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-white/8 hover:text-white",
                    activeFilterCount > 0 && "text-white",
                  )}
                  aria-label="Filter members"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[660px] rounded-[4px] border border-white/10 bg-card p-3 text-foreground shadow-2xl"
              >
                <div className="grid grid-cols-4 gap-8">
              <div>
                <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Roles</div>
                <div className="space-y-1">
                  {filterRoleOptions.map((role) => (
                    <MemberCheckbox
                      key={role.id}
                      checked={roleFilters.has(role.id)}
                      onCheckedChange={(checked) => toggleSetValue(setRoleFilters, role.id, checked)}
                      label={role.label}
                      color={role.color.startsWith("linear-gradient") ? undefined : role.color}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Last online</div>
                <div className="space-y-1">
                  {LAST_ONLINE_OPTIONS.map((option) => (
                    <MemberCheckbox
                      key={option.id}
                      checked={lastOnlineFilters.has(option.id)}
                      onCheckedChange={(checked) => toggleSetValue(setLastOnlineFilters, option.id, checked)}
                      label={option.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Joined</div>
                <div className="space-y-1">
                  {JOINED_OPTIONS.map((option) => (
                    <MemberCheckbox
                      key={option.id}
                      checked={joinedFilters.has(option.id)}
                      onCheckedChange={(checked) => toggleSetValue(setJoinedFilters, option.id, checked)}
                      label={option.label}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12px] font-semibold text-muted-foreground">User types</div>
                <div className="space-y-1">
                  <MemberCheckbox
                    checked={userTypeFilters.has("users")}
                    onCheckedChange={(checked) => toggleSetValue(setUserTypeFilters, "users", checked)}
                    label="Users"
                  />
                  <MemberCheckbox
                    checked={userTypeFilters.has("bots")}
                    onCheckedChange={(checked) => toggleSetValue(setUserTypeFilters, "bots", checked)}
                    label="Bots"
                  />
                </div>
              </div>
                </div>
              </PopoverContent>
            </Popover>

          </div>

      <div
        className={cn(
          "grid h-8 shrink-0 items-center border-b border-black/15 px-4 text-[12px] font-medium text-muted-foreground",
          canUseBulkModeration
            ? "grid-cols-[24px_34px_minmax(214px,1.4fr)_minmax(120px,0.75fr)_minmax(120px,0.75fr)_minmax(180px,1.05fr)]"
            : "grid-cols-[34px_minmax(214px,1.4fr)_minmax(120px,0.75fr)_minmax(120px,0.75fr)_minmax(180px,1.05fr)]",
        )}
      >
        {canUseBulkModeration && (
          <div className="flex items-center justify-center">
            <Checkbox
              checked={allRenderedSelectableSelected}
              onCheckedChange={(value) => toggleSelectAllRendered(value === true)}
              disabled={selectableRenderedMembers.length === 0}
              aria-label="Select visible members"
              className="h-3.5 w-3.5 rounded-none border-border bg-transparent data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
          </div>
        )}
        <div />
        <button type="button" className="flex items-center justify-start gap-1 text-left">
          Name <ChevronDown className="h-3 w-3" />
        </button>
        <button type="button" className="flex items-center gap-1 text-left">
          Member since <ChevronDown className="h-3 w-3" />
        </button>
        <button type="button" className="flex items-center gap-1 text-left">
          Joined <ChevronDown className="h-3 w-3" />
        </button>
        <button type="button" className="flex items-center gap-1 text-left">
          Roles <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      <div>
        {isMembersLoading && members.length === 0 ? (
          <div className="px-4 py-6 text-sm font-medium text-muted-foreground">Loading members...</div>
        ) : visibleMembers.length === 0 ? (
          <div className="px-4 py-6 text-sm font-medium text-muted-foreground">No members found.</div>
        ) : (
          renderedMembers.map((member) => {
            const primaryRole = [...(member.roles || [])].sort((a, b) => b.position - a.position)[0];
            const color = roleColor(primaryRole, member.role);
            const isOnline = member.user?.status === "online";

            return (
              <div
                key={member.id}
                className={cn(
                  "grid min-h-[44px] items-center border-b border-black/10 px-4 text-[13px] font-medium hover:bg-white/[0.025]",
                  canUseBulkModeration
                    ? "grid-cols-[24px_34px_minmax(180px,1.4fr)_minmax(120px,0.75fr)_minmax(120px,0.75fr)_minmax(180px,1.05fr)]"
                    : "grid-cols-[34px_minmax(180px,1.4fr)_minmax(120px,0.75fr)_minmax(120px,0.75fr)_minmax(180px,1.05fr)]",
                  selectedMemberIds.has(member.user_id) && "bg-white/[0.045]",
                )}
              >
                {canUseBulkModeration && (() => {
                  const abilities = getModerationAbilities(member);
                  const canSelect = abilities.canKick || abilities.canBan;

                  return (
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedMemberIds.has(member.user_id)}
                        onCheckedChange={(value) => toggleMemberSelection(member, value === true)}
                        disabled={!canSelect}
                        aria-label={`Select ${getMemberName(member)}`}
                        className="h-3.5 w-3.5 rounded-none border-border bg-transparent data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                    </div>
                  );
                })()}
                <div className="relative flex items-center justify-center">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={member.user?.avatar_url || undefined} />
                    <AvatarFallback
                      className="text-[11px] font-semibold text-white"
                      style={{ backgroundColor: member.user?.banner_color || "#5865F2" }}
                    >
                      {getMemberName(member)[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-layout-members",
                      isOnline ? "bg-[#3BA55D]" : "bg-muted-foreground",
                    )}
                  />
                </div>

                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="ml-3.5 truncate" style={{ color: member.role === "owner" ? "#F46B2B" : color }}>
                    {getMemberName(member)}
                  </span>
                  {member.user?.is_bot && (
                    <span className="rounded-[3px] bg-[#5865F2] px-1 py-px text-[8px] font-semibold leading-none text-white">
                      BOT
                    </span>
                  )}
                  {member.user?.is_bot && <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </div>

                <div className="truncate text-foreground">{formatElapsed(member.joined_at)}</div>
                <div className="truncate text-foreground">{formatElapsed(member.joined_at)}</div>
                <div className="flex min-w-0 items-center gap-1.5">
                  {(() => {
                    const sortedRoles = [...(member.roles || [])].sort((a, b) => b.position - a.position);
                    const visibleRoleItems = sortedRoles.slice(0, 2);
                    if (visibleRoleItems.length > 0) {
                      const remaining = sortedRoles.length - visibleRoleItems.length;
                      return (
                        <>
                          {visibleRoleItems.map((r) => (
                            <span
                              key={r.id}
                              className="inline-flex max-w-[96px] items-center gap-1 truncate rounded-full border px-2 py-[1px] text-[11px] font-medium leading-4"
                              style={roleBadgeStyle(r.color)}
                              title={r.name}
                            >
                              <span className="truncate">{r.name}</span>
                            </span>
                          ))}
                          {remaining > 0 && (
                            <span className="inline-flex h-5 items-center rounded-full border border-white/20 px-1.5 text-[10px] text-muted-foreground">
                              +{remaining}
                            </span>
                          )}
                        </>
                      );
                    }

                    return (
                      <span
                        className="inline-flex max-w-[120px] items-center gap-1 truncate rounded-full border px-2 py-[1px] text-[11px] font-medium leading-4"
                        style={roleBadgeStyle(color)}
                      >
                        <span className="truncate">{roleLabel(member)}</span>
                      </span>
                    );
                  })()}
                  {canManageRoles && assignableRoles.length > 0 && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-white"
                          aria-label={`Manage roles for ${getMemberName(member)}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="end"
                        sideOffset={6}
                        className="w-56 rounded-[4px] border border-white/10 bg-[#2F323B] p-2 text-foreground shadow-xl"
                      >
                        <div className="mb-2 px-1 text-[11px] font-semibold uppercase text-muted-foreground">Roles</div>
                        <div className="max-h-64 space-y-1 overflow-y-auto">
                          {assignableRoles.map((role) => {
                            const hasRole = (member.roles || []).some((memberRole) => memberRole.id === role.id);
                            return (
                              <MemberCheckbox
                                key={role.id}
                                checked={hasRole}
                                onCheckedChange={(checked) => void handleToggleMemberRole(member, role, checked)}
                                label={role.name}
                                color={role.color.startsWith("linear-gradient") ? undefined : role.color}
                              />
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              </div>
            );
          })
        )}
        {hasMoreMembers && (
          <div className="px-4 py-3">
            <button
              type="button"
              onClick={() => setMemberDisplayCount((count) => count + 50)}
              className="text-xs font-normal text-muted-foreground transition-colors hover:text-white"
            >
              Show more ({visibleMembers.length - memberDisplayCount} remaining)
            </button>
          </div>
        )}
      </div>
        </div>
    </div>
  );
};
