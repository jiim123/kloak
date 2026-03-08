import { useMemo, useEffect, memo, useState, useRef } from "react";
import { ViewportList } from "react-viewport-list";
import { cn, pickFirstNonBlank } from "@/lib/utils";
import { Crown, MessageSquare, Edit3, UserX, Ban, VolumeX, Shield, Users, ChevronDown, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useDMStore } from "@/stores/dmStore";
import { useFriendStore } from "@/stores/friendStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRealtimeMembers } from "@/hooks/useRealtimeMembers";
import { canModerateByRoles } from "@/lib/permissions";
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
import { MembersSidebarSkeleton } from "@/components/ui/skeletons";
import { AvatarWithDecoration } from "@/components/ui/avatar-with-decoration";
import { BotTag } from "@/components/ui/bot-tag";
import { RoleIconPreview } from "@/components/ui/role-icon-preview";
import { supabase } from "@/integrations/supabase/client";
import type { ServerMember, CustomServerRole, UserStatus } from "@/types";
import { getEffectivePresence } from "@/lib/presence";
import { hasRecentRealtimePresence } from "@/hooks/useRealtimeUsers";

const OFFLINE_PAGE_SIZE = 50;

type MemberListRow =
  | {
      kind: "section";
      key: string;
      label: string;
      count: number;
      color?: string;
      colorDot?: string;
      icon?: string | null;
      withTopSpacing?: boolean;
    }
  | {
      kind: "member";
      key: string;
      member: ServerMember;
    }
  | {
      kind: "offline-toggle";
      key: "offline-toggle";
    }
  | {
      kind: "offline-loading";
      key: "offline-loading";
    }
  | {
      kind: "offline-empty";
      key: "offline-empty";
    }
  | {
      kind: "offline-load-more";
      key: "offline-load-more";
    }
  | {
      kind: "empty-state";
      key: "empty-state";
    };

type OfflineMembersPageResponse = {
  members?: unknown;
  has_more?: boolean;
  next_cursor_joined_at?: string | null;
  next_cursor_member_id?: string | null;
  offline_count?: number | null;
};

type OfflineMemberRow = {
  id: string;
  server_id: string;
  user_id: string;
  role: ServerMember["role"];
  nickname: string | null;
  is_banned: boolean;
  is_muted: boolean;
  joined_at: string;
  join_source?: ServerMember["join_source"];
  join_invite_code?: string | null;
  user?: ServerMember["user"];
  roles?: ServerMember["roles"];
};

const parseJson = <T,>(value: unknown, fallback: T): T => {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
};
const getMemberPresence = (member: ServerMember) => {
  const status = (member.user?.status as UserStatus | undefined) ?? "offline";
  if (status !== "offline" && hasRecentRealtimePresence(member.user_id)) {
    return { status, isStale: false, isOffline: false };
  }
  const lastSeen = member.user?.last_seen;
  return getEffectivePresence(status, lastSeen);
};

