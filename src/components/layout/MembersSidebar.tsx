import { useState, useMemo, useEffect, memo } from "react";
import { cn } from "@/lib/utils";
import {
  Crown,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Edit3,
  UserX,
  Ban,
  VolumeX,
  Shield,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useDMStore } from "@/stores/dmStore";
import { useRealtimeMembers } from "@/hooks/useRealtimeMembers";
import { canModerate, getRoleInfo } from "@/lib/permissions";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MembersSidebarSkeleton } from "@/components/ui/skeletons";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import type { ServerMember, ServerRole, CustomServerRole, UserStatus } from "@/types";
import { getEffectivePresence } from "@/lib/presence";

const getMemberPresence = (member: ServerMember) => {
  const status = (member.user?.status as UserStatus | undefined) ?? "offline";
  const lastSeen = member.user?.last_seen;
  return getEffectivePresence(status, lastSeen);
};

// Memoized Status indicator component
const StatusIndicator = memo(
  ({ status, isStale, className }: { status?: string; isStale?: boolean; className?: string }) => {
    if (isStale) {
      return <div className={cn("w-2.5 h-2.5 rounded-full bg-zinc-500", className)} />;
    }

    switch (status) {
      case "online":
        return <div className={cn("w-2.5 h-2.5 rounded-full bg-emerald-500", className)} />;
      case "idle":
        return (
          <div className={cn("w-2.5 h-2.5 rounded-full bg-amber-500 relative", className)}>
            <div
              className="absolute inset-[3px] bg-background rounded-full"
              style={{ clipPath: "polygon(50% 0%, 100% 0%, 100% 100%, 50% 100%)" }}
            />
          </div>
        );
      case "dnd":
        return (
          <div className={cn("w-2.5 h-2.5 rounded-full bg-red-500 flex items-center justify-center", className)}>
            <div className="w-1.5 h-[2px] bg-background rounded-full" />
          </div>
        );
      default:
        return <div className={cn("w-2.5 h-2.5 rounded-full bg-zinc-500", className)} />;
    }
  },
);

StatusIndicator.displayName = "StatusIndicator";

// Section header component
const SectionHeader = memo(
  ({ label, count, color, colorDot }: { label: string; count: number; color?: string; colorDot?: string }) => (
    <div className="flex items-center gap-2 px-3 py-2">
      {colorDot && (
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={colorDot.startsWith("linear-gradient") ? { background: colorDot } : { backgroundColor: colorDot }}
        />
      )}
      <span className="text-[11px] font-semibold uppercase tracking-wider" style={color ? { color } : undefined}>
        {label}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground/70">{count}</span>
    </div>
  ),
);

SectionHeader.displayName = "SectionHeader";

