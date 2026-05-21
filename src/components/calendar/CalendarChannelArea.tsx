import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, format, isSameDay, startOfMonth, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Link2, Loader2, MapPin, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";

type CalendarEvent = {
  id: string;
  channel_id: string;
  server_id: string;
  created_by: string;
  title: string;
  color: string;
  description: string | null;
  location: string | null;
  url: string | null;
  starts_at: string;
  ends_at: string;
  timezone: string;
  is_all_day: boolean;
  recurrence: string;
  allow_rsvps: boolean;
  limit_attendance: boolean;
  attendance_limit: number | null;
  restrict_roles: boolean;
  allowed_role_ids: string[];
  rsvp_count: number;
  viewer_rsvp_status: string | null;
};

type CalendarChannelAreaProps = {
  showHeader?: boolean;
};

type ToggleSettingProps = {
  title: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_COLOR_OPTIONS = [
  "#0ea5e9",
  "#22c55e",
  "#ef4444",
  "#a855f7",
  "#f97316",
  "#14b8a6",
  "#64748b",
  "#ec4899",
];
const DEFAULT_EVENT_COLOR = EVENT_COLOR_OPTIONS[0];

const pad = (value: number) => String(value).padStart(2, "0");

const getTimeZoneParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour: Number(map.get("hour")),
    minute: Number(map.get("minute")),
    second: Number(map.get("second")),
  };
};

const getOffsetMs = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return utc - date.getTime();
};

const zonedDateTimeToUtc = (
  timeZone: string,
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) => {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstPass = new Date(utcGuess - getOffsetMs(new Date(utcGuess), timeZone));
  return new Date(utcGuess - getOffsetMs(firstPass, timeZone));
};

const getServerDateKey = (date: Date, timeZone: string) => {
  const parts = getTimeZoneParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
};

const getDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const getTimeZoneAbbreviation = (timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" }).formatToParts(new Date());
  return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
};

const formatLocalTimeRange = (event: CalendarEvent) => {
  if (event.is_all_day) return "All day";
  const startsAt = new Date(event.starts_at);
  const endsAt = new Date(event.ends_at);
  const sameDay = isSameDay(startsAt, endsAt);
  const startLabel = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(startsAt);
  const endLabel = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(sameDay ? {} : { month: "short", day: "numeric" }),
  }).format(endsAt);
  return `${startLabel} - ${endLabel}`;
};

const ToggleSetting = ({ title, description, checked, onCheckedChange, disabled }: ToggleSettingProps) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3">
    <div className="min-w-0">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

const getUpcomingDateLabel = (date: Date) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (isSameDay(date, today)) return `Today ${format(date, "MMM d")}`;
  if (isSameDay(date, tomorrow)) return `Tomorrow ${format(date, "MMM d")}`;
  return format(date, "EEEE MMM d");
};