// Memoized Status indicator component
const StatusIndicator = memo(
  ({
    status,
    isStale,
    isInvisible,
    className,
  }: {
    status?: string;
    isStale?: boolean;
    isInvisible?: boolean;
    className?: string;
  }) => {
    // Show hollow circle for the current user when invisible
    if (isInvisible) {
      return (
        <div
          className={cn("w-2.5 h-2.5 rounded-full border-[1.5px] bg-transparent", className)}
          style={{ borderColor: "hsl(var(--muted-foreground))" }}
        />
      );
    }

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
  ({
    label,
    count,
    color,
    colorDot,
    icon,
    serverId,
  }: {
    label: string;
    count: number;
    color?: string;
    colorDot?: string;
    icon?: string | null;
    serverId?: string;
  }) => (
    <div className="flex items-center gap-2 px-3 py-2">
      {icon && serverId ? (
        <RoleIconPreview icon={icon} serverId={serverId} className="flex-shrink-0" />
      ) : colorDot ? (
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={colorDot.startsWith("linear-gradient") ? { background: colorDot } : { backgroundColor: colorDot }}
        />
      ) : null}
      <span className="text-[11px] font-medium uppercase tracking-wider" style={color ? { color } : undefined}>
        {label}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground/70">{count}</span>
    </div>
  ),
);

SectionHeader.displayName = "SectionHeader";

export const MembersSidebar = () => {
  const isMobile = useIsMobile();
  // Use individual selectors to prevent re-renders on unrelated store changes (e.g. channel switch)
  const members = useServerStore((s) => s.members);
  const currentServer = useServerStore((s) => s.currentServer);
  const roles = useServerStore((s) => s.roles);
  const isMembersLoading = useServerStore((s) => s.isMembersLoading);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const fetchRolePermissions = useServerStore((s) => s.fetchRolePermissions);
  const assignRoleToMember = useServerStore((s) => s.assignRoleToMember);
  const removeRoleFromMember = useServerStore((s) => s.removeRoleFromMember);
  const { user } = useAuthStore();
  const { openModal, isMemberSidebarOpen, setMemberSidebarOpen } = useUIStore();
  const navigate = useNavigate();
  const { openConversation } = useDMStore();
  const blockedUserIds = useFriendStore((s) => s.visibilityBlockedUserIds);
  const [totalMemberCount, setTotalMemberCount] = useState<number | null>(null);
  const [isOfflineExpanded, setIsOfflineExpanded] = useState(false);
  const [offlineMembers, setOfflineMembers] = useState<ServerMember[]>([]);
  const [offlineHasMore, setOfflineHasMore] = useState(false);
  const [offlineIsLoading, setOfflineIsLoading] = useState(false);
  const [offlineLoadedOnce, setOfflineLoadedOnce] = useState(false);
  const [offlineCount, setOfflineCount] = useState<number | null>(null);
  const [offlineCursorJoinedAt, setOfflineCursorJoinedAt] = useState<string | null>(null);
  const [offlineCursorMemberId, setOfflineCursorMemberId] = useState<string | null>(null);
  const offlineLoadingRef = useRef(false);
  const listViewportRef = useRef<HTMLDivElement | null>(null);

  // Subscribe to realtime member updates
  useRealtimeMembers(currentServer?.id || null);

  // Lazy-load members only when the members UI is opened/visible.
  useEffect(() => {
    if (!currentServer?.id) return;
    // Desktop: component only mounts when open; Mobile: always mounted, so gate on open state.
    if (!isMemberSidebarOpen && isMobile) return;
    fetchMembers(currentServer.id);
  }, [currentServer?.id, isMemberSidebarOpen, isMobile, fetchMembers]);

  // Load permissions when server changes
  useEffect(() => {
    if (currentServer?.id) {
      fetchRolePermissions(currentServer.id);
    }
  }, [currentServer?.id, fetchRolePermissions]);

  // Fetch total member count (online + offline) for header display.
  useEffect(() => {
    if (!currentServer?.id || !user?.id) return;
    if (!isMemberSidebarOpen && isMobile) return;

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.rpc("get_server_member_count_secure", {
          _server_id: currentServer.id,
          _user_id: user.id,
        });

        if (error) throw error;
        if (cancelled) return;

        const count = typeof data === "number" ? data : Number(data);
        setTotalMemberCount(Number.isFinite(count) ? count : null);
      } catch (error) {
        console.error("Failed to fetch total member count:", error);
        if (!cancelled) setTotalMemberCount(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentServer?.id, isMemberSidebarOpen, isMobile, user?.id]);

  // Filter out offline/invisible members
  const onlineMembers = useMemo(() => {
    return members.filter((m) => !getMemberPresence(m).isOffline);
  }, [members]);
  const onlineMemberUserIdSet = useMemo(() => new Set(onlineMembers.map((m) => m.user_id)), [onlineMembers]);

  // Reset paginated offline section when changing servers.
  useEffect(() => {
    setIsOfflineExpanded(false);
    setOfflineMembers([]);
    setOfflineHasMore(false);
    setOfflineIsLoading(false);
    setOfflineLoadedOnce(false);
    setOfflineCount(null);
    setOfflineCursorJoinedAt(null);
    setOfflineCursorMemberId(null);
    offlineLoadingRef.current = false;
  }, [currentServer?.id]);

  // Keep offline section and online section mutually exclusive as presence updates stream in.
  useEffect(() => {
    if (offlineMembers.length === 0 || onlineMemberUserIdSet.size === 0) return;
    setOfflineMembers((prev) => {
      const filtered = prev.filter((m) => !onlineMemberUserIdSet.has(m.user_id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [offlineMembers.length, onlineMemberUserIdSet]);

  const loadOfflineMembers = async (opts?: { reset?: boolean }) => {
    const reset = opts?.reset === true;
    if (!currentServer?.id || !user?.id) return;
    if (offlineLoadingRef.current) return;
    if (!reset && offlineLoadedOnce && !offlineHasMore) return;

    offlineLoadingRef.current = true;
    setOfflineIsLoading(true);
    try {
      const rpc = supabase.rpc.bind(supabase) as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: unknown }>;

      const { data, error } = await rpc("get_server_members_offline_page_secure", {
        _server_id: currentServer.id,
        _user_id: user.id,
        _limit: OFFLINE_PAGE_SIZE,
        _cursor_joined_at: reset ? null : offlineCursorJoinedAt,
        _cursor_member_id: reset ? null : offlineCursorMemberId,
        _include_count: reset || !offlineLoadedOnce,
      });

      if (error) throw error;

      const payload = parseJson<OfflineMembersPageResponse>(data, {});
      const rawMembers = parseJson<OfflineMemberRow[]>(payload.members, []);
      const blockedSet = new Set(blockedUserIds);

      const mapped: ServerMember[] = rawMembers
        .filter((item) => !item.is_banned)
        .filter((item) => !blockedSet.has(item.user_id))
        .filter((item) => !onlineMemberUserIdSet.has(item.user_id))
        .map((item) => ({
          id: item.id,
          server_id: item.server_id,
          user_id: item.user_id,
          role: item.role,
          nickname: item.nickname,
          is_banned: item.is_banned,
          is_muted: item.is_muted,
          joined_at: item.joined_at,
          join_source: item.join_source,
          join_invite_code: item.join_invite_code ?? null,
          user: item.user,
          roles: item.roles,
        }));

      setOfflineMembers((prev) => {
        if (reset) return mapped;
        const seen = new Set(prev.map((m) => m.id));
        const next = mapped.filter((m) => !seen.has(m.id));
        return next.length > 0 ? [...prev, ...next] : prev;
      });

      const hasMore = Boolean(payload.has_more);
      setOfflineHasMore(hasMore);
      setOfflineCursorJoinedAt(hasMore ? (payload.next_cursor_joined_at ?? null) : null);
      setOfflineCursorMemberId(hasMore ? (payload.next_cursor_member_id ?? null) : null);
      if (typeof payload.offline_count === "number") {
        setOfflineCount(payload.offline_count);
      }
      setOfflineLoadedOnce(true);
    } catch (error) {
      console.error("Failed to load offline members:", error);
    } finally {
      offlineLoadingRef.current = false;
      setOfflineIsLoading(false);
    }
  };

  const handleToggleOfflineSection = () => {
    const nextExpanded = !isOfflineExpanded;
    setIsOfflineExpanded(nextExpanded);
    if (nextExpanded && !offlineLoadedOnce) {
      void loadOfflineMembers({ reset: true });
    }
  };

  // Use database-backed permission checking
  const { hasPermission: checkPermission, isOwner: currentUserIsOwner } = useMemberPermissions();

  // Get current user's member for role comparison
  const currentUserMember = members.find((m) => m.user_id === user?.id);

  const onlineCount = onlineMembers.length;
  const visibleCount = onlineMembers.length + offlineMembers.length;
  const offlineDisplayCount = offlineCount ?? (offlineLoadedOnce ? offlineMembers.length : null);

  // Group members: roles first (all members with roles), then all no-role members.
  const { roleGroups, noRoleMembers } = useMemo(() => {
    const rolePositionById = new Map<string, number>();
    roles.forEach((r) => rolePositionById.set(r.id, r.position));

    const getResolvedRolePosition = (role: CustomServerRole): number => {
      const fromStore = rolePositionById.get(role.id);
      return typeof fromStore === "number" ? fromStore : role.position;
    };

    // Sort by custom role position then alphabetically
    const sortMembers = (a: ServerMember, b: ServerMember) => {
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

    onlineMembers.forEach((member) => {
      const memberRoles = member.roles || [];
      if (memberRoles.length > 0) {
        const priorityRole = memberRoles.reduce((prev, curr) =>
          getResolvedRolePosition(curr) < getResolvedRolePosition(prev) ? curr : prev,
        );
        const roleMembers = roleGroupsMap.get(priorityRole.id) || [];
        roleMembers.push(member);
        roleGroupsMap.set(priorityRole.id, roleMembers);
      } else {
        noRoleMembers.push(member);
      }
    });

    roleGroupsMap.forEach((membersList, roleId) => {
      roleGroupsMap.set(roleId, membersList.sort(sortMembers));
    });

    return {
      roleGroups: roleGroupsMap,
      noRoleMembers: noRoleMembers.sort(sortMembers),
    };
  }, [onlineMembers, roles]);

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

  const renderMemberItem = (member: ServerMember) => {
    const displayName =
      pickFirstNonBlank(member.nickname, member.user?.display_name, member.user?.username) ?? "Unknown";
    const presence = getMemberPresence(member);
    const memberIsOffline = presence.isOffline;
    const isSelf = member.user_id === user?.id;
    const isServerOwner = currentServer?.owner_id === member.user_id;

    const memberRoles = member.roles || [];
    let priorityCustomRoleColor: string | null = null;
    if (memberRoles.length > 0) {
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
      priorityCustomRoleColor = best?.color ?? null;
    }

    const isGradientName = !!priorityCustomRoleColor && priorityCustomRoleColor.startsWith("linear-gradient");

    // Permission checks using role position comparison
    const canMod = canModerateByRoles(currentUserIsOwner, currentUserMember?.roles, isServerOwner, member.roles);
    const canKick = checkPermission("kick_members") && canMod && !isSelf;
    const canBan = checkPermission("ban_members") && canMod && !isSelf;
    const canChangeNickname = checkPermission("manage_nicknames") && (canMod || isSelf);
    const canTransfer = currentUserIsOwner && !isSelf && !isServerOwner;
    const canManageRoles =
      checkPermission("manage_roles") && (canMod || (isSelf && isServerOwner) || currentUserIsOwner);

    const hasAdminActions = canKick || canBan || canChangeNickname || canTransfer || canManageRoles;

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
            showDecoration={false}
          />
          <div className="absolute -bottom-0.5 -right-0.5 p-[2px] bg-background rounded-full">
            <StatusIndicator
              status={presence.status}
              isStale={presence.isOffline && presence.isStale}
              isInvisible={isSelf && useAuthStore.getState().manualStatus === "offline"}
            />
          </div>
        </div>

        {/* Name and info */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5">
            {isServerOwner && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            <span
              className={cn(
                "text-[14px] sm:text-[15px] font-medium truncate leading-tight",
                memberIsOffline
                  ? "text-muted-foreground/70"
                  : priorityCustomRoleColor
                    ? ""
                    : "text-foreground",
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
            {member.user?.is_bot && (
              <BotTag className="flex-shrink-0" />
            )}
            {member.is_muted && <VolumeX className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />}
          </div>

          {member.user?.custom_status && (
            <p
              className={cn(
                "text-[11px] truncate mt-0.5 max-w-[140px]",
                memberIsOffline ? "text-muted-foreground/50" : "text-muted-foreground",
              )}
              title={member.user.custom_status}
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
          {canManageRoles && (
            <>
              <ContextMenuSeparator className="my-1.5" />
              <ContextMenuSub>
                <ContextMenuSubTrigger className="rounded-lg gap-3">
                  <Shield className="w-4 h-4" />
                  Roles
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-44 rounded-xl border-border/50 p-1.5" sideOffset={4}>
                  {/* Custom roles */}
                  {roles.length > 0 && (
                    <>
                      <div className="px-2 py-1 mt-1 text-[10px] font-medium uppercase text-muted-foreground tracking-wider">
                        Custom Roles
                      </div>
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
                    </>
                  )}
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
  };

  const memberListRows = useMemo<MemberListRow[]>(() => {
    const rows: MemberListRow[] = [];

    [...roles]
      .sort((a, b) => a.position - b.position)
      .forEach((role) => {
        const roleMembers = roleGroups.get(role.id) || [];
        if (roleMembers.length === 0) return;
        const isGradient = role.color.startsWith("linear-gradient");
        const textColor = isGradient ? (role.color.match(/#[0-9a-fA-F]{6}/) || ["#5865F2"])[0] : role.color;
        rows.push({
          kind: "section",
          key: `section-role-${role.id}`,
          label: role.name,
          count: roleMembers.length,
          color: textColor,
          colorDot: role.color,
          icon: role.icon,
          withTopSpacing: rows.length > 0,
        });
        roleMembers.forEach((member) => {
          rows.push({ kind: "member", key: `member-online-${member.id}`, member });
        });
      });

    if (noRoleMembers.length > 0) {
      rows.push({
        kind: "section",
        key: "section-no-role",
        label: "Members",
        count: noRoleMembers.length,
        withTopSpacing: rows.length > 0,
      });
      noRoleMembers.forEach((member) => {
        rows.push({ kind: "member", key: `member-online-${member.id}`, member });
      });
    }

    rows.push({ kind: "offline-toggle", key: "offline-toggle" });

    if (isOfflineExpanded) {
      offlineMembers.forEach((member) => {
        rows.push({ kind: "member", key: `member-offline-${member.id}`, member });
      });

      if (offlineIsLoading) {
        rows.push({ kind: "offline-loading", key: "offline-loading" });
      }

      if (!offlineIsLoading && offlineLoadedOnce && offlineMembers.length === 0) {
        rows.push({ kind: "offline-empty", key: "offline-empty" });
      }

      if (!offlineIsLoading && offlineHasMore) {
        rows.push({ kind: "offline-load-more", key: "offline-load-more" });
      }
    }

    if (totalMemberCount === 0 && visibleCount === 0) {
      rows.push({ kind: "empty-state", key: "empty-state" });
    }

    return rows;
  }, [
    roles,
    roleGroups,
    noRoleMembers,
    isOfflineExpanded,
    offlineMembers,
    offlineIsLoading,
    offlineLoadedOnce,
    offlineHasMore,
    totalMemberCount,
    visibleCount,
  ]);

  const renderMemberListRow = (row: MemberListRow) => {
    if (row.kind === "section") {
      return (
        <div className={cn(row.withTopSpacing && "mt-2")}>
          <SectionHeader
            label={row.label}
            count={row.count}
            color={row.color}
            colorDot={row.colorDot}
            icon={row.icon}
            serverId={currentServer?.id}
          />
        </div>
      );
    }

    if (row.kind === "member") {
      return renderMemberItem(row.member);
    }

    if (row.kind === "offline-toggle") {
      return (
        <button
          type="button"
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-secondary/40 transition-colors mt-2"
          onClick={handleToggleOfflineSection}
        >
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-muted-foreground transition-transform",
              isOfflineExpanded && "rotate-180",
            )}
          />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Offline</span>
          {offlineDisplayCount != null && (
            <span className="text-[11px] font-medium text-muted-foreground/70">{offlineDisplayCount}</span>
          )}
        </button>
      );
    }

    if (row.kind === "offline-loading") {
      return (
        <div className="px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading offline members...
        </div>
      );
    }

    if (row.kind === "offline-empty") {
      return <p className="px-3 py-2 text-[11px] text-muted-foreground/80">No offline members</p>;
    }

    if (row.kind === "offline-load-more") {
      return (
        <div className="px-3 pt-1">
          <button
            type="button"
            className="text-[11px] text-primary hover:text-primary/80 transition-colors"
            onClick={() => void loadOfflineMembers()}
          >
            Load more
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
          <Users className="w-6 h-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No members</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Members will appear here</p>
      </div>
    );
  };

  // Show skeleton only while members are actually loading (not global isLoading)
  if (isMembersLoading && members.length === 0) {
    return <MembersSidebarSkeleton />;
  }

  const sidebarContent = (
    <div className="h-full flex flex-col bg-background/50 border-l border-border/50 w-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50">
        <h3 className="text-sm font-medium">Members</h3>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
          <span className="text-muted-foreground">{onlineCount} online</span>
          {totalMemberCount != null && <span className="text-muted-foreground">•</span>}
          {totalMemberCount != null && <span className="text-muted-foreground">{totalMemberCount} members</span>}
        </p>
      </div>

      {/* Members List */}
      <div ref={listViewportRef} className="flex-1 overflow-y-auto py-2">
        <ViewportList
          viewportRef={listViewportRef}
          items={memberListRows}
          itemSize={44}
          overscan={14}
        >
          {(row) => <div key={row.key}>{renderMemberListRow(row)}</div>}
        </ViewportList>
      </div>
    </div>
  );

  // Mobile: render as a right-side drawer (Sheet)
  if (isMobile) {
    return (
      <Sheet open={isMemberSidebarOpen} onOpenChange={setMemberSidebarOpen}>
        <SheetContent
          side="right"
          className="p-0 w-60 max-w-[80vw]"
          hideCloseButton
          onInteractOutside={(event) => {
            // Prevent closing when interacting with context menus or dropdowns
            const target = event.target as HTMLElement | null;
            if (target?.closest("[data-radix-popper-content-wrapper]") || target?.closest('[role="menu"]')) {
              event.preventDefault();
            }
          }}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Members</SheetTitle>
          </SheetHeader>
          <div className="h-full bg-layout-members">{sidebarContent}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: render as inline panel
  return sidebarContent;
};
