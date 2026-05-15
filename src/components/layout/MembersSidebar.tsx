import { useMemo, useEffect, memo, useState, useRef, forwardRef, useCallback } from "react";
import { ViewportList } from "react-viewport-list";
import { cn, pickFirstNonBlank } from "@/lib/utils";
import {
  Crown,
  MessageSquare,
  Edit3,
  UserX,
  Ban,
  VolumeX,
  Shield,
  Users,
  ChevronDown,
  Loader2,
  ListChecks,
  Plus,
  X,
  Check,
  Search,
  CalendarDays,
  Globe,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useDMStore } from "@/stores/dmStore";
import { useFriendStore } from "@/stores/friendStore";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
import { Button } from "@/components/ui/button";
import type { ServerMember, CustomServerRole, UserStatus } from "@/types";
import { getEffectivePresence } from "@/lib/presence";
import { hasRecentRealtimePresence } from "@/hooks/useRealtimeUsers";
import { readCachedMemberCount, persistMemberCount } from "@/lib/serverMemberCount";
import { LEFT_ALIGNED_USER_PROFILE_POPOVER, openUserProfileModal } from "@/lib/userProfilePopover";
import { getUserFromCache, useUserCacheStore } from "@/stores/userCacheStore";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const OFFLINE_PAGE_SIZE = 50;
const EMPTY_ROLES: CustomServerRole[] = [];

// FIX #1: Static style object — was inline `as React.CSSProperties` on every render
const TOUCH_CALLOUT_STYLE = { WebkitTouchCallout: "none" } as React.CSSProperties;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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
  | { kind: "member"; key: string; member: ServerMember }
  | { kind: "offline-toggle"; key: "offline-toggle" }
  | { kind: "offline-loading"; key: "offline-loading" }
  | { kind: "offline-empty"; key: "offline-empty" }
  | { kind: "offline-load-more"; key: "offline-load-more" }
  | { kind: "empty-state"; key: "empty-state" };

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

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

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
  return getEffectivePresence(status, lastSeen, member.user_id);
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS (memoized)
// ─────────────────────────────────────────────────────────────────────────────

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
        return <div className={cn("w-2.5 h-2.5 rounded-full bg-kloak-online", className)} />;
      case "idle":
        return <div className={cn("w-2.5 h-2.5 rounded-full bg-kloak-idle", className)} />;
      case "dnd":
        return <div className={cn("w-2.5 h-2.5 rounded-full bg-kloak-dnd", className)} />;
      default:
        return <div className={cn("w-2.5 h-2.5 rounded-full bg-kloak-offline", className)} />;
    }
  },
);
StatusIndicator.displayName = "StatusIndicator";

type MemberListItemContentProps = {
  member: ServerMember;
  memberIsOffline: boolean;
  presence: ReturnType<typeof getMemberPresence>;
  displayName: string;
  isServerOwner: boolean;
  priorityCustomRoleColor: string | null;
  isGradientName: boolean;
  // FIX #2: Accept pre-computed auth values as props instead of calling useAuthStore.getState() in render
  isInvisibleSelf: boolean;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
} & Omit<React.ComponentPropsWithoutRef<"div">, "onClick">;

