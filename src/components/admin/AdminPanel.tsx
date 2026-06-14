import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Clock,
  Gavel,
  MessageSquareWarning,
  RefreshCw,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/adminAccess";
import { openUserProfileModal, SIDE_ALIGNED_USER_PROFILE_POPOVER } from "@/lib/userProfilePopover";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";

type ReportUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url?: string | null;
};

type ActivePunishment = {
  id: string;
  action_type: string;
  reason: string;
  expires_at: string | null;
  created_at: string;
};

type ReportStatus = "open" | "reviewing" | "actioned" | "dismissed";

type ReportServer = {
  id: string;
  name: string;
  icon_url?: string | null;
  owner_id?: string | null;
};

type AdminReport = {
  id: string;
  report_type: "message" | "profile" | "server";
  message_type?: "channel" | "dm";
  message_id?: string;
  entity_type?: "profile" | "server";
  entity_id?: string;
  reason: string;
  details: string | null;
  message_content?: string;
  context: Record<string, unknown>;
  snapshot?: Record<string, unknown>;
  status: ReportStatus;
  resolution_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  reported_user: ReportUser | null;
  reported_server?: ReportServer | null;
  reporter: ReportUser | null;
  reviewer: Pick<ReportUser, "id" | "username" | "display_name"> | null;
  active_punishments: ActivePunishment[];
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "actioned", label: "Actioned" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
] as const;

const ACTION_OPTIONS = [
  { value: "dismiss", label: "Dismiss report", description: "Close the report with no user action." },
  { value: "warn", label: "Warn user", description: "Show a notice without limiting account access." },
  { value: "delete_message", label: "Delete message", description: "Remove only the reported message." },
  { value: "restrict_24h", label: "Restrict messages 24h", description: "Block channel and DM sends for 24 hours." },
  { value: "restrict_7d", label: "Restrict messages 7d", description: "Block channel and DM sends for 7 days." },
  { value: "suspend_24h", label: "Suspend 24h", description: "Block login after acknowledgement for 24 hours." },
  { value: "suspend_7d", label: "Suspend 7d", description: "Block login after acknowledgement for 7 days." },
  { value: "ban", label: "Permanent ban", description: "Block login indefinitely after acknowledgement." },
] as const;

const PUNISHMENT_REASONS = [
  { value: "harassment", label: "Harassment or hateful conduct" },
  { value: "threats", label: "Threats or violent content" },
  { value: "spam", label: "Spam or platform abuse" },
  { value: "nsfw", label: "Inappropriate or NSFW content" },
  { value: "privacy", label: "Sharing private information" },
  { value: "impersonation", label: "Impersonation or deception" },
  { value: "other", label: "Other rule violation" },
  { value: "custom", label: "Custom reason" },
] as const;

