import { useCallback, useEffect, useMemo, useState, type CSSProperties, type Dispatch, type SetStateAction } from "react";
import { FileClock, Loader2, RefreshCw, Search, Shield, SlidersHorizontal } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { evaluatePermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { toast } from "sonner";
import type { CustomServerRole, Permission } from "@/types";

type AuditLogEntry = {
  id: string;
  server_id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_username: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  actor_role: "owner" | "admin" | "moderator" | "member" | null;
  actor_role_color: string | null;
};

type DateFilter = "last_10m" | "last_1h" | "last_6h" | "last_24h" | "last_7d" | "last_31d" | "older_31d";

const AUDIT_LOG_PAGE_SIZE = 30;

const STAFF_AUDIT_PERMISSIONS: Permission[] = [
  "view_audit_log",
  "manage_server",
  "manage_roles",
  "manage_channels",
  "manage_emojis",
  "manage_webhooks",
  "manage_invites",
  "kick_members",
  "ban_members",
  "mute_members",
  "deafen_members",
  "move_members",
  "manage_nicknames",
  "manage_messages",
  "pin_messages",
  "manage_threads",
  "transfer_ownership",
  "edit_all_tasks",
  "assign_tasks",
  "delete_tasks",
  "edit_all_events",
  "delete_events",
];

const SYSTEM_ROLE_COLORS = {
  owner: "#F46B2B",
  admin: "#C77DFF",
  moderator: "#67D17B",
  member: "#9AA0AA",
};

const DATE_FILTER_OPTIONS: Array<{ id: DateFilter; label: string; minMinutes?: number; maxMinutes?: number }> = [
  { id: "last_10m", label: "Last 10 minutes", maxMinutes: 10 },
  { id: "last_1h", label: "10 minutes to 1 hour", minMinutes: 10, maxMinutes: 60 },
  { id: "last_6h", label: "1 to 6 hours", minMinutes: 60, maxMinutes: 60 * 6 },
  { id: "last_24h", label: "6 to 24 hours", minMinutes: 60 * 6, maxMinutes: 60 * 24 },
  { id: "last_7d", label: "1 to 7 days", minMinutes: 60 * 24, maxMinutes: 60 * 24 * 7 },
  { id: "last_31d", label: "7 to 31 days", minMinutes: 60 * 24 * 7, maxMinutes: 60 * 24 * 31 },
  { id: "older_31d", label: "More than 31 days", minMinutes: 60 * 24 * 31 },
];

const getAuditMetadata = (entry: AuditLogEntry) => {
  return entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {};
};

const formatAuditValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "None";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return String(value);
};