const MemberListItemContent = forwardRef<HTMLDivElement, MemberListItemContentProps>(
  (
    {
      member,
      memberIsOffline,
      presence,
      displayName,
      isServerOwner,
      priorityCustomRoleColor,
      isGradientName,
      isInvisibleSelf,
      onClick,
      className,
      style,
      onMouseEnter,
      onMouseLeave,
      ...props
    },
    ref,
  ) => {
    const [isHovered, setIsHovered] = useState(false);

    // FIX #3: Stabilize mouse handlers instead of creating inline arrows every render
    const handleMouseEnter = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        setIsHovered(true);
        onMouseEnter?.(event);
      },
      [onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        setIsHovered(false);
        onMouseLeave?.(event);
      },
      [onMouseLeave],
    );

    // FIX #4: Merge style objects once instead of spread-creating a new object every render
    const mergedStyle = useMemo(() => (style ? { ...style, ...TOUCH_CALLOUT_STYLE } : TOUCH_CALLOUT_STYLE), [style]);

    // FIX #5: Pre-compute the name style object to avoid inline ternary object creation
    const nameStyle = useMemo(() => {
      if (memberIsOffline || !priorityCustomRoleColor) return undefined;
      if (isGradientName) {
        return {
          background: priorityCustomRoleColor,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        } as React.CSSProperties;
      }
      return { color: priorityCustomRoleColor } as React.CSSProperties;
    }, [memberIsOffline, priorityCustomRoleColor, isGradientName]);

    return (
      <div
        ref={ref}
        className={cn(
          "group flex items-center gap-2 mx-1.5 my-0.5 px-1 py-1.5 rounded-md cursor-pointer transition-colors",
          "hover:bg-secondary/45 active:bg-secondary/70",
          className,
        )}
        style={mergedStyle}
        onClick={onClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <div className="relative flex-shrink-0">
          <AvatarWithDecoration
            user={member.user}
            className={cn("w-8 h-8 rounded-full", memberIsOffline && "opacity-50 grayscale-[30%]")}
            showDecoration={false}
            freezeGifUntilHover
            active={isHovered}
          />
          <div className="absolute -bottom-0.5 -right-0.5 p-[2px] bg-layout-members rounded-full">
            <StatusIndicator
              status={presence.status}
              isStale={presence.isOffline && presence.isStale}
              isInvisible={isInvisibleSelf}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-1.5">
            {isServerOwner && <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />}
            <span
              className={cn(
                "text-[14px] font-semibold truncate leading-tight",
                memberIsOffline ? "text-muted-foreground/70" : priorityCustomRoleColor ? "" : "text-foreground",
              )}
              style={nameStyle}
            >
              {displayName}
            </span>
            {member.user?.is_bot && <BotTag className="flex-shrink-0" />}
            {member.is_muted && <VolumeX className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />}
          </div>

          {member.user?.custom_status && (
            <p
              className={cn(
                "text-[11px] truncate mt-0.5 max-w-[154px]",
                memberIsOffline ? "text-muted-foreground/60" : "text-muted-foreground/80",
              )}
              title={member.user.custom_status}
            >
              {member.user.custom_status}
            </p>
          )}
        </div>
      </div>
    );
  },
);
MemberListItemContent.displayName = "MemberListItemContent";

// Section header — already memo'd, keep as-is
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
    <div className="flex items-center gap-1 px-3 pb-1.5 pt-3">
      {false && icon && serverId ? (
        <RoleIconPreview icon={icon} serverId={serverId} className="flex-shrink-0" />
      ) : colorDot ? (
        <div
          className="hidden w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={colorDot.startsWith("linear-gradient") ? { background: colorDot } : { backgroundColor: colorDot }}
        />
      ) : null}
      <span className="text-[13px] font-bold text-muted-foreground">
        {count}
      </span>
      <span className="text-[13px] font-bold text-muted-foreground">{label}</span>
    </div>
  ),
);
SectionHeader.displayName = "SectionHeader";

// FIX #6: Extract the empty state into a static memo component
const EmptyState = memo(() => (
  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
    <div className="w-12 h-12 rounded-xl bg-secondary/50 flex items-center justify-center mb-3">
      <Users className="w-6 h-6 text-muted-foreground/50" />
    </div>
    <p className="text-sm font-medium text-muted-foreground">No members</p>
    <p className="text-xs text-muted-foreground/70 mt-1">Members will appear here</p>
  </div>
));
EmptyState.displayName = "EmptyState";

// FIX #7: Extract offline loading indicator — static, no need to re-create JSX
const OfflineLoadingRow = memo(() => (
  <div className="px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-2">
    <Loader2 className="w-3.5 h-3.5 animate-spin" />
    Loading offline members...
  </div>
));
OfflineLoadingRow.displayName = "OfflineLoadingRow";

