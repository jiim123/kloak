import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Ban, ChevronRight, Clock, MessageSquareOff, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";

type UserPunishmentNotice = {
  id: string;
  action_type: "warn" | "restrict_messages" | "suspend" | "ban";
  reason: string;
  details: string | null;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  report?: {
    id: string;
    reason: string;
    message_type: string;
    message_content?: string | null;
    created_at: string;
  } | null;
};

const WarningIcon = () => (
  <svg viewBox="0 0 25 25" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-14 w-14" aria-hidden="true">
    <path
      d="M12.5 10V14M12.5 17V15.5M14.2483 5.64697L20.8493 17.5287C21.5899 18.8618 20.6259 20.5 19.101 20.5H5.89903C4.37406 20.5 3.41013 18.8618 4.15072 17.5287L10.7517 5.64697C11.5137 4.27535 13.4863 4.27535 14.2483 5.64697Z"
      stroke="currentColor"
      strokeWidth="1.2"
    />
  </svg>
);

const actionLabels: Record<UserPunishmentNotice["action_type"], string> = {
  warn: "Warning",
  restrict_messages: "Message restriction",
  suspend: "Account suspension",
  ban: "Account ban",
};

const actionDescriptions: Record<UserPunishmentNotice["action_type"], string> = {
  warn: "You broke the rules and a warning has been added to your account.",
  restrict_messages: "Your ability to send messages is restricted while this action is active.",
  suspend: "Your account is suspended. You will be logged out after acknowledging this notice.",
  ban: "Your account has been banned. You will be logged out after acknowledging this notice.",
};

const actionIcons: Record<UserPunishmentNotice["action_type"], typeof AlertTriangle> = {
  warn: AlertTriangle,
  restrict_messages: MessageSquareOff,
  suspend: Clock,
  ban: Ban,
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return "No expiry";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const formatDuration = (startValue: string, endValue: string | null | undefined, actionType: UserPunishmentNotice["action_type"]) => {
  if (!endValue) {
    if (actionType === "ban") return "Permanent";
    if (actionType === "warn") return "No expiry";
    return "Indefinite";
  }

  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return "Until expiry";

  const totalMinutes = Math.round((end - start) / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? "" : "s"}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (!days && !hours && minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);

  return parts.length > 0 ? parts.join(", ") : "Less than 1 minute";
};

export const PunishmentNoticeModal = () => {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [notices, setNotices] = useState<UserPunishmentNotice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  const loadNotices = useCallback(async () => {
    if (!user?.id) {
      setNotices([]);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_my_unacknowledged_punishments", {
        _user_id: user.id,
      });

      if (error) throw error;
      setNotices(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load punishment notices:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadNotices();
  }, [loadNotices]);

  const hasLogoutPunishment = useMemo(
    () => notices.some((notice) => notice.action_type === "suspend" || notice.action_type === "ban"),
    [notices],
  );

  const acknowledge = async () => {
    if (!user?.id || notices.length === 0) return;

    setIsAcknowledging(true);
    try {
      const { error } = await (supabase.rpc as any)("acknowledge_my_punishments", {
        _user_id: user.id,
        _punishment_ids: notices.map((notice) => notice.id),
      });

      if (error) throw error;
      setNotices([]);

      if (hasLogoutPunishment) {
        logout();
        navigate("/auth?mode=login", { replace: true });
      }
    } catch (error) {
      console.error("Failed to acknowledge punishment notices:", error);
      toast.error("Failed to acknowledge notice");
    } finally {
      setIsAcknowledging(false);
    }
  };

  if (!user || notices.length === 0) return null;

  const primaryNotice = notices.find((notice) => notice.action_type === "ban")
    ?? notices.find((notice) => notice.action_type === "suspend")
    ?? notices.find((notice) => notice.action_type === "restrict_messages")
    ?? notices[0];
  const Icon = actionIcons[primaryNotice.action_type] ?? ShieldAlert;
  const isWarningOnly = notices.every((notice) => notice.action_type === "warn");
  const noticesWithAdminNotes = notices.filter((notice) => notice.details?.trim());

  return (
    <Dialog open>
      <DialogContent
        hideCloseButton
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
        className="max-w-[520px] overflow-hidden rounded-[8px] border-border bg-card p-0 text-card-foreground shadow-2xl shadow-black/50"
      >
        <div className="relative px-6 pb-5 pt-7">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-lg shadow-black/25">
            <WarningIcon />
          </div>

          <DialogHeader className="items-center text-center">
            <DialogTitle className="text-center text-xl font-semibold leading-snug text-foreground">
              {isWarningOnly ? "You received a warning" : actionLabels[primaryNotice.action_type]}
            </DialogTitle>
            <DialogDescription className="max-w-sm text-center text-sm leading-5 text-muted-foreground">
              {actionDescriptions[primaryNotice.action_type]}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <section>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Recent activity that broke our rules
              </div>
              <div className="max-h-[210px] space-y-3 overflow-y-auto pr-1">
                {notices.map((notice) => {
                  const NoticeIcon = actionIcons[notice.action_type] ?? ShieldAlert;
                  const reportedMessage = notice.report?.message_content?.trim();
                  return (
                    <div key={notice.id} className="rounded-[4px] border border-border bg-muted p-3 shadow-md shadow-black/20">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Reported message
                          </div>
                          <div className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-5 text-foreground">
                            {reportedMessage || "The reported message is no longer available."}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Actions taken
              </div>
              <div className="rounded-[4px] bg-background p-3 text-sm text-foreground">
                {notices.map((notice) => (
                  <div key={`${notice.id}-action`} className="py-1">
                    <span>
                      {actionLabels[notice.action_type]} for {notice.reason}
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Duration {formatDuration(notice.created_at, notice.expires_at, notice.action_type)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">Issued {formatDate(notice.created_at)}</span>
                      <span className="block text-xs text-muted-foreground">Expires {formatDate(notice.expires_at)}</span>
                    </span>
                  </div>
                ))}
                {hasLogoutPunishment && (
                  <div className="mt-2 rounded-[4px] border border-destructive/30 bg-destructive/10 p-2 text-destructive">
                    You will be logged out after acknowledgement. Future login is blocked while this action is active.
                  </div>
                )}
              </div>
            </section>

            {noticesWithAdminNotes.length > 0 && (
              <section>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Admin note
                </div>
                <div className="space-y-2 rounded-[4px] bg-background p-3 text-sm leading-5 text-foreground">
                  {noticesWithAdminNotes.map((notice) => (
                    <div key={`${notice.id}-note`} className="whitespace-pre-wrap">
                      {notice.details}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                Why this happened
              </div>
              <div className="rounded-[4px] bg-background p-3 text-sm leading-5 text-foreground">
                This action was taken after a report review. Read the rules and keep future activity within the platform guidelines.
                <button
                  type="button"
                  className="mt-3 flex w-full items-center justify-between rounded-[4px] bg-secondary px-3 py-2 text-left text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary-hover"
                >
                  <span>Get familiar with our policies</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </section>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border bg-background px-6 py-4">
          <p className="text-xs text-muted-foreground">Did we make a mistake? Contact a staff member.</p>
          <Button
            type="button"
            onClick={acknowledge}
            loading={isAcknowledging || isLoading}
            className="h-9 shrink-0 rounded-[4px] px-4 text-sm font-semibold"
          >
            I understand
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