const formatAuditField = (field: string) => {
  return field
    .replace(/^is_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const formatActionLabel = (action: string) => formatAuditField(action);

const getActorName = (entry: AuditLogEntry) => entry.actor_display_name || entry.actor_username || "Unknown user";

const minutesSince = (iso: string | null | undefined) => {
  if (!iso) return null;
  const elapsed = (Date.now() - new Date(iso).getTime()) / 60000;
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
};

const matchesDateRange = (minutes: number | null, option: { minMinutes?: number; maxMinutes?: number }) => {
  if (minutes == null) return false;
  if (option.minMinutes != null && minutes < option.minMinutes) return false;
  if (option.maxMinutes != null && minutes > option.maxMinutes) return false;
  return true;
};

const AuditFilterCheckbox = ({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) => (
  <label className="flex h-6 items-center gap-2 text-[12px] font-normal text-foreground">
    <Checkbox
      checked={checked}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      className="h-3.5 w-3.5 rounded-none border-border bg-transparent data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
    />
    <span className="truncate">{label}</span>
  </label>
);

export const ServerAuditLogPage = () => {
  const currentServer = useServerStore((s) => s.currentServer);
  const members = useServerStore((s) => s.members);
  const roles = useServerStore((s) => s.roles);
  const rolePermissions = useServerStore((s) => s.rolePermissions);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const fetchRoles = useServerStore((s) => s.fetchRoles);
  const fetchRolePermissions = useServerStore((s) => s.fetchRolePermissions);
  const userId = useAuthStore((s) => s.user?.id);
  const { hasPermission } = useMemberPermissions();
  const canViewAuditLog = hasPermission("view_audit_log");

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actorFilters, setActorFilters] = useState<Set<string>>(new Set());
  const [actionFilters, setActionFilters] = useState<Set<string>>(new Set());
  const [dateFilters, setDateFilters] = useState<Set<DateFilter>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCursors, setPageCursors] = useState<Array<string | null>>([null]);
  const [hasNextPage, setHasNextPage] = useState(false);

  const getAuditRoleName = useCallback(
    (metadata: Record<string, unknown>) => {
      const roleName = metadata.role_name || metadata.role_display_name || metadata.name;
      if (typeof roleName === "string" && roleName.trim()) return roleName;

      const roleId = typeof metadata.role_id === "string" ? metadata.role_id : null;
      return roleId ? roles.find((role) => role.id === roleId)?.name || roleId : "Unknown role";
    },
    [roles],
  );

  const getAuditPermissionName = (metadata: Record<string, unknown>) => {
    const permission = typeof metadata.permission === "string" ? metadata.permission : "";
    return permission ? formatAuditField(permission) : "Unknown permission";
  };

  const getAuditDetailLines = useCallback(
    (entry: AuditLogEntry) => {
      const metadata = getAuditMetadata(entry);

      if (entry.action.startsWith("role_permission_")) {
        const allowed = metadata.allowed === null || metadata.allowed === undefined ? "Inherited" : formatAuditValue(metadata.allowed);
        return [`Role: ${getAuditRoleName(metadata)}`, `Permission: ${getAuditPermissionName(metadata)}`, `State: ${allowed}`];
      }

      if (entry.action === "role_updated" || entry.action === "role_reordered") {
        const before = metadata.before && typeof metadata.before === "object" ? (metadata.before as Record<string, unknown>) : null;
        const after = metadata.after && typeof metadata.after === "object" ? (metadata.after as Record<string, unknown>) : null;
        if (!before || !after) return [];

        const fields = ["name", "color", "icon", "is_self_assignable", "position"];
        return fields
          .filter((field) => before[field] !== after[field])
          .map((field) => `${formatAuditField(field)}: ${formatAuditValue(before[field])} -> ${formatAuditValue(after[field])}`);
      }

      if (entry.action === "server_updated") {
        const changedFields = Array.isArray(metadata.changed_fields) ? metadata.changed_fields : [];
        return changedFields.map((field) => `Changed: ${formatAuditField(String(field))}`);
      }

      return [];
    },
    [getAuditRoleName],
  );

  const loadAuditLog = useCallback(async () => {
    if (!currentServer?.id || !userId || !canViewAuditLog) return;

    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_server_audit_log", {
        _server_id: currentServer.id,
        _user_id: userId,
        _limit: AUDIT_LOG_PAGE_SIZE,
        _before: pageCursors[pageIndex] ?? null,
      });

      if (error) throw error;
      const nextEntries = Array.isArray(data) ? (data as AuditLogEntry[]) : [];
      setEntries(nextEntries);
      setHasNextPage(nextEntries.length === AUDIT_LOG_PAGE_SIZE);
      setPageCursors((prev) => {
        const next = prev.slice(0, pageIndex + 1);
        if (nextEntries.length === AUDIT_LOG_PAGE_SIZE) {
          next[pageIndex + 1] = nextEntries[nextEntries.length - 1]?.created_at ?? null;
        }
        if (next.length === prev.length && next.every((cursor, index) => cursor === prev[index])) {
          return prev;
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to load audit log:", error);
      setEntries([]);
      setHasNextPage(false);
      toast.error("Failed to load audit log");
    } finally {
      setIsLoading(false);
    }
  }, [canViewAuditLog, currentServer?.id, pageCursors, pageIndex, userId]);

  useEffect(() => {
    if (!currentServer?.id) return;
    void fetchMembers(currentServer.id);
    void fetchRoles(currentServer.id);
    void fetchRolePermissions(currentServer.id);
  }, [currentServer?.id, fetchMembers, fetchRolePermissions, fetchRoles]);

  useEffect(() => {
    void loadAuditLog();
  }, [loadAuditLog]);

  useEffect(() => {
    setEntries([]);
    setPageIndex(0);
    setPageCursors([null]);
    setHasNextPage(false);
    setActorFilters(new Set());
    setActionFilters(new Set());
    setDateFilters(new Set());
  }, [currentServer?.id]);

  const actorFilterOptions = useMemo(() => {
    if (!currentServer) return [];

    return members
      .filter((member) => {
        if (member.is_banned) return false;
        if (member.user?.is_bot) return false;

        const isOwner = currentServer.owner_id === member.user_id;
        return STAFF_AUDIT_PERMISSIONS.some((permission) =>
          evaluatePermission(permission, isOwner, member.roles, rolePermissions, undefined, undefined, member.user_id, roles, member.role),
        );
      })
      .map((member) => ({
        id: member.user_id,
        label: member.nickname || member.user?.display_name || member.user?.username || "Unknown user",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [currentServer, members, rolePermissions, roles]);

  const actionFilterOptions = useMemo(() => {
    const actions = new Set(entries.map((entry) => entry.action));
    return [...actions]
      .map((action) => ({ id: action, label: formatActionLabel(action) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [entries]);

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

  const activeFilterCount = actorFilters.size + actionFilters.size + dateFilters.size;

  const handlePreviousPage = () => {
    setPageIndex((prev) => Math.max(0, prev - 1));
  };

  const handleNextPage = () => {
    if (!hasNextPage || !pageCursors[pageIndex + 1]) return;
    setPageIndex((prev) => prev + 1);
  };

  const actorColorByUserId = useMemo(() => {
    const roleById = new Map(roles.map((role) => [role.id, role]));
    const colorByUserId = new Map<string, string>();

    members.forEach((member) => {
      const resolvedRoles = (member.roles || [])
        .map((memberRole) => roleById.get(memberRole.id) ?? memberRole)
        .filter(Boolean) as CustomServerRole[];

      const topRole = resolvedRoles.reduce<CustomServerRole | null>((bestRole, role) => {
        if (!bestRole) return role;
        const rolePosition = typeof role.position === "number" ? role.position : Number.POSITIVE_INFINITY;
        const bestPosition = typeof bestRole.position === "number" ? bestRole.position : Number.POSITIVE_INFINITY;
        return rolePosition < bestPosition ? role : bestRole;
      }, null);

      if (topRole?.color) {
        colorByUserId.set(member.user_id, topRole.color);
      }
    });

    return colorByUserId;
  }, [members, roles]);

  const getTextColorStyle = (color: string | null | undefined): CSSProperties | undefined => {
    if (!color) return undefined;
    if (color.startsWith("linear-gradient")) {
      return {
        background: color,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      };
    }
    return { color };
  };

  const getActorColor = (entry: AuditLogEntry) => {
    return (entry.actor_id ? actorColorByUserId.get(entry.actor_id) : null) || entry.actor_role_color || (entry.actor_role ? SYSTEM_ROLE_COLORS[entry.actor_role] : null);
  };

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();

    return entries
      .filter((entry) => {
        if (actorFilters.size === 0) return true;
        return actorFilters.has(entry.actor_id || "unknown");
      })
      .filter((entry) => {
        if (actionFilters.size === 0) return true;
        return actionFilters.has(entry.action);
      })
      .filter((entry) => {
        if (dateFilters.size === 0) return true;
        const elapsedMinutes = minutesSince(entry.created_at);
        return DATE_FILTER_OPTIONS.some((option) => dateFilters.has(option.id) && matchesDateRange(elapsedMinutes, option));
      })
      .filter((entry) => {
        if (!query) return true;
        const detailText = getAuditDetailLines(entry).join(" ");
        return [getActorName(entry), entry.action, entry.summary, entry.target_type || "", detailText]
          .join(" ")
          .toLowerCase()
          .includes(query);
      });
  }, [actionFilters, actorFilters, dateFilters, entries, getAuditDetailLines, search]);

  if (!currentServer) {
    return null;
  }

  if (!canViewAuditLog) {
    return (
      <div className="h-full overflow-y-auto bg-layout-members text-foreground">
        <div className="mx-auto flex min-h-full w-full max-w-6xl items-center justify-center px-4 py-10">
          <div className="flex flex-col items-center justify-center text-center">
            <Shield className="mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">You do not have permission to view the audit log.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-layout-members text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-3 flex min-h-11 items-center gap-3">
          <div className="relative w-[240px] shrink-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search audit log"
              className="h-8 w-full rounded-full border border-white/8 bg-card pl-9 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-white/80"
            />
          </div>

          <div className="ml-auto flex min-h-8 items-center gap-2 text-[12px] text-muted-foreground">
            <span>
              Page {pageIndex + 1} - {visibleEntries.length} {visibleEntries.length === 1 ? "entry" : "entries"}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-white/8 hover:text-white",
                    activeFilterCount > 0 && "text-white",
                  )}
                  aria-label="Filter audit log"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={8}
                className="w-[660px] rounded-[4px] border border-white/10 bg-card p-3 text-foreground shadow-2xl"
              >
                <div className="grid grid-cols-3 gap-8">
                  <div>
                    <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Users</div>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                      {actorFilterOptions.length > 0 ? (
                        actorFilterOptions.map((actor) => (
                          <AuditFilterCheckbox
                            key={actor.id}
                            checked={actorFilters.has(actor.id)}
                            onCheckedChange={(checked) => toggleSetValue(setActorFilters, actor.id, checked)}
                            label={actor.label}
                          />
                        ))
                      ) : (
                        <p className="text-[12px] text-muted-foreground">No users yet.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Actions</div>
                    <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                      {actionFilterOptions.length > 0 ? (
                        actionFilterOptions.map((action) => (
                          <AuditFilterCheckbox
                            key={action.id}
                            checked={actionFilters.has(action.id)}
                            onCheckedChange={(checked) => toggleSetValue(setActionFilters, action.id, checked)}
                            label={action.label}
                          />
                        ))
                      ) : (
                        <p className="text-[12px] text-muted-foreground">No actions yet.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-[12px] font-semibold text-muted-foreground">Date</div>
                    <div className="space-y-1">
                      {DATE_FILTER_OPTIONS.map((option) => (
                        <AuditFilterCheckbox
                          key={option.id}
                          checked={dateFilters.has(option.id)}
                          onCheckedChange={(checked) => toggleSetValue(setDateFilters, option.id, checked)}
                          label={option.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              onClick={() => void loadAuditLog()}
              disabled={isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Refresh audit log"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="min-w-full overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid h-8 shrink-0 grid-cols-[42px_minmax(160px,0.9fr)_minmax(128px,0.7fr)_minmax(260px,1.5fr)_minmax(170px,0.9fr)] items-center border-b border-black/15 px-4 text-[12px] font-medium text-muted-foreground">
              <div />
              <div>Actor</div>
              <div>Action</div>
              <div>Summary</div>
              <div>Time</div>
            </div>

            {isLoading && entries.length === 0 ? (
              <div className="px-4 py-6 text-sm font-medium text-muted-foreground">Loading audit log...</div>
            ) : visibleEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <FileClock className="mb-3 h-10 w-10 text-muted-foreground" />
                <p className="text-sm font-medium text-muted-foreground">
                  {entries.length === 0 ? "No audit log entries yet." : "No audit log entries match your search."}
                </p>
              </div>
            ) : (
              visibleEntries.map((entry) => {
                const actorName = getActorName(entry);
                const actorColor = getActorColor(entry);
                const actorStyle = getTextColorStyle(actorColor);
                const detailLines = getAuditDetailLines(entry);

                return (
                  <div
                    key={entry.id}
                    className="grid min-h-[54px] grid-cols-[42px_minmax(160px,0.9fr)_minmax(128px,0.7fr)_minmax(260px,1.5fr)_minmax(170px,0.9fr)] items-center border-b border-black/10 px-4 text-[13px] font-medium hover:bg-white/[0.025]"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={entry.actor_avatar_url || undefined} />
                      <AvatarFallback className="text-[11px] font-semibold text-white">
                        {actorName[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="truncate text-foreground" style={actorStyle}>
                        {actorName}
                      </div>
                    </div>
                    <div className="truncate capitalize text-foreground">{formatActionLabel(entry.action)}</div>
                    <div className="min-w-0 py-2">
                      <div className="truncate text-foreground">{entry.summary}</div>
                      {detailLines.length > 0 && (
                        <div className="mt-1 flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {detailLines.map((line) => (
                            <span key={line} className="max-w-[240px] truncate">
                              {line}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={cn("truncate text-muted-foreground", isLoading && "opacity-70")}>
                      {new Date(entry.created_at).toLocaleString()}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {(entries.length > 0 || pageIndex > 0) && (
          <div className="mt-3 flex h-9 items-center justify-end gap-2 text-[12px] text-muted-foreground">
            <button
              type="button"
              onClick={handlePreviousPage}
              disabled={pageIndex === 0 || isLoading}
              className="h-8 rounded-[4px] border border-white/10 px-3 font-medium text-foreground transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="min-w-16 text-center">Page {pageIndex + 1}</span>
            <button
              type="button"
              onClick={handleNextPage}
              disabled={!hasNextPage || !pageCursors[pageIndex + 1] || isLoading}
              className="h-8 rounded-[4px] border border-white/10 px-3 font-medium text-foreground transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