export const CalendarChannelArea = ({ showHeader = true }: CalendarChannelAreaProps) => {
  const currentChannel = useServerStore((s) => s.currentChannel);
  const currentServer = useServerStore((s) => s.currentServer);
  const roles = useServerStore((s) => s.roles);
  const fetchRoles = useServerStore((s) => s.fetchRoles);
  const user = useAuthStore((s) => s.user);

  const serverTimezone = currentServer?.timezone || "UTC";
  const serverTimezoneLabel = getTimeZoneAbbreviation(serverTimezone);
  const [view, setView] = useState<"month" | "upcoming">("month");
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState(getDateKey(new Date()));
  const [formTab, setFormTab] = useState("basic");
  const [isSaving, setIsSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [eventColor, setEventColor] = useState(DEFAULT_EVENT_COLOR);
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDate, setStartDate] = useState(getDateKey(new Date()));
  const [endDate, setEndDate] = useState(getDateKey(new Date()));
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:00");
  const [recurrence, setRecurrence] = useState("once");
  const [location, setLocation] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [allowRsvps, setAllowRsvps] = useState(true);
  const [limitAttendance, setLimitAttendance] = useState(false);
  const [attendanceLimit, setAttendanceLimit] = useState("20");
  const [restrictRoles, setRestrictRoles] = useState(false);
  const [allowedRoleId, setAllowedRoleId] = useState("");

  const channelId = currentChannel?.id ?? null;
  const serverId = currentServer?.id ?? null;

  const resetFormForDate = useCallback(
    (dateKey: string) => {
      setFormTab("basic");
      setTitle("");
      setEventColor(DEFAULT_EVENT_COLOR);
      setIsAllDay(false);
      setStartDate(dateKey);
      setEndDate(dateKey);
      setStartTime("16:00");
      setEndTime("17:00");
      setRecurrence("once");
      setLocation("");
      setUrl("");
      setDescription("");
      setAllowRsvps(true);
      setLimitAttendance(false);
      setAttendanceLimit("20");
      setRestrictRoles(false);
      setAllowedRoleId(roles[0]?.id ?? "");
    },
    [roles],
  );

  const loadEvents = useCallback(async () => {
    if (!channelId || !serverId || !user?.id) return;

    setIsLoading(true);
    try {
      const monthStart = startOfMonth(subMonths(visibleMonth, 1));
      const monthEnd = endOfMonth(addMonths(visibleMonth, 2));
      const { data, error } = await (supabase.rpc as any)("get_calendar_events", {
        _channel_id: channelId,
        _user_id: user.id,
        _starts_after: monthStart.toISOString(),
        _starts_before: monthEnd.toISOString(),
      });
      if (error) throw error;
      setEvents(Array.isArray(data) ? (data as CalendarEvent[]) : []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, [channelId, serverId, user?.id, visibleMonth]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!serverId) return;
    void fetchRoles(serverId);
  }, [fetchRoles, serverId]);

  const calendarDays = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    const start = new Date(first);
    start.setDate(first.getDate() - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [visibleMonth]);

  const eventsByServerDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = getServerDateKey(new Date(event.starts_at), serverTimezone);
      const list = grouped.get(key) ?? [];
      list.push(event);
      grouped.set(key, list);
    }
    return grouped;
  }, [events, serverTimezone]);

  const upcomingEvents = useMemo(
    () => events.filter((event) => new Date(event.ends_at).getTime() >= Date.now()).sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [events],
  );

  const openCreate = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    resetFormForDate(dateKey);
    setIsCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!channelId || !serverId || !user?.id) return;
    if (!title.trim()) {
      toast.error("Event name is required");
      return;
    }

    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const [startHour, startMinute] = isAllDay ? [0, 0] : startTime.split(":").map(Number);
    const [endHour, endMinute] = isAllDay ? [23, 59] : endTime.split(":").map(Number);
    const startsAt = zonedDateTimeToUtc(serverTimezone, startYear, startMonth, startDay, startHour, startMinute);
    const endsAt = zonedDateTimeToUtc(serverTimezone, endYear, endMonth, endDay, endHour, endMinute);

    if (endsAt.getTime() <= startsAt.getTime()) {
      toast.error("End time must be after start time");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await (supabase.rpc as any)("create_calendar_event", {
        _channel_id: channelId,
        _server_id: serverId,
        _user_id: user.id,
        _title: title.trim(),
        _color: eventColor,
        _description: description.trim() || null,
        _location: location.trim() || null,
        _url: url.trim() || null,
        _starts_at: startsAt.toISOString(),
        _ends_at: endsAt.toISOString(),
        _timezone: serverTimezone,
        _is_all_day: isAllDay,
        _recurrence: recurrence,
        _allow_rsvps: allowRsvps,
        _limit_attendance: allowRsvps && limitAttendance,
        _attendance_limit: allowRsvps && limitAttendance ? Number(attendanceLimit) || null : null,
        _restrict_roles: allowRsvps && restrictRoles,
        _allowed_role_ids: allowRsvps && restrictRoles && allowedRoleId ? [allowedRoleId] : [],
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (result && result.success === false) throw new Error(result.error || "Failed to create event");
      toast.success("Event created");
      setIsCreateOpen(false);
      await loadEvents();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create event");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRsvp = async (event: CalendarEvent) => {
    if (!user?.id || !event.allow_rsvps) return;
    try {
      const nextStatus = event.viewer_rsvp_status === "going" ? "none" : "going";
      const { data, error } = await (supabase.rpc as any)("set_calendar_event_rsvp", {
        _event_id: event.id,
        _user_id: user.id,
        _status: nextStatus,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string } | null;
      if (result && result.success === false) throw new Error(result.error || "Failed to update RSVP");
      await loadEvents();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update RSVP");
    }
  };

  if (!currentChannel) return null;

  return (
    <div className="flex h-full min-w-0 flex-col bg-layout-members">
      {showHeader && <ChannelHeader channel={currentChannel} showMessageActions={false} />}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#313640] text-[#f4f5f7]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#262b33] px-4 py-3">
          {view === "month" ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-[3px]" onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="min-w-[160px] text-lg font-bold">{format(visibleMonth, "MMMM yyyy")}</h2>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-[3px]" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h2 className="text-lg font-bold">Upcoming events</h2>
          )}

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase text-[#a7adb8]">{serverTimezoneLabel}</span>
            <div className="flex items-center gap-1 rounded-[3px] border border-border/60 bg-secondary/20 p-1">
              <Button
                type="button"
                variant={view === "month" ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-7 rounded-[3px] px-3 text-xs font-semibold", view !== "month" && "bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground")}
                onClick={() => setView("month")}
              >
                Month
              </Button>
              <Button
                type="button"
                variant={view === "upcoming" ? "secondary" : "ghost"}
                size="sm"
                className={cn("h-7 rounded-[3px] px-3 text-xs font-semibold", view !== "upcoming" && "bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground")}
                onClick={() => setView("upcoming")}
              >
                Upcoming
              </Button>
            </div>
          </div>
        </div>

        {view === "month" ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="grid grid-cols-7 border-b border-[#282d35] bg-[#313640]">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-3 py-3 text-xs font-bold text-[#d7dbe3]">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid min-h-[calc(100%-45px)] grid-cols-7 grid-rows-6">
              {calendarDays.map((day) => {
                const dateKey = getDateKey(day);
                const dayEvents = eventsByServerDate.get(dateKey) ?? [];
                const isOutside = day.getMonth() !== visibleMonth.getMonth();
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "group relative min-h-[108px] border-b border-r border-[#2b3039] bg-[#303540] p-2 transition-colors hover:bg-[#3a3f4b]",
                      isOutside && "bg-[#282c34] text-[#6f7580]",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-semibold", isToday && "bg-primary text-primary-foreground")}>
                        {day.getDate()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6 rounded-[3px] opacity-0 hover:bg-[#4a505d] group-hover:opacity-100"
                        onClick={() => openCreate(dateKey)}
                        aria-label={`Create event on ${dateKey}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((event, index) => (
                        <div
                          key={event.id}
                          className="truncate rounded-[2px] px-2 py-0.5 text-[11px] font-bold text-white"
                          style={{ backgroundColor: event.color || DEFAULT_EVENT_COLOR }}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-[11px] text-[#aeb4bf]">+{dayEvents.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto p-4">
            <div className="divide-y divide-[#3b404a] bg-[#2f343d]">
              {upcomingEvents.length === 0 && !isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-[#aeb4bf]">
                  <CalendarDays className="mb-3 h-9 w-9" />
                  <p className="text-sm">No upcoming events</p>
                </div>
              ) : (
                upcomingEvents.map((event, index) => (
                  <div key={event.id} className="grid grid-cols-[160px_minmax(0,1fr)_220px] items-center gap-4 px-8 py-7">
                    <div>
                      <p className="text-xs font-bold text-[#b8bec8]">{getUpcomingDateLabel(new Date(event.starts_at))}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-[#f0f2f5]">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: event.color || DEFAULT_EVENT_COLOR }}
                        />
                        <span>{formatLocalTimeRange(event)}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{event.title}</p>
                      {(event.location || event.url) && (
                        <div className="mt-2 flex min-w-0 items-center gap-3 text-xs text-[#aeb4bf]">
                          {event.location && <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3" />{event.location}</span>}
                          {event.url && <span className="inline-flex min-w-0 items-center gap-1 truncate"><Link2 className="h-3 w-3" />{event.url}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-4 text-xs font-bold">
                      {event.allow_rsvps && (
                        <Button
                          variant="outline"
                          className={cn(
                            "h-8 min-w-[96px] rounded-[3px] border-primary/70 bg-transparent text-xs font-bold text-foreground hover:bg-primary/10",
                            event.viewer_rsvp_status === "going" && "bg-primary text-primary-foreground hover:bg-primary/90",
                          )}
                          onClick={() => void handleRsvp(event)}
                        >
                          {event.viewer_rsvp_status === "going" ? "Joined" : "Join"}
                        </Button>
                      )}
                      <span className="text-[#d8dce4]">{event.rsvp_count} are going</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="calendar-event-dialog max-h-[90vh] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden rounded-[4px] border border-[#4a4f5a] bg-[#333842] p-0 text-[#f4f5f7] shadow-2xl sm:max-w-[560px]">
          <div className="flex max-h-[82vh] flex-col overflow-hidden">
            <div className="border-b border-[#2b3039] bg-[#2f343d] px-5 py-3">
              <h3 className="text-base font-medium leading-none tracking-tight">Create an event</h3>
            </div>
            <Tabs value={formTab} onValueChange={setFormTab} className="min-h-0 flex-1 overflow-hidden">
              <TabsList className="mx-6 mt-4 h-10 justify-start gap-7 rounded-none bg-transparent p-0">
                <TabsTrigger value="basic" className="rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-[#b8bec8] data-[state=active]:border-[#cbd0d8] data-[state=active]:bg-transparent data-[state=active]:text-[#f3f4f7] data-[state=active]:shadow-none">Basic Info</TabsTrigger>
                <TabsTrigger value="advanced" className="rounded-none border-b-2 border-transparent bg-transparent px-0 text-sm font-medium text-[#b8bec8] data-[state=active]:border-[#cbd0d8] data-[state=active]:bg-transparent data-[state=active]:text-[#f3f4f7] data-[state=active]:shadow-none">Advanced</TabsTrigger>
              </TabsList>
              <TabsContent value="basic" className="m-0 max-h-[58vh] overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                  <div className="flex items-end gap-2">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event name" className="h-9 flex-1 rounded-none border-0 border-b border-white/80 bg-transparent px-0 text-sm text-[#f3f4f7] shadow-none outline-none placeholder:text-[#b8bec8] focus-visible:ring-0 focus-visible:ring-offset-0" maxLength={120} />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="h-4 w-4 shrink-0 rounded-full border border-white/40 p-0 shadow-sm outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
                          style={{ backgroundColor: eventColor }}
                          aria-label="Choose event color"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-auto min-w-0 p-2">
                        <div className="grid grid-cols-4 gap-1.5">
                          {EVENT_COLOR_OPTIONS.map((color) => (
                            <DropdownMenuItem
                              key={color}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[3px] p-0"
                              onSelect={() => setEventColor(color)}
                              aria-label={`Use event color ${color}`}
                            >
                              <span
                                className={cn(
                                  "h-5 w-5 rounded-full ring-offset-2 ring-offset-[hsl(var(--menu))]",
                                  eventColor === color && "ring-2 ring-foreground",
                                )}
                                style={{ backgroundColor: color }}
                              />
                            </DropdownMenuItem>
                          ))}
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <ToggleSetting title="All day" checked={isAllDay} onCheckedChange={setIsAllDay} />
                  <div className="space-y-2">
                    <div className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#c4c8d0]">
                        <CalendarDays className="h-3.5 w-3.5 text-[#aeb4bf]" />
                        Start
                      </div>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value);
                          if (endDate < e.target.value) setEndDate(e.target.value);
                        }}
                        className="h-9 rounded-[3px] border-[#4a4f5a] bg-[#2f343d] text-sm text-[#f3f4f7] [color-scheme:dark]"
                      />
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={isAllDay}
                        className="h-9 rounded-[3px] border-[#4a4f5a] bg-[#2f343d] text-sm text-[#f3f4f7] [color-scheme:dark]"
                      />
                    </div>
                    <div className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#c4c8d0]">
                        <Clock className="h-3.5 w-3.5 text-[#aeb4bf]" />
                        End
                      </div>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-9 rounded-[3px] border-[#4a4f5a] bg-[#2f343d] text-sm text-[#f3f4f7] [color-scheme:dark]"
                      />
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={isAllDay}
                        className="h-9 rounded-[3px] border-[#4a4f5a] bg-[#2f343d] text-sm text-[#f3f4f7] [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-[72px_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#c4c8d0]">Occurs</div>
                    <Select value={recurrence} onValueChange={setRecurrence}>
                      <SelectTrigger className="h-9 rounded-[3px] border-[#4a4f5a] bg-[#2f343d]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="once">Only once</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-right text-xs leading-5 text-[#aeb4bf]">
                      Server timezone: <span className="font-semibold text-[#d7dbe3]">{serverTimezoneLabel}</span>
                    </div>
                  </div>
                  <div className="h-px bg-[#3d424d]" />
                  <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location (optional)" className="rounded-none border-0 border-b border-[#8f96a4] bg-transparent px-0 text-sm focus-visible:ring-0" />
                  <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Url (optional)" className="rounded-none border-0 border-b border-[#8f96a4] bg-transparent px-0 text-sm focus-visible:ring-0" />
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" className="min-h-[112px] resize-none rounded-[3px] border-[#454b57] bg-[#454b57] text-sm" maxLength={2000} />
                </div>
              </TabsContent>
              <TabsContent value="advanced" className="m-0 max-h-[58vh] overflow-y-auto px-6 py-4">
                <div className="space-y-4">
                  <ToggleSetting
                    title="Allow RSVPs"
                    description="If disabled, no one will be able to join your event."
                    checked={allowRsvps}
                    onCheckedChange={setAllowRsvps}
                  />
                  {allowRsvps && (
                    <>
                      <ToggleSetting
                        title="Limit attendance"
                        description="Limit the number of people that can attend this event."
                        checked={limitAttendance}
                        onCheckedChange={setLimitAttendance}
                      />
                      {limitAttendance && (
                        <Input value={attendanceLimit} onChange={(e) => setAttendanceLimit(e.target.value.replace(/\D/g, ""))} className="h-9 w-28 rounded-[3px] border-[#4a4f5a] bg-[#2f343d]" placeholder="20" />
                      )}
                      <ToggleSetting
                        title="Restrict roles"
                        description="Specify the roles that can attend this event."
                        checked={restrictRoles}
                        onCheckedChange={setRestrictRoles}
                      />
                      {restrictRoles && (
                        <Select value={allowedRoleId} onValueChange={setAllowedRoleId}>
                          <SelectTrigger className="h-9 rounded-[3px] border-[#4a4f5a] bg-[#2f343d]">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {roles.map((role) => (
                              <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
            <div className="flex items-center justify-end gap-3 border-t border-[#2c3139] bg-[#30353f] px-5 py-3">
              <Button variant="ghost" className="h-9 rounded-[3px] px-4 text-[#b9bec8] hover:bg-transparent hover:text-white" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button disabled={isSaving || !title.trim()} className="h-9 rounded-[3px] bg-[#d7dbe3] px-5 font-medium text-[#363b44] hover:bg-white disabled:bg-[#454b55] disabled:text-[#858b96] disabled:opacity-100" onClick={() => void handleCreate()}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