const OfflineEmptyRow = memo(() => (
  <p className="px-3 py-2 text-[11px] text-muted-foreground/80">No offline members</p>
));
OfflineEmptyRow.displayName = "OfflineEmptyRow";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export const MembersSidebar = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const location = useLocation();

  // FIX #8: Already using individual selectors — good. But useAuthStore was
  // destructured with `{ user }` which subscribes to all fields. Use selector.
  const members = useServerStore((s) => s.members);
  const currentServer = useServerStore((s) => s.currentServer);
  const channels = useServerStore((s) => s.channels);
  const roles = useServerStore((s) => s.roles);
  const isMembersLoading = useServerStore((s) => s.isMembersLoading);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const fetchRolePermissions = useServerStore((s) => s.fetchRolePermissions);
  const assignRoleToMember = useServerStore((s) => s.assignRoleToMember);
  const removeRoleFromMember = useServerStore((s) => s.removeRoleFromMember);

  // FIX #9: Use individual selectors for authStore instead of destructuring
  const user = useAuthStore((s) => s.user);
  const manualStatus = useAuthStore((s) => s.manualStatus);

  // FIX #10: Use individual selectors for UIStore
  const openModal = useUIStore((s) => s.openModal);
  const isMemberSidebarOpen = useUIStore((s) => s.isMemberSidebarOpen);
  const setMemberSidebarOpen = useUIStore((s) => s.setMemberSidebarOpen);

  const openConversation = useDMStore((s) => s.openConversation);
  const blockedUserIds = useFriendStore((s) => s.visibilityBlockedUserIds);
  const userCacheVersion = useUserCacheStore((s) => s._version);

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
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  // Mass ban
  const [massBanMode, setMassBanMode] = useState(false);
  const [massBanSelected, setMassBanSelected] = useState<Set<string>>(new Set());
  const isOverviewView = !!currentServer?.id && location.pathname === `/app/servers/${currentServer.id}/overview`;
  const sidebarOwner = useMemo(
    () => members.find((m) => m.user_id === currentServer?.owner_id) || members.find((m) => m.role === "owner") || null,
    [members, currentServer?.owner_id],
  );
  const sidebarOwnerName =
    sidebarOwner?.nickname || sidebarOwner?.user?.display_name || sidebarOwner?.user?.username || "Unknown";
  const sidebarCreatedAt = currentServer?.created_at ? new Date(currentServer.created_at) : null;

  const toggleMassBanSelection = useCallback((userId: string) => {
    setMassBanSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const exitMassBanMode = useCallback(() => {
    setMassBanMode(false);
    setMassBanSelected(new Set());
  }, []);

  // FIX #11: confirmMassBan needs stable references — use useCallback
  // but it depends on onlineMembers/offlineMembers which change. Use refs for the data.
  const onlineMembersRef = useRef<ServerMember[]>([]);
  const offlineMembersRef = useRef<ServerMember[]>([]);

  // Reset mass ban mode when switching servers
  useEffect(() => {
    exitMassBanMode();
  }, [currentServer?.id, exitMassBanMode]);

  // Subscribe to realtime member updates
  useRealtimeMembers(currentServer?.id || null);

  // Lazy-load members
  useEffect(() => {
    if (!currentServer?.id) return;
    if (!isMemberSidebarOpen && isMobile) return;
    fetchMembers(currentServer.id);
  }, [currentServer?.id, isMemberSidebarOpen, isMobile, fetchMembers]);

  // Fetch total member count
  useEffect(() => {
    if (!currentServer?.id || !user?.id) return;
    if (!isMemberSidebarOpen && isMobile) return;

    const cachedCount = readCachedMemberCount(currentServer.id, user.id);
    if (cachedCount !== null) {
      setTotalMemberCount(cachedCount);
      return;
    }

    let cancelled = false;
    const fetchTimer = setTimeout(() => {
      const seededCount = readCachedMemberCount(currentServer!.id, user!.id);
      if (seededCount !== null) {
        if (!cancelled) setTotalMemberCount(seededCount);
        return;
      }

      void (async () => {
        try {
          const { data, error } = await supabase.rpc("get_server_member_count_secure", {
            _server_id: currentServer!.id,
            _user_id: user!.id,
          });
          if (error) throw error;
          if (cancelled) return;
          const count = typeof data === "number" ? data : Number(data);
          if (Number.isFinite(count)) {
            persistMemberCount(currentServer!.id, user!.id, count);
          }
          setTotalMemberCount(Number.isFinite(count) ? count : null);
        } catch (error) {
          console.error("Failed to fetch total member count:", error);
          if (!cancelled) setTotalMemberCount(null);
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(fetchTimer);
    };
  }, [currentServer?.id, isMemberSidebarOpen, isMobile, user?.id]);

  // Filter out offline/invisible members
  const baseOnlineMembers = useMemo(() => {
    const online = members.filter((m) => !getMemberPresence(m).isOffline);
    if (!memberSearchQuery.trim()) return online;
    const q = memberSearchQuery.toLowerCase();
    return online.filter((m) => {
      const name = m.nickname || m.user?.display_name || m.user?.username || "";
      return name.toLowerCase().includes(q);
    });
  }, [members, memberSearchQuery]);

  const hydratedOfflineMembers = useMemo(() => {
    return offlineMembers.map((member) => {
      const cachedUser = getUserFromCache(member.user_id);
      if (!cachedUser) return member;
      return {
        ...member,
        user: {
          ...member.user,
          ...cachedUser,
        },
      };
    });
  }, [offlineMembers, userCacheVersion]);

  const onlineMemberUserIdSet = useMemo(() => new Set(baseOnlineMembers.map((m) => m.user_id)), [baseOnlineMembers]);

  const promotedOfflineMembers = useMemo(() => {
    return hydratedOfflineMembers.filter((member) => {
      if (onlineMemberUserIdSet.has(member.user_id)) return false;
      return !getMemberPresence(member).isOffline;
    });
  }, [hydratedOfflineMembers, onlineMemberUserIdSet]);

  const onlineMembers = useMemo(() => {
    if (promotedOfflineMembers.length === 0) return baseOnlineMembers;
    return [...baseOnlineMembers, ...promotedOfflineMembers];
  }, [baseOnlineMembers, promotedOfflineMembers]);

  // Keep refs in sync for confirmMassBan
  onlineMembersRef.current = onlineMembers;
  offlineMembersRef.current = hydratedOfflineMembers;

  // Reset paginated offline section on server change
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

  // Keep offline/online mutually exclusive
  useEffect(() => {
    if (offlineMembers.length === 0 || onlineMemberUserIdSet.size === 0) return;
    setOfflineMembers((prev) => {
      const filtered = prev.filter((m) => !onlineMemberUserIdSet.has(m.user_id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [offlineMembers.length, onlineMemberUserIdSet]);

  // FIX #12: loadOfflineMembers — stabilize with useCallback + refs to avoid
  // re-creating the function on every state change. The function reads current
  // cursor/count from refs instead of closing over state.
  const offlineCursorJoinedAtRef = useRef(offlineCursorJoinedAt);
  offlineCursorJoinedAtRef.current = offlineCursorJoinedAt;
  const offlineCursorMemberIdRef = useRef(offlineCursorMemberId);
  offlineCursorMemberIdRef.current = offlineCursorMemberId;
  const offlineLoadedOnceRef = useRef(offlineLoadedOnce);
  offlineLoadedOnceRef.current = offlineLoadedOnce;
  const offlineHasMoreRef = useRef(offlineHasMore);
  offlineHasMoreRef.current = offlineHasMore;

  const loadOfflineMembers = useCallback(
    async (opts?: { reset?: boolean }) => {
      const reset = opts?.reset === true;
      if (!currentServer?.id || !user?.id) return;
      if (offlineLoadingRef.current) return;
      if (!reset && offlineLoadedOnceRef.current && !offlineHasMoreRef.current) return;

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
          _cursor_joined_at: reset ? null : offlineCursorJoinedAtRef.current,
          _cursor_member_id: reset ? null : offlineCursorMemberIdRef.current,
          _include_count: reset || !offlineLoadedOnceRef.current,
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
    },
    [currentServer?.id, user?.id, blockedUserIds, onlineMemberUserIdSet],
  );

  const handleToggleOfflineSection = useCallback(() => {
    setIsOfflineExpanded((prev) => {
      const nextExpanded = !prev;
      if (nextExpanded && !offlineLoadedOnceRef.current) {
        void loadOfflineMembers({ reset: true });
      }
      return nextExpanded;
    });
  }, [loadOfflineMembers]);

  const confirmMassBan = useCallback(() => {
    if (massBanSelected.size === 0) return;
    const allMembers = [...onlineMembersRef.current, ...offlineMembersRef.current];
    const selectedMembers = allMembers.filter((m) => massBanSelected.has(m.user_id));
    openModal("confirmAction", {
      action: "massBan",
      members: selectedMembers,
      title: `Ban ${massBanSelected.size} member${massBanSelected.size > 1 ? "s" : ""}`,
      message: `Are you sure you want to ban ${massBanSelected.size} member${massBanSelected.size > 1 ? "s" : ""} from the server?`,
    });
    exitMassBanMode();
  }, [massBanSelected, openModal, exitMassBanMode]);

  // Permissions
  const { hasPermission: checkPermission, isOwner: currentUserIsOwner } = useMemberPermissions();
  const currentUserMember = useMemo(() => members.find((m) => m.user_id === user?.id), [members, user?.id]);
  const canCreateInvite = currentUserIsOwner || checkPermission("create_instant_invite") || checkPermission("manage_invites");

  const onlineCount = onlineMembers.length;
  const visibleOfflineMembers = useMemo(
    () => hydratedOfflineMembers.filter((member) => getMemberPresence(member).isOffline),
    [hydratedOfflineMembers],
  );
  const visibleCount = onlineMembers.length + visibleOfflineMembers.length;
  const offlineDisplayCount = offlineCount ?? (offlineLoadedOnce ? visibleOfflineMembers.length : null);

  // FIX #13: Pre-compute isInvisibleSelf once instead of calling useAuthStore.getState()
  // inside MemberListItemContent for every single member row render
  const currentUserId = user?.id;
  const isInvisibleSelf = manualStatus === "offline";

  // Group members by role
  const { roleGroups, noRoleMembers } = useMemo(() => {
    const rolePositionById = new Map<string, number>();
    roles.forEach((r) => rolePositionById.set(r.id, r.position));

    const getResolvedRolePosition = (role: CustomServerRole): number => {
      const fromStore = rolePositionById.get(role.id);
      return typeof fromStore === "number" ? fromStore : role.position;
    };

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

  // FIX #14: Stabilize action handlers with useCallback — these were plain functions
  // re-created every render, causing all ContextMenuItems to re-render
  const handleMemberClick = useCallback(
    (member: ServerMember, anchor?: HTMLElement | null) => {
      openUserProfileModal(openModal, member.user_id, anchor ?? null, {
        user: member.user,
        ...LEFT_ALIGNED_USER_PROFILE_POPOVER,
      });
    },
    [openModal],
  );

  const handleMessage = useCallback(
    async (member: ServerMember) => {
      if (!user) return;
      try {
        const conversation = await openConversation(user.id, member.user_id);
        if (conversation) {
          navigate(`/app?conversation=${conversation.id}`, { replace: true });
        }
      } catch (error) {
        console.error("Failed to open conversation:", error);
      }
    },
    [user, openConversation, navigate],
  );

  const handleChangeNickname = useCallback(
    (member: ServerMember) => {
      openModal("changeNickname", { member });
    },
    [openModal],
  );

  const handleKick = useCallback(
    (member: ServerMember) => {
      openModal("confirmAction", {
        action: "kick",
        member,
        title: `Kick ${member.nickname || member.user?.username}`,
        message: `Are you sure you want to kick ${member.nickname || member.user?.username} from the server?`,
      });
    },
    [openModal],
  );

  const handleBan = useCallback(
    (member: ServerMember) => {
      openModal("confirmAction", {
        action: "ban",
        member,
        title: `Ban ${member.nickname || member.user?.username}`,
        message: `Are you sure you want to ban ${member.nickname || member.user?.username} from the server? They will not be able to rejoin.`,
      });
    },
    [openModal],
  );

  const handleTransferOwnership = useCallback(
    (member: ServerMember) => {
      openModal("confirmAction", {
        action: "transferOwnership",
        member,
        title: "Transfer Ownership",
        message: `Are you sure you want to transfer server ownership to ${member.nickname || member.user?.username}? This action cannot be undone.`,
      });
    },
    [openModal],
  );

  const toggleServerRole = useCallback(
    async (member: ServerMember, roleId: string) => {
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
    },
    [user, removeRoleFromMember, assignRoleToMember],
  );

  // FIX #15: Memoize renderMemberItem with useCallback to avoid re-creating
  // the function (and all its inline closures) on every render
  const renderMemberItem = useCallback(
    (member: ServerMember) => {
      const displayName =
        pickFirstNonBlank(member.nickname, member.user?.display_name, member.user?.username) ?? "Unknown";
      const presence = getMemberPresence(member);
      const memberIsOffline = presence.isOffline;
      const isSelf = member.user_id === currentUserId;
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
      const memberIsInvisibleSelf = isSelf && isInvisibleSelf;

      // Permission checks
      const canMod = canModerateByRoles(currentUserIsOwner, currentUserMember?.roles, isServerOwner, member.roles);
      const canKick = checkPermission("kick_members") && canMod && !isSelf;
      const canBan = checkPermission("ban_members") && canMod && !isSelf;
      const canChangeNickname = checkPermission("manage_nicknames") && (canMod || isSelf);
      const canTransfer = currentUserIsOwner && !isSelf && !isServerOwner;
      const canManageRoles =
        checkPermission("manage_roles") && (canMod || (isSelf && isServerOwner) || currentUserIsOwner);

      const hasAdminActions = canKick || canBan || canChangeNickname || canTransfer || canManageRoles;

      // Mass ban mode
      if (massBanMode) {
        const isSelected = massBanSelected.has(member.user_id);
        const canSelectForBan = canBan && !isSelf && !isServerOwner;

        return (
          <div
            className={cn("relative cursor-pointer", !canSelectForBan && "opacity-40 pointer-events-none")}
            onClick={() => canSelectForBan && toggleMassBanSelection(member.user_id)}
          >
            <MemberListItemContent
              member={member}
              memberIsOffline={memberIsOffline}
              presence={presence}
              displayName={displayName}
              isServerOwner={isServerOwner}
              priorityCustomRoleColor={priorityCustomRoleColor}
              isGradientName={isGradientName}
              isInvisibleSelf={memberIsInvisibleSelf}
              onClick={() => {}}
            />
            {canSelectForBan && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    isSelected ? "bg-destructive border-destructive" : "border-muted-foreground/40 bg-transparent",
                  )}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
              </div>
            )}
          </div>
        );
      }

      const content = (
        <MemberListItemContent
          member={member}
          memberIsOffline={memberIsOffline}
          presence={presence}
          displayName={displayName}
          isServerOwner={isServerOwner}
          priorityCustomRoleColor={priorityCustomRoleColor}
          isGradientName={isGradientName}
          isInvisibleSelf={memberIsInvisibleSelf}
          onClick={(event) => handleMemberClick(member, event.currentTarget)}
        />
      );

      if (!hasAdminActions && isSelf) {
        return content;
      }

      return (
        <ContextMenu>
          <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
          <ContextMenuContent className="w-52 z-[60]">
            <ContextMenuItem onClick={() => handleMessage(member)}>
              <MessageSquare className="w-4 h-4" />
              Message
            </ContextMenuItem>

            {canChangeNickname && (
              <ContextMenuItem onClick={() => handleChangeNickname(member)}>
                <Edit3 className="w-4 h-4" />
                Change Nickname
              </ContextMenuItem>
            )}

            {(canKick || canBan) && (
              <>
                <ContextMenuSeparator />
                {canKick && (
                  <ContextMenuItem onClick={() => handleKick(member)} className="text-orange-400 focus:text-orange-400">
                    <UserX className="w-4 h-4" />
                    Kick
                  </ContextMenuItem>
                )}
                {canBan && (
                  <ContextMenuItem
                    onClick={() => handleBan(member)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Ban className="w-4 h-4" />
                    Ban
                  </ContextMenuItem>
                )}
                {canBan && (
                  <ContextMenuItem
                    onClick={() => {
                      setMassBanMode(true);
                      setMassBanSelected(new Set([member.user_id]));
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <ListChecks className="w-4 h-4" />
                    Select for Mass Ban
                  </ContextMenuItem>
                )}
              </>
            )}

            {canManageRoles && (
              <>
                <ContextMenuSeparator />
                <ContextMenuSub>
                  <ContextMenuSubTrigger>
                    <Shield className="w-4 h-4" />
                    Roles
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-44" sideOffset={4}>
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
                            <ContextMenuItem key={role.id} onClick={() => toggleServerRole(member, role.id)}>
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

            {canTransfer && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onClick={() => handleTransferOwnership(member)}
                  className="text-amber-400 focus:text-amber-400"
                >
                  <Crown className="w-4 h-4" />
                  Transfer Ownership
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
      );
    },
    [
      currentUserId,
      currentServer?.owner_id,
      roles,
      isInvisibleSelf,
      currentUserIsOwner,
      currentUserMember?.roles,
      checkPermission,
      massBanMode,
      massBanSelected,
      toggleMassBanSelection,
      handleMemberClick,
      handleMessage,
      handleChangeNickname,
      handleKick,
      handleBan,
      handleTransferOwnership,
      toggleServerRole,
    ],
  );

  // FIX #16: Stabilize the "load more" click handler
  const handleLoadMore = useCallback(() => {
    void loadOfflineMembers();
  }, [loadOfflineMembers]);

  // FIX #17: Stabilize the search input onChange handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMemberSearchQuery(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setMemberSearchQuery("");
  }, []);

  const handleOpenInvite = useCallback(() => {
    openModal("invite");
  }, [openModal]);

  const handleCloseSidebar = useCallback(() => {
    setMemberSidebarOpen(false);
  }, [setMemberSidebarOpen]);

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
      visibleOfflineMembers.forEach((member) => {
        rows.push({ kind: "member", key: `member-offline-${member.id}`, member });
      });

      if (offlineIsLoading) {
        rows.push({ kind: "offline-loading", key: "offline-loading" });
      }

      if (!offlineIsLoading && offlineLoadedOnce && visibleOfflineMembers.length === 0) {
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
    visibleOfflineMembers,
    offlineIsLoading,
    offlineLoadedOnce,
    offlineHasMore,
    totalMemberCount,
    visibleCount,
  ]);

  // FIX #18: renderMemberListRow was a plain function recreated every render.
  // Wrap in useCallback so ViewportList's render function is stable.
  const renderMemberListRow = useCallback(
    (row: MemberListRow) => {
      switch (row.kind) {
        case "section":
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
        case "member":
          return renderMemberItem(row.member);
        case "offline-toggle":
          return (
            <button
              type="button"
              className="w-full flex items-center gap-1 px-3 pb-1.5 pt-3 hover:bg-secondary/30 transition-colors mt-1 text-left"
              onClick={handleToggleOfflineSection}
            >
              <ChevronDown
                className={cn(
                  "hidden w-3.5 h-3.5 text-muted-foreground transition-transform",
                  isOfflineExpanded && "rotate-180",
                )}
              />
              {offlineDisplayCount != null && (
                <span className="text-[12px] font-bold text-muted-foreground">{offlineDisplayCount}</span>
              )}
              <span className="text-[12px] font-bold text-muted-foreground">Offline</span>
            </button>
          );
        case "offline-loading":
          return <OfflineLoadingRow />;
        case "offline-empty":
          return <OfflineEmptyRow />;
        case "offline-load-more":
          return (
            <div className="px-3 pt-1">
              <button
                type="button"
                className="text-[11px] text-primary hover:text-primary/80 transition-colors"
                onClick={handleLoadMore}
              >
                Load more
              </button>
            </div>
          );
        case "empty-state":
          return <EmptyState />;
        default:
          return null;
      }
    },
    [
      currentServer?.id,
      renderMemberItem,
      handleToggleOfflineSection,
      isOfflineExpanded,
      offlineDisplayCount,
      handleLoadMore,
    ],
  );

  // FIX #19: Stabilize the ViewportList render callback
  const renderRow = useCallback(
    (row: MemberListRow) => <div key={row.key}>{renderMemberListRow(row)}</div>,
    [renderMemberListRow],
  );

  // Show skeleton while loading
  if (isMembersLoading && members.length === 0) {
    return <MembersSidebarSkeleton />;
  }

  const sidebarContent = (
    <div
      className={cn(
        "h-full flex flex-col w-full overflow-hidden relative",
        "bg-layout-chat border-l border-border/60",
      )}
    >
      {/* Header */}
      <div className={cn("px-3 py-2.5 border-b border-border/10", !isMobile && "hidden", isMobile && "px-3 py-3")}>
        {massBanMode ? (
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-destructive">Select members to ban</p>
            <button
              type="button"
              onClick={exitMassBanMode}
              className="p-1 rounded-md hover:bg-secondary/60 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        ) : isOverviewView ? (
          <div className="rounded-xl border border-border/30 bg-muted/20 px-3 py-2.5">
            <div className="text-sm font-semibold text-muted-foreground">About</div>
            <div className="text-sm font-normal text-foreground/95 truncate">
              {currentServer?.about?.trim() || `Official ${currentServer?.name || "Server"}`}
            </div>

            <div className="mt-3 space-y-2 text-sm text-foreground/85">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span>Community</span>
              </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{totalMemberCount ?? members.length} members</span>
            </div>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span>{channels.length} channels</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>{sidebarCreatedAt ? `Since ${sidebarCreatedAt.toLocaleDateString()}` : "Since unknown"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span>{sidebarOwnerName}</span>
            </div>
          </div>
          </div>

        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
              <input
                type="text"
                placeholder="Search members..."
                value={memberSearchQuery}
                onChange={handleSearchChange}
                className="w-full h-11 pl-10 pr-10 rounded-xl bg-muted/30 border border-border/30 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/30 focus:bg-muted/40 transition-all"
              />
              {memberSearchQuery && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  onClick={handleClearSearch}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {isMobile && (
              <button
                type="button"
                className="w-11 h-11 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
                onClick={handleCloseSidebar}
                aria-label="Close members"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {!isMobile && !massBanMode && isOverviewView && (
        <div className="mx-2 mt-2 shrink-0 rounded-xl border border-border/30 bg-muted/20 px-3 py-2.5">
          <div className="text-sm font-semibold text-muted-foreground">About</div>
          <div className="mt-2 text-sm font-normal text-foreground/95">
            {currentServer?.about?.trim() || `Official ${currentServer?.name || "Server"}`}
          </div>

          <div className="mt-3 space-y-2 text-sm text-foreground/85">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span>Community</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>{totalMemberCount ?? members.length} members</span>
            </div>
            <div className="flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              <span>{channels.length} channels</span>
            </div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>
                {sidebarCreatedAt
                  ? `Since ${sidebarCreatedAt.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`
                  : "Since unknown"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-yellow-500" />
              <span>{sidebarOwnerName}</span>
            </div>
          </div>
        </div>
      )}

      {!isMobile && !massBanMode && !isOverviewView && (
        <div className="mx-2 mt-2 shrink-0">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search members"
              value={memberSearchQuery}
              onChange={handleSearchChange}
              className="h-9 w-full rounded-md border border-border/50 bg-layout-members pl-9 pr-9 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary/80"
            />
            {memberSearchQuery && (
              <button
                type="button"
                className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
                onClick={handleClearSearch}
                aria-label="Clear member search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Members List */}
      <div
        ref={listViewportRef}
        className={cn(
          "flex-1 overflow-y-auto py-2",
          !isMobile && "mx-2 mb-2 mt-2 rounded bg-layout-members px-0.5 pb-2",
        )}
      >
        <ViewportList viewportRef={listViewportRef} items={memberListRows} itemSize={44} overscan={14}>
          {renderRow}
        </ViewportList>
        {!isMobile && canCreateInvite && (
          <button
            type="button"
            onClick={handleOpenInvite}
            className="mt-1 flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-muted-foreground transition-colors hover:bg-secondary/45 hover:text-foreground"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Plus className="h-5 w-5" />
            </span>
            <span className="text-[13px] font-medium">Invite</span>
          </button>
        )}
      </div>

      {/* Mass ban floating action bar */}
      {massBanMode && (
        <div className="absolute bottom-4 left-3 right-3 bg-destructive/95 backdrop-blur-sm rounded-xl p-3 flex items-center justify-between shadow-lg border border-destructive/50">
          <span className="text-sm font-medium text-white">{massBanSelected.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exitMassBanMode}
              className="px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white rounded-lg hover:bg-foreground/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmMassBan}
              disabled={massBanSelected.size === 0}
              className="px-3 py-1.5 text-xs font-medium bg-white text-destructive rounded-lg hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Ban {massBanSelected.size > 0 ? massBanSelected.size : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer direction="right" open={isMemberSidebarOpen} onOpenChange={setMemberSidebarOpen} modal={false}>
        {isMemberSidebarOpen && <div className="fixed inset-0 z-50 bg-black/80" onClick={handleCloseSidebar} />}
        <DrawerContent className="p-1.5 w-[100vw] max-w-[100vw] bg-background">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Members</DrawerTitle>
          </DrawerHeader>
          <div className="h-full overflow-hidden">{sidebarContent}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return sidebarContent;
};