export const MembersSidebar = () => {
  const { members, currentServer, roles, isLoading, fetchRolePermissions, assignRoleToMember, removeRoleFromMember } =
    useServerStore();
  const { user } = useAuthStore();
  const { openModal } = useUIStore();
  const navigate = useNavigate();
  const { openConversation } = useDMStore();
  const [offlineExpanded, setOfflineExpanded] = useState(false);

  // Subscribe to realtime member updates
  useRealtimeMembers(currentServer?.id || null);

  // Load permissions when server changes
  useEffect(() => {
    if (currentServer?.id) {
      fetchRolePermissions(currentServer.id);
    }
  }, [currentServer?.id, fetchRolePermissions]);

  // Get current user's role in this server
  const currentUserMember = members.find((m) => m.user_id === user?.id);
  const currentUserRole = currentUserMember?.role;

  // Use database-backed permission checking
  const { hasPermission: checkPermission } = useMemberPermissions();

  // Group members: roles first (only online members with roles), then online/offline (only no-role members)
  const { roleGroups, onlineNoRoleMembers, offlineNoRoleMembers } = useMemo(() => {
    const rolePositionById = new Map<string, number>();
    roles.forEach((r) => rolePositionById.set(r.id, r.position));

    const getResolvedRolePosition = (role: CustomServerRole): number => {
      const fromStore = rolePositionById.get(role.id);
      return typeof fromStore === "number" ? fromStore : role.position;
    };

    // Sort by role hierarchy then alphabetically
    const sortMembers = (a: ServerMember, b: ServerMember) => {
      const roleOrder = { owner: 0, admin: 1, moderator: 2, member: 3 };
      const roleA = roleOrder[a.role as keyof typeof roleOrder] ?? 3;
      const roleB = roleOrder[b.role as keyof typeof roleOrder] ?? 3;
      if (roleA !== roleB) return roleA - roleB;

      const aPriorityPos =
        a.roles && a.roles.length > 0 ? Math.min(...a.roles.map(getResolvedRolePosition)) : Number.POSITIVE_INFINITY;
      const bPriorityPos =
        b.roles && b.roles.length > 0 ? Math.min(...b.roles.map(getResolvedRolePosition)) : Number.POSITIVE_INFINITY;
      if (aPriorityPos !== bPriorityPos) return aPriorityPos - bPriorityPos;

      const nameA = a.nickname || a.user?.display_name || a.user?.username || "";
      const nameB = b.nickname || b.user?.display_name || b.user?.username || "";
      return nameA.localeCompare(nameB);
    };

    const roleGroupsMap: Map<string, ServerMember[]> = new Map();
    const noRoleMembers: ServerMember[] = [];

    roles.forEach((role) => {
      roleGroupsMap.set(role.id, []);
    });

    members.forEach((member) => {
      const memberRoles = member.roles || [];
      if (memberRoles.length > 0) {
        if (!getMemberPresence(member).isOffline) {
          const priorityRole = memberRoles.reduce((prev, curr) =>
            getResolvedRolePosition(curr) < getResolvedRolePosition(prev) ? curr : prev,
          );
          const roleMembers = roleGroupsMap.get(priorityRole.id) || [];
          roleMembers.push(member);
          roleGroupsMap.set(priorityRole.id, roleMembers);
        }
      } else {
        noRoleMembers.push(member);
      }
    });

    roleGroupsMap.forEach((membersList, roleId) => {
      roleGroupsMap.set(roleId, membersList.sort(sortMembers));
    });

    const online: ServerMember[] = [];
    const offline: ServerMember[] = [];

    noRoleMembers.forEach((member) => {
      if (getMemberPresence(member).isOffline) {
        offline.push(member);
      } else {
        online.push(member);
      }
    });

    return {
      roleGroups: roleGroupsMap,
      onlineNoRoleMembers: online.sort(sortMembers),
      offlineNoRoleMembers: offline.sort(sortMembers),
    };
  }, [members, roles]);

  // Show skeleton while loading
  if (isLoading) {
    return <MembersSidebarSkeleton />;
  }

  const handleMemberClick = (member: ServerMember) => {
    openModal("userProfile", { userId: member.user_id, user: member.user });
  };

  const handleMessage = async (member: ServerMember) => {
    if (!user) return;
    try {
      const conversation = await openConversation(user.id, member.user_id);
      if (conversation) {
        // Navigate using the app's built-in DM deep-link handler
        navigate(`/app?conversation=${conversation.id}`, { replace: true });
      }
    } catch (error) {
      console.error("Failed to open conversation:", error);
    }
  };

  const handleChangeNickname = (member: ServerMember) => {
    openModal("changeNickname", { member });
  };

  const handleKick = (member: ServerMember) => {
    openModal("confirmAction", {
      action: "kick",
      member,
      title: `Kick ${member.nickname || member.user?.username}`,
      message: `Are you sure you want to kick ${member.nickname || member.user?.username} from the server?`,
    });
  };

  const handleBan = (member: ServerMember) => {
    openModal("confirmAction", {
      action: "ban",
      member,
      title: `Ban ${member.nickname || member.user?.username}`,
      message: `Are you sure you want to ban ${member.nickname || member.user?.username} from the server? They will not be able to rejoin.`,
    });
  };

  const handleTransferOwnership = (member: ServerMember) => {
    openModal("confirmAction", {
      action: "transferOwnership",
      member,
      title: "Transfer Ownership",
      message: `Are you sure you want to transfer server ownership to ${member.nickname || member.user?.username}? This action cannot be undone.`,
    });
  };

  const toggleServerRole = async (member: ServerMember, roleId: string) => {
    if (!user) return;
    const memberRoles = member.roles || [];
    const hasRole = memberRoles.some((r) => r.id === roleId);
    try {
      if (hasRole) {
        await removeRoleFromMember(member.id, roleId, user.id);
      } else {
        await assignRoleToMember(member.id, roleId, user.id);
      }
    } catch (error) {
      console.error("Failed to update roles:", error);
    }
  };

  // Memoized MemberItem component
  const MemberItem = memo(({ member }: { member: ServerMember }) => {
    const displayName = member.nickname || member.user?.display_name || member.user?.username || "Unknown";
    const presence = getMemberPresence(member);
    const memberIsOffline = presence.isOffline;
    const isSelf = member.user_id === user?.id;
    const isServerOwner = member.role === "owner";

    const priorityCustomRoleColor = useMemo(() => {
      const memberRoles = member.roles || [];
      if (memberRoles.length === 0) return null;
      const resolved = memberRoles
        .map((mr) => roles.find((r) => r.id === mr.id) ?? mr)
        .filter(Boolean) as CustomServerRole[];
      let best: CustomServerRole | null = null;
      for (const r of resolved) {
        if (!best) {
          best = r;
          continue;
        }
        const aPos = typeof r.position === "number" ? r.position : Number.POSITIVE_INFINITY;
        const bPos = typeof best.position === "number" ? best.position : Number.POSITIVE_INFINITY;
        if (aPos < bPos) best = r;
      }
      return best?.color ?? null;
    }, [member.roles]);

    const isGradientName = !!priorityCustomRoleColor && priorityCustomRoleColor.startsWith("linear-gradient");

    // Permission checks
    const canKick = checkPermission("kick_members") && canModerate(currentUserRole, member.role) && !isSelf;
    const canBan = checkPermission("ban_members") && canModerate(currentUserRole, member.role) && !isSelf;
    const canChangeNickname =
      checkPermission("manage_nicknames") && (canModerate(currentUserRole, member.role) || isSelf);
    const canTransfer = checkPermission("transfer_ownership") && !isSelf && member.role !== "owner";
    const canManageRoles = checkPermission("manage_roles") && canModerate(currentUserRole, member.role) && !isSelf;

    const hasAdminActions =
      canKick || canBan || canChangeNickname || canTransfer || (canManageRoles && roles.length > 0);
    const roleInfo = getRoleInfo(member.role);

    const content = (
      <div
        className={cn(
          "group flex items-center gap-2.5 mx-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors",
          "hover:bg-secondary/60 active:bg-secondary/80",
        )}
        onClick={() => handleMemberClick(member)}
      >
        {/* Avatar with status */}
        <div className="relative flex-shrink-0">
          <AvatarWithDecoration
            user={member.user}
            className={cn("w-8 h-8 rounded-full", memberIsOffline && "opacity-40 grayscale-[30%]")}
          />
          <div className="absolute -bottom-0.5 -right-0.5 p-[2px] bg-background rounded-full">
            <StatusIndicator status={presence.status} isStale={presence.isOffline && presence.isStale} />
          </div>
        </div>

        {/* Name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isServerOwner && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            <span
              className={cn(
                "text-sm truncate",
                memberIsOffline
                  ? "text-muted-foreground/70"
                  : priorityCustomRoleColor
                    ? isGradientName
                      ? "font-medium"
                      : ""
                    : roleInfo.color,
              )}
              style={
                !memberIsOffline && priorityCustomRoleColor
                  ? isGradientName
                    ? ({
                        background: priorityCustomRoleColor,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                      } as React.CSSProperties)
                    : ({ color: priorityCustomRoleColor } as React.CSSProperties)
                  : undefined
              }
            >
              {displayName}
            </span>
            {member.is_muted && <VolumeX className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />}
          </div>

          {member.user?.custom_status && (
            <p
              className={cn(
                "text-[11px] truncate mt-0.5",
                memberIsOffline ? "text-muted-foreground/50" : "text-muted-foreground",
              )}
            >
              {member.user.custom_status}
            </p>
          )}
        </div>
      </div>
    );

    // Only show context menu if there are any actions available
    if (!hasAdminActions && isSelf) {
      return content;
    }

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
        <ContextMenuContent className="w-52 rounded-xl border-border/50 p-1.5">
          {/* Basic actions */}
          <ContextMenuItem onClick={() => handleMessage(member)} className="rounded-lg gap-3 hover:bg-primary/80">
            <MessageSquare className="w-4 h-4" />
            Message
          </ContextMenuItem>

          {canChangeNickname && (
            <ContextMenuItem onClick={() => handleChangeNickname(member)} className="rounded-lg gap-3">
              <Edit3 className="w-4 h-4" />
              Change Nickname
            </ContextMenuItem>
          )}

          {/* Moderation actions */}
          {(canKick || canBan) && (
            <>
              <ContextMenuSeparator className="my-1.5" />

              {canKick && (
                <ContextMenuItem
                  onClick={() => handleKick(member)}
                  className="rounded-lg gap-3 text-orange-400 focus:text-orange-400"
                >
                  <UserX className="w-4 h-4" />
                  Kick
                </ContextMenuItem>
              )}

              {canBan && (
                <ContextMenuItem
                  onClick={() => handleBan(member)}
                  className="rounded-lg gap-3 text-destructive focus:text-destructive"
                >
                  <Ban className="w-4 h-4" />
                  Ban
                </ContextMenuItem>
              )}
            </>
          )}

          {/* Role management */}
          {canManageRoles && roles.length > 0 && (
            <>
              <ContextMenuSeparator className="my-1.5" />
              <ContextMenuSub>
                <ContextMenuSubTrigger className="rounded-lg gap-3">
                  <Shield className="w-4 h-4" />
                  Change Roles
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-40 rounded-xl border-border/50 p-1.5">
                  {roles.map((role) => {
                    const memberRoles = member.roles || [];
                    const hasRole = memberRoles.some((r) => r.id === role.id);
                    const isGradient = role.color.startsWith("linear-gradient");
                    return (
                      <ContextMenuItem
                        key={role.id}
                        onClick={() => toggleServerRole(member, role.id)}
                        className="rounded-lg gap-3"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={isGradient ? { background: role.color } : { backgroundColor: role.color }}
                        />
                        <span className="flex-1 truncate">{role.name}</span>
                        {hasRole && <span className="text-xs text-muted-foreground">✓</span>}
                      </ContextMenuItem>
                    );
                  })}
                </ContextMenuSubContent>
              </ContextMenuSub>
            </>
          )}

          {/* Ownership transfer */}
          {canTransfer && (
            <>
              <ContextMenuSeparator className="my-1.5" />
              <ContextMenuItem
                onClick={() => handleTransferOwnership(member)}
                className="rounded-lg gap-3 text-amber-400 focus:text-amber-400"
              >
                <Crown className="w-4 h-4" />
                Transfer Ownership
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
    );
  });

  MemberItem.displayName = "MemberItem";

  const totalCount = members.length;
  
  // Calculate online count (all members not offline)
  const onlineCount = useMemo(() => {
    return members.filter((m) => !getMemberPresence(m).isOffline).length;
  }, [members]);

  return (
    <div className="h-full flex flex-col bg-background/50 border-l border-border/50 w-60">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Members</h3>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-emerald-500">{onlineCount}</span>
            <span className="mx-1">/</span>
            <span>{totalCount}</span>
          </p>
        </div>
      </div>

      {/* Members List */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Roles section */}
        {roles
          .sort((a, b) => a.position - b.position)
          .map((role) => {
            const roleMembers = roleGroups.get(role.id) || [];
            if (roleMembers.length === 0) return null;

            const isGradient = role.color.startsWith("linear-gradient");
            const textColor = isGradient ? (role.color.match(/#[0-9a-fA-F]{6}/) || ["#5865F2"])[0] : role.color;

            return (
              <div key={role.id} className="mb-3">
                <SectionHeader label={role.name} count={roleMembers.length} color={textColor} colorDot={role.color} />
                <div className="space-y-0.5">
                  {roleMembers.map((member) => (
                    <MemberItem key={member.id} member={member} />
                  ))}
                </div>
              </div>
            );
          })}

        {/* Online section - only members with no roles */}
        {onlineNoRoleMembers.length > 0 && (
          <div className="mb-3">
            <SectionHeader label="Online" count={onlineNoRoleMembers.length} />
            <div className="space-y-0.5">
              {onlineNoRoleMembers.map((member) => (
                <MemberItem key={member.id} member={member} />
              ))}
            </div>
          </div>
        )}

        {/* Offline section - collapsible */}
        {offlineNoRoleMembers.length > 0 && (
          <Collapsible open={offlineExpanded} onOpenChange={setOfflineExpanded}>
            <CollapsibleTrigger
              className="flex items-center gap-2 px-3 py-2 w-full hover:bg-secondary/30 rounded-lg mx-2 transition-colors"
              style={{ width: "calc(100% - 16px)" }}
            >
              <div className={cn("transition-transform duration-200", offlineExpanded && "rotate-90")}>
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Offline</span>
              <span className="text-[11px] font-medium text-muted-foreground/70">{offlineNoRoleMembers.length}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-0.5 pt-1">
                {offlineNoRoleMembers.map((member) => (
                  <MemberItem key={member.id} member={member} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Empty state */}
        {members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No members</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Members will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};