const WARNING_EXPIRY_OPTIONS = [
  { value: "none", label: "No expiry" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom date" },
] as const;

const statusStyles: Record<ReportStatus, string> = {
  open: "border-amber-400/60 bg-amber-500/20 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.12)]",
  reviewing: "border-sky-400/60 bg-sky-500/20 text-sky-200 shadow-[0_0_20px_rgba(14,165,233,0.12)]",
  actioned: "border-emerald-400/60 bg-emerald-500/20 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.12)]",
  dismissed: "border-zinc-400/40 bg-zinc-500/20 text-zinc-200",
};

const statusAccentStyles: Record<ReportStatus, string> = {
  open: "from-amber-400 via-amber-500/40 to-transparent",
  reviewing: "from-sky-400 via-sky-500/40 to-transparent",
  actioned: "from-emerald-400 via-emerald-500/40 to-transparent",
  dismissed: "from-zinc-400 via-zinc-500/30 to-transparent",
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "Never";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const displayName = (user: ReportUser | Pick<ReportUser, "username" | "display_name"> | null) => {
  if (!user) return "Unknown";
  return user.display_name || user.username;
};

const shortId = (value: string) => `${value.slice(0, 8)}...${value.slice(-6)}`;

const isMessageReport = (report: AdminReport) => report.report_type === "message";

const getReportKindLabel = (report: AdminReport) => {
  if (report.report_type === "profile") return "Profile";
  if (report.report_type === "server") return "Server";
  return report.message_type === "dm" ? "Direct message" : "Channel message";
};

const getReportTitle = (report: AdminReport) => {
  if (report.report_type === "server") return report.reported_server?.name || String(report.snapshot?.name || "Unknown server");
  return displayName(report.reported_user);
};

const getReportPreview = (report: AdminReport) => {
  if (report.report_type === "profile") {
    return String(report.snapshot?.bio || report.snapshot?.tagline || report.reported_user?.username || "Profile report");
  }
  if (report.report_type === "server") {
    return String(report.snapshot?.about || report.reported_server?.name || "Server report");
  }
  return report.message_content || "(empty message)";
};

export const AdminPanel = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const openModal = useUIStore((s) => s.openModal);
  const canView = isPlatformAdmin(user);
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("open");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionByReport, setActionByReport] = useState<Record<string, string>>({});
  const [reasonByReport, setReasonByReport] = useState<Record<string, string>>({});
  const [customReasonByReport, setCustomReasonByReport] = useState<Record<string, string>>({});
  const [warningExpiryByReport, setWarningExpiryByReport] = useState<Record<string, string>>({});
  const [customWarningExpiryByReport, setCustomWarningExpiryByReport] = useState<Record<string, string>>({});
  const [noteByReport, setNoteByReport] = useState<Record<string, string>>({});
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    if (!user?.id || !canView) return;
    setIsLoading(true);

    try {
      const [messageResponse, entityResponse] = await Promise.all([
        (supabase.rpc as any)("get_admin_message_reports", {
          _admin_user_id: user.id,
          _status: status,
        }),
        (supabase.rpc as any)("get_admin_entity_reports", {
          _admin_user_id: user.id,
          _status: status,
        }),
      ]);

      if (messageResponse.error) throw messageResponse.error;
      if (entityResponse.error) throw entityResponse.error;

      const messageReports: AdminReport[] = (Array.isArray(messageResponse.data) ? messageResponse.data : []).map((report: any) => ({
        ...report,
        report_type: "message",
        context: report.context || {},
        active_punishments: Array.isArray(report.active_punishments) ? report.active_punishments : [],
      }));
      const entityReports: AdminReport[] = (Array.isArray(entityResponse.data) ? entityResponse.data : []).map((report: any) => ({
        ...report,
        report_type: report.entity_type,
        context: {},
        active_punishments: Array.isArray(report.active_punishments) ? report.active_punishments : [],
      }));
      const nextReports = [...messageReports, ...entityReports].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      setReports(nextReports);
      setSelectedReportId((current) => {
        if (current && nextReports.some((report) => report.id === current)) return current;
        return nextReports[0]?.id ?? null;
      });
    } catch (error) {
      console.error("Failed to load reports:", error);
      toast.error("Failed to load reports");
    } finally {
      setIsLoading(false);
    }
  }, [canView, status, user?.id]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const counts = useMemo(() => {
    return reports.reduce(
      (acc, report) => {
        acc[report.status] = (acc[report.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [reports]);

  const filteredReports = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return reports;

    return reports.filter((report) => {
      const target = [
        getReportKindLabel(report),
        getReportTitle(report),
        getReportPreview(report),
        report.reason,
        report.message_content,
        report.reported_user?.username,
        report.reported_user?.display_name,
        report.reported_server?.name,
        report.reporter?.username,
        report.reporter?.display_name,
        report.message_id,
        report.entity_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return target.includes(normalizedQuery);
    });
  }, [query, reports]);

  useEffect(() => {
    if (selectedReportId && filteredReports.some((report) => report.id === selectedReportId)) return;
    setSelectedReportId(filteredReports[0]?.id ?? null);
  }, [filteredReports, selectedReportId]);

  const selectedReport = filteredReports.find((report) => report.id === selectedReportId) ?? null;
  const selectedAction = selectedReport ? actionByReport[selectedReport.id] || "dismiss" : "dismiss";
  const actionMeta = ACTION_OPTIONS.find((action) => action.value === selectedAction);
  const selectedReason = selectedReport ? reasonByReport[selectedReport.id] || "other" : "other";
  const warningExpiry = selectedReport ? warningExpiryByReport[selectedReport.id] || "none" : "none";
  const availableActions = selectedReport
    ? ACTION_OPTIONS.filter((action) => isMessageReport(selectedReport) || action.value !== "delete_message")
    : ACTION_OPTIONS;
  const needsReason = !["dismiss", "delete_message"].includes(selectedAction);
  const isBusy = selectedReport ? busyReportId === selectedReport.id : false;

  const handleOpenReportedUser = useCallback(
    (report: AdminReport, anchor: HTMLElement) => {
      if (!report.reported_user?.id) return;
      openUserProfileModal(openModal, report.reported_user.id, anchor, SIDE_ALIGNED_USER_PROFILE_POPOVER);
    },
    [openModal],
  );

  const applyAction = async (report: AdminReport) => {
    if (!user?.id) return;
    const action = actionByReport[report.id] || "dismiss";
    const selectedReasonValue = reasonByReport[report.id] || "other";
    const presetReason = PUNISHMENT_REASONS.find((reason) => reason.value === selectedReasonValue);
    const reason =
      selectedReasonValue === "custom"
        ? customReasonByReport[report.id]?.trim()
        : presetReason?.label || report.reason || "Platform rules violation";
    const note = noteByReport[report.id] || null;
    const expiry = warningExpiryByReport[report.id] || "none";
    let expiresAt: string | null = null;

    if (!["dismiss", "delete_message"].includes(action) && !reason) {
      toast.error("Punishment reason is required");
      return;
    }

    if (action === "warn") {
      const now = Date.now();
      if (expiry === "24h") expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
      if (expiry === "7d") expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
      if (expiry === "30d") expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (expiry === "custom") {
        const raw = customWarningExpiryByReport[report.id];
        if (!raw) {
          toast.error("Select a warning expiry date");
          return;
        }
        const customDate = new Date(raw);
        if (Number.isNaN(customDate.getTime()) || customDate.getTime() <= now) {
          toast.error("Warning expiry must be in the future");
          return;
        }
        expiresAt = customDate.toISOString();
      }
    }

    setBusyReportId(report.id);
    try {
      const rpcName = isMessageReport(report) ? "apply_admin_report_action_v2" : "apply_admin_entity_report_action";
      const { data, error } = await (supabase.rpc as any)(rpcName, {
        _admin_user_id: user.id,
        _report_id: report.id,
        _action_type: action,
        _note: note,
        _reason: reason,
        _expires_at: expiresAt,
      });

      if (error) throw error;
      const deletedCount = Number((data as { deleted_count?: number } | null)?.deleted_count ?? 0);
      if (action === "delete_message" && deletedCount === 0) {
        toast.info("Report resolved. The message was already gone.");
      } else {
        toast.success("Moderation action applied");
      }
      await loadReports();
    } catch (error) {
      console.error("Failed to apply moderation action:", error);
      toast.error("Failed to apply action");
    } finally {
      setBusyReportId(null);
    }
  };

  if (!canView) {
    return (
      <div className="flex h-full items-center justify-center bg-layout-chat px-6 text-center">
        <div className="max-w-md">
          <ShieldAlert className="mx-auto mb-4 h-9 w-9 text-muted-foreground" />
          <h1 className="text-xl font-semibold text-foreground">Admin access required</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Add your username or user ID to the temporary platform admin allowlist to view this panel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-layout-chat">
      <header className="flex shrink-0 flex-col gap-4 border-b border-border/70 bg-gradient-to-r from-primary/10 via-background to-warning/5 px-4 py-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mb-4 rounded-[4px] border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
            onClick={() => navigate("/app")}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </Button>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Gavel className="h-4 w-4" />
            Platform moderation
          </div>
          <h1 className="text-2xl font-semibold text-foreground">Reports inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a report from the inbox and review it in the reading pane.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center sm:w-[360px]">
          <div className="rounded-[6px] border border-primary/40 bg-primary/10 p-2">
            <div className="text-lg font-semibold text-primary">{reports.length}</div>
            <div className="text-xs text-muted-foreground">Loaded</div>
          </div>
          <div className="rounded-[6px] border border-warning/40 bg-warning/10 p-2">
            <div className="text-lg font-semibold text-warning">{counts.open ?? 0}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </div>
          <div className="rounded-[6px] border border-success/40 bg-success/10 p-2">
            <div className="text-lg font-semibold text-success">
              {(counts.actioned ?? 0) + (counts.dismissed ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">Resolved</div>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col border-r border-border/70 bg-background/40">
          <div className="space-y-3 border-b border-border/70 bg-gradient-to-b from-primary/5 to-transparent p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Inbox</div>
                <div className="text-xs text-muted-foreground">{filteredReports.length} reports</div>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={loadReports} loading={isLoading}>
                {!isLoading && <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>

            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger className="h-9 rounded-[4px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search reports"
                className="h-9 rounded-[4px] pl-9"
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading reports...</div>
            ) : filteredReports.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">No reports found.</div>
            ) : (
              <div className="space-y-1">
                {filteredReports.map((report) => (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => setSelectedReportId(report.id)}
                    className={cn(
                      "relative w-full overflow-hidden rounded-[6px] border px-3 py-2.5 text-left transition-colors",
                      selectedReportId === report.id
                        ? "border-primary/60 bg-primary/15 shadow-[0_0_0_1px_hsl(var(--primary)/0.16),0_12px_30px_hsl(var(--primary)/0.08)]"
                        : "border-border/40 bg-card/35 hover:border-primary/30 hover:bg-primary/5",
                    )}
                  >
                    <span className={cn("pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b", statusAccentStyles[report.status])} />
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {getReportTitle(report)}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{formatDate(report.created_at)}</span>
                    </div>
                    <div className="mb-2 flex items-center gap-2">
                      <span className={cn("rounded-[4px] border px-1.5 py-0.5 text-[11px] font-semibold", statusStyles[report.status])}>
                        {report.status}
                      </span>
                      <span className="shrink-0 rounded-[4px] bg-secondary px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        {getReportKindLabel(report)}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">{report.reason}</span>
                    </div>
                    <div className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {getReportPreview(report)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="min-w-0 overflow-y-auto bg-gradient-to-br from-background via-layout-chat to-primary/5">
          {!selectedReport ? (
            <div className="flex h-full min-h-[520px] items-center justify-center p-8 text-center">
              <div>
                <MessageSquareWarning className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <div className="text-sm font-medium text-foreground">No report selected</div>
                <div className="mt-1 text-sm text-muted-foreground">Choose a report from the inbox.</div>
              </div>
            </div>
          ) : (
            <div className="grid min-h-full lg:grid-cols-[minmax(0,1fr)_340px]">
              <section className="min-w-0 border-b border-border/70 p-4 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className={cn("rounded-[4px] border px-2 py-0.5 text-xs font-semibold", statusStyles[selectedReport.status])}>
                        {selectedReport.status}
                      </span>
                      <span className="rounded-[4px] bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        {getReportKindLabel(selectedReport)}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-foreground">{getReportTitle(selectedReport)}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Reported for {selectedReport.reason} by {displayName(selectedReport.reporter)}
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground sm:text-right">
                    <div>Report {shortId(selectedReport.id)}</div>
                    <div>
                      {isMessageReport(selectedReport)
                        ? `Message ${shortId(selectedReport.message_id || "")}`
                        : `Target ${shortId(selectedReport.entity_id || selectedReport.id)}`}
                    </div>
                  </div>
                </div>

                {selectedReport.active_punishments.length > 0 && (
                  <div className="mb-4 rounded-[6px] border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    <div className="mb-2 flex items-center gap-2 font-semibold">
                      <Ban className="h-4 w-4" />
                      Active punishment
                    </div>
                    <div className="space-y-1">
                      {selectedReport.active_punishments.map((punishment) => (
                        <div key={punishment.id}>
                          {punishment.action_type} - {punishment.reason}
                          {punishment.expires_at ? ` until ${formatDate(punishment.expires_at)}` : ""}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {isMessageReport(selectedReport)
                        ? "Reported message"
                        : selectedReport.report_type === "profile"
                          ? "Reported profile"
                          : "Reported server"}
                    </div>
                    <div className="max-h-[360px] overflow-y-auto whitespace-pre-wrap rounded-[6px] border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed text-foreground shadow-[0_0_30px_hsl(var(--warning)/0.05)]">
                      {isMessageReport(selectedReport) ? selectedReport.message_content || "(empty message)" : getReportPreview(selectedReport)}
                    </div>
                  </div>

                  {selectedReport.details && (
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Reporter details
                      </div>
                      <div className="whitespace-pre-wrap rounded-[6px] border border-primary/30 bg-primary/10 p-3 text-sm text-muted-foreground">
                        {selectedReport.details}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      disabled={!selectedReport.reported_user?.id}
                      onClick={(event) => handleOpenReportedUser(selectedReport, event.currentTarget)}
                      className="rounded-[6px] border border-primary/30 bg-primary/10 p-3 text-left text-sm transition-colors hover:border-primary/60 hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-100"
                    >
                      <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                        {selectedReport.report_type === "server" ? "Server owner" : "Reported user"}
                      </div>
                      <div className="text-muted-foreground">
                        {selectedReport.reported_user
                          ? `${displayName(selectedReport.reported_user)} (@${selectedReport.reported_user.username})`
                          : "Unknown"}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">{selectedReport.reported_user?.id || ""}</div>
                    </button>
                    <div className="rounded-[6px] border border-success/30 bg-success/10 p-3 text-sm">
                      <div className="mb-2 font-semibold text-foreground">Context</div>
                      <div className="truncate text-muted-foreground">
                        {selectedReport.report_type === "server"
                          ? selectedReport.reported_server?.name || String(selectedReport.snapshot?.name || "Server")
                          : String(selectedReport.context.server_id || selectedReport.context.conversation_id || selectedReport.entity_id || "No context")}
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {selectedReport.report_type === "server"
                          ? selectedReport.reported_server?.id || selectedReport.entity_id || ""
                          : String(selectedReport.context.channel_id || "")}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <aside className="space-y-4 border-l border-border/70 bg-card/40 p-4">
                {selectedReport.status !== "open" && (
                  <div className="rounded-[6px] border border-success/30 bg-success/10 p-3 text-sm text-muted-foreground">
                    <div className="mb-2 flex items-center gap-2 font-semibold text-foreground">
                      <Clock className="h-4 w-4" />
                      Reviewed
                    </div>
                    <div>{formatDate(selectedReport.reviewed_at)}</div>
                    <div>By {displayName(selectedReport.reviewer)}</div>
                    {selectedReport.resolution_note && <div className="mt-2 whitespace-pre-wrap">{selectedReport.resolution_note}</div>}
                  </div>
                )}

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Action</div>
                  <Select
                    value={selectedAction}
                    onValueChange={(value) =>
                      setActionByReport((current) => ({ ...current, [selectedReport.id]: value }))
                    }
                  >
                    <SelectTrigger className="rounded-[4px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableActions.map((action) => (
                        <SelectItem key={action.value} value={action.value}>
                          {action.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {actionMeta && <p className="mt-2 text-xs text-muted-foreground">{actionMeta.description}</p>}
                </div>

                {needsReason && (
                  <div className="space-y-2">
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        User-facing reason
                      </div>
                      <Select
                        value={selectedReason}
                        onValueChange={(value) =>
                          setReasonByReport((current) => ({ ...current, [selectedReport.id]: value }))
                        }
                      >
                        <SelectTrigger className="rounded-[4px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PUNISHMENT_REASONS.map((reason) => (
                            <SelectItem key={reason.value} value={reason.value}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedReason === "custom" && (
                      <Input
                        value={customReasonByReport[selectedReport.id] || ""}
                        onChange={(event) =>
                          setCustomReasonByReport((current) => ({ ...current, [selectedReport.id]: event.target.value }))
                        }
                        maxLength={160}
                        placeholder="Explain the rule violation"
                        className="h-9 rounded-[4px]"
                      />
                    )}
                  </div>
                )}

                {selectedAction === "warn" && (
                  <div className="space-y-2">
                    <div>
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Warning expiry
                      </div>
                      <Select
                        value={warningExpiry}
                        onValueChange={(value) =>
                          setWarningExpiryByReport((current) => ({ ...current, [selectedReport.id]: value }))
                        }
                      >
                        <SelectTrigger className="rounded-[4px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {WARNING_EXPIRY_OPTIONS.map((expiry) => (
                            <SelectItem key={expiry.value} value={expiry.value}>
                              {expiry.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {warningExpiry === "custom" && (
                      <Input
                        type="datetime-local"
                        value={customWarningExpiryByReport[selectedReport.id] || ""}
                        onChange={(event) =>
                          setCustomWarningExpiryByReport((current) => ({
                            ...current,
                            [selectedReport.id]: event.target.value,
                          }))
                        }
                        className="h-9 rounded-[4px]"
                      />
                    )}
                  </div>
                )}

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Admin note
                  </div>
                  <Textarea
                    value={noteByReport[selectedReport.id] || ""}
                    onChange={(event) =>
                      setNoteByReport((current) => ({ ...current, [selectedReport.id]: event.target.value }))
                    }
                    maxLength={1000}
                    placeholder="Optional context shown in the user notice"
                    className="min-h-28 rounded-[4px]"
                  />
                </div>

                <Button
                  type="button"
                  variant={selectedAction === "dismiss" ? "outline" : "warning"}
                  className="w-full rounded-[4px]"
                  onClick={() => applyAction(selectedReport)}
                  loading={isBusy}
                  disabled={isBusy}
                >
                  Apply action
                </Button>

                <div className="rounded-[6px] border border-warning/30 bg-warning/10 p-3 text-xs text-muted-foreground">
                  <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                    <AlertTriangle className="h-4 w-4" />
                    Action visibility
                  </div>
                  Warnings and punishments show in the user's next site session. Suspends and bans log them out after acknowledgement.
                </div>
              </aside>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
