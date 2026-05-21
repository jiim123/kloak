import { useCallback, useEffect, useMemo, useState } from "react";
import { addMonths, endOfMonth, format, formatDistanceToNow, isSameDay, startOfMonth, subMonths } from "date-fns";
import { ArrowLeft, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Link2, Loader2, MapPin, MessageSquare, Plus, Send, Smile, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { MessageContent } from "@/components/chat/MessageContent";
import { EmojiPicker } from "@/components/modals/EmojiPicker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FluentEmoji } from "@/components/ui/FluentEmoji";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { getCdnUrl } from "@/lib/bunny-upload";
import { cn } from "@/lib/utils";
import { encodeCustomEmojisForTransport } from "@/lib/globalEmojiResolver";
import { getTopEmojis } from "@/lib/emojiRecents";
import { fetchServerEmojis } from "@/lib/serverEmojis";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import type { ReactionGroup, User } from "@/types";

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

type CalendarEventDetails = CalendarEvent & {
  going_count: number;
  comment_count: number;
  creator?: Pick<User, "id" | "username" | "display_name" | "avatar_url" | "banner_color">;
  attendees?: Pick<User, "id" | "username" | "display_name" | "avatar_url" | "banner_color">[];
};

type CalendarEventComment = {
  id: string;
  event_id: string;
  user_id: string;
  content: string;
  edited_at: string | null;
  created_at: string;
  user?: User;
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
  variant?: "boxed" | "plain";
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

const ToggleSetting = ({ title, description, checked, onCheckedChange, disabled, variant = "boxed" }: ToggleSettingProps) => (
  <div
    className={cn(
      "flex items-center justify-between gap-3",
      variant === "boxed" ? "rounded-lg border border-border/50 bg-secondary/30 p-3" : "py-1.5",
    )}
  >
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

const groupReactions = (reactions: any[], currentUserId?: string): ReactionGroup[] => {
  const groups: Record<string, ReactionGroup> = {};
  reactions.forEach((reaction) => {
    if (!groups[reaction.emoji]) {
      groups[reaction.emoji] = { emoji: reaction.emoji, count: 0, users: [], hasReacted: false };
    }
    groups[reaction.emoji].count += 1;
    groups[reaction.emoji].users.push(reaction.user_id);
    if (reaction.user_id === currentUserId) groups[reaction.emoji].hasReacted = true;
  });
  return Object.values(groups);
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
  const [allowedRoleIds, setAllowedRoleIds] = useState<string[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventDetails | null>(null);
  const [eventComments, setEventComments] = useState<CalendarEventComment[]>([]);
  const [eventReactions, setEventReactions] = useState<ReactionGroup[]>([]);
  const [isEventLoading, setIsEventLoading] = useState(false);
  const [eventReply, setEventReply] = useState("");
  const [isPostingEventReply, setIsPostingEventReply] = useState(false);
  const [eventReactionPickerOpen, setEventReactionPickerOpen] = useState(false);
  const [composerEmojiOpen, setComposerEmojiOpen] = useState(false);
  const [customEmojiMap, setCustomEmojiMap] = useState<Map<string, string>>(new Map());
  const topEmojis = useMemo(() => getTopEmojis(3), []);

  const channelId = currentChannel?.id ?? null;
  const serverId = currentServer?.id ?? null;
  const restrictableRoles = useMemo(
    () => roles.filter((role) => role.name !== "@everyone").sort((a, b) => b.position - a.position),
    [roles],
  );

  useEffect(() => {
    if (!currentServer?.id) return;
    let cancelled = false;
    void fetchServerEmojis(currentServer.id)
      .then((emojis) => {
        if (cancelled) return;
        setCustomEmojiMap(new Map(emojis.map((emoji) => [emoji.name, emoji.url])));
      })
      .catch(() => {
        if (!cancelled) setCustomEmojiMap(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [currentServer?.id]);

  const reactionEmojiNode = useCallback(
    (emoji: string, size = 20) => {
      const inlineMatch = emoji.match(/^:ce\[([a-z0-9_]{2,12})\|([a-z0-9/_.-]{1,300})\]:$/i);
      if (inlineMatch) {
        const url = getCdnUrl("server-emojis", inlineMatch[2]);
        return <img src={url} alt={`:${inlineMatch[1]}:`} className="object-contain" style={{ width: size, height: size }} loading="lazy" />;
      }
      const match = emoji.match(/^:([a-z0-9_]{2,12}):$/i);
      if (match) {
        const url = customEmojiMap.get(match[1]);
        if (url) return <img src={url} alt={emoji} className="object-contain" style={{ width: size, height: size }} loading="lazy" />;
      }
      return <FluentEmoji emoji={emoji} size={size} />;
    },
    [customEmojiMap],
  );

  const getReactionDisplayName = useCallback(
    (reactorId: string) => {
      if (reactorId === user?.id) return "You";

      const commentAuthor = eventComments.find((comment) => comment.user_id === reactorId)?.user;
      if (commentAuthor) return commentAuthor.display_name || commentAuthor.username || reactorId;

      const attendee = selectedEvent?.attendees?.find((candidate) => candidate.id === reactorId);
      if (attendee) return attendee.display_name || attendee.username || reactorId;

      if (selectedEvent?.creator?.id === reactorId) {
        return selectedEvent.creator.display_name || selectedEvent.creator.username || reactorId;
      }

      return "Someone";
    },
    [eventComments, selectedEvent?.attendees, selectedEvent?.creator, user?.id],
  );

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
      setAllowedRoleIds([]);
    },
    [],
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
    if (allowRsvps && restrictRoles && allowedRoleIds.length === 0) {
      toast.error("Select at least one role");
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
        _allowed_role_ids: allowRsvps && restrictRoles ? allowedRoleIds : [],
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

  const toggleAllowedRole = (roleId: string) => {
    setAllowedRoleIds((current) =>
      current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId],
    );
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

  const loadSelectedEvent = useCallback(async () => {
    if (!selectedEventId || !user?.id) return;
    setIsEventLoading(true);
    try {
      const { data, error } = await (supabase.rpc as any)("get_calendar_event_details", {
        _event_id: selectedEventId,
        _user_id: user.id,
      });
      if (error) throw error;
      setSelectedEvent(data as CalendarEventDetails | null);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load event");
      setSelectedEventId(null);
    } finally {
      setIsEventLoading(false);
    }
  }, [selectedEventId, user?.id]);

  const loadEventComments = useCallback(async () => {
    if (!selectedEventId || !user?.id) return;
    try {
      const { data, error } = await (supabase as any)
        .from("calendar_event_comments")
        .select("*, user:users(*)")
        .eq("event_id", selectedEventId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const comments = (data || []) as CalendarEventComment[];
      setEventComments(comments);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load event comments");
    }
  }, [selectedEventId, user?.id]);

  const loadEventReactions = useCallback(async () => {
    if (!selectedEventId || !user?.id) return;
    try {
      const { data, error } = await (supabase as any)
        .from("calendar_event_reactions")
        .select("*")
        .eq("event_id", selectedEventId);
      if (error) throw error;
      setEventReactions(groupReactions((data || []) as any[], user.id));
    } catch (error: any) {
      toast.error(error?.message || "Failed to load event reactions");
    }
  }, [selectedEventId, user?.id]);

  useEffect(() => {
    if (!selectedEventId) return;
    void loadSelectedEvent();
    void loadEventComments();
    void loadEventReactions();
  }, [selectedEventId, loadSelectedEvent, loadEventComments, loadEventReactions]);

  useEffect(() => {
    if (!selectedEventId) return;
    const channel = supabase
      .channel(`calendar-event:${selectedEventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_event_comments", filter: `event_id=eq.${selectedEventId}` }, () => {
        void loadEventComments();
        void loadSelectedEvent();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "calendar_event_reactions", filter: `event_id=eq.${selectedEventId}` }, () => {
        void loadEventReactions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedEventId, loadEventComments, loadEventReactions, loadSelectedEvent]);

  const openEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    setSelectedEvent(null);
    setEventComments([]);
    setEventReactions([]);
    setEventReply("");
  };

  const handleSelectedEventRsvp = async () => {
    if (!selectedEvent) return;
    await handleRsvp(selectedEvent);
    await loadSelectedEvent();
    await loadEvents();
  };

  const handlePostEventComment = async () => {
    if (!selectedEventId || !user?.id || !eventReply.trim()) return;
    const content = eventReply.trim();
    setIsPostingEventReply(true);
    setEventReply("");
    try {
      const encodedContent = await encodeCustomEmojisForTransport(content);
      const { error } = await (supabase.rpc as any)("insert_calendar_event_comment", {
        _event_id: selectedEventId,
        _user_id: user.id,
        _content: encodedContent,
      });
      if (error) throw error;
      await loadEventComments();
      await loadSelectedEvent();
    } catch (error: any) {
      setEventReply(content);
      toast.error(error?.message || "Failed to post comment");
    } finally {
      setIsPostingEventReply(false);
    }
  };

  const handleDeleteEventComment = async (commentId: string) => {
    if (!user?.id) return;
    try {
      const { error } = await (supabase.rpc as any)("delete_calendar_event_comment", {
        _comment_id: commentId,
        _user_id: user.id,
      });
      if (error) throw error;
      await loadEventComments();
      await loadSelectedEvent();
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete comment");
    }
  };

  const handleEventReaction = async (emoji: string) => {
    if (!selectedEventId || !user?.id) return;
    try {
      const { error } = await (supabase.rpc as any)("toggle_calendar_event_reaction", {
        _event_id: selectedEventId,
        _user_id: user.id,
        _emoji: emoji,
      });
      if (error) throw error;
      await loadEventReactions();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update reaction");
    }
  };

  if (!currentChannel) return null;

  if (selectedEventId) {
    const detail = selectedEvent;
    const creatorName = detail?.creator?.display_name || detail?.creator?.username || "Unknown";
    const attendeePreview = detail?.attendees?.slice(0, 5) ?? [];
    const startsAt = detail ? new Date(detail.starts_at) : null;
    const endsAt = detail ? new Date(detail.ends_at) : null;

    return (
      <div className="flex h-full min-w-0 flex-col bg-layout-members">
        {showHeader && <ChannelHeader channel={currentChannel} showMessageActions={false} />}
        <div className="flex min-h-0 flex-1 flex-col bg-[#313640] text-[#f4f5f7]">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-[#262b33] px-3">
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-8 w-8 rounded-[3px] text-[#c5cad3] hover:bg-[#3d4350]"
              onClick={() => {
                setSelectedEventId(null);
                setSelectedEvent(null);
                void loadEvents();
              }}
              aria-label="Back to calendar"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-0 truncate text-sm font-semibold">{detail?.title || "Event"}</span>
          </div>

          {isEventLoading && !detail ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-[#aeb4bf]" />
            </div>
          ) : !detail ? (
            <div className="flex flex-1 items-center justify-center text-sm text-[#aeb4bf]">Event not found</div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto">
              <div className="grid min-h-full grid-cols-1 gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <main className="min-w-0 space-y-3">
                  <h1 className="px-1 text-xl font-bold">{detail.title}</h1>
                  <section className="overflow-hidden rounded-[4px] bg-[#2f343d]">
                    {detail.allow_rsvps && (
                      <div className="border-b border-[#282d35] p-4">
                        <Button
                          variant={detail.viewer_rsvp_status === "going" ? "secondary" : "outline"}
                          className={cn(
                            "h-9 rounded-[3px] px-4 text-xs font-semibold",
                            detail.viewer_rsvp_status === "going"
                              ? "bg-[#3b8553] text-white hover:bg-[#347849]"
                              : "border-[#626977] bg-transparent text-[#d7dbe3] hover:bg-[#3b414c]",
                          )}
                          onClick={() => void handleSelectedEventRsvp()}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Going
                        </Button>
                      </div>
                    )}

                    <div className="border-b border-[#282d35] p-4">
                      <div className="flex items-start gap-3">
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#aeb4bf]" />
                        <div className="text-sm">
                          <p className="font-semibold">{startsAt ? format(startsAt, "EEEE, MMM d") : "No date"}</p>
                          <p className="mt-1 text-xs text-[#c7ccd5]">
                            {detail.is_all_day || !startsAt || !endsAt
                              ? "All day"
                              : `${format(startsAt, "h:mm a")} - ${format(endsAt, "h:mm a")} ${serverTimezoneLabel}`}
                          </p>
                        </div>
                      </div>
                    </div>

                    {(detail.location || detail.url) && (
                      <div className="space-y-2 border-b border-[#282d35] p-4 text-sm text-[#d7dbe3]">
                        {detail.location && (
                          <div className="flex items-center gap-3">
                            <MapPin className="h-4 w-4 text-[#aeb4bf]" />
                            <span>{detail.location}</span>
                          </div>
                        )}
                        {detail.url && (
                          <a className="flex items-center gap-3 text-primary hover:underline" href={detail.url} target="_blank" rel="noreferrer">
                            <Link2 className="h-4 w-4" />
                            <span className="truncate">{detail.url}</span>
                          </a>
                        )}
                      </div>
                    )}

                    <div className="border-b border-[#282d35] p-4">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={detail.creator?.avatar_url || undefined} />
                          <AvatarFallback style={{ backgroundColor: detail.creator?.banner_color || "#5865f2" }}>
                            {creatorName[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[#d7dbe3]">Created by</span>
                        <span className="text-primary">{creatorName}</span>
                      </div>
                    </div>

                    <div className="border-b border-[#282d35] p-4">
                      <p className="whitespace-pre-wrap break-words text-sm text-[#d7dbe3]">
                        {detail.description || "No description"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-b border-[#282d35] px-4 py-3 text-xs text-[#aeb4bf]">
                      <span>Created {formatDistanceToNow(new Date(detail.created_at), { addSuffix: true })}</span>
                    </div>

                    <div className="p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {eventReactions.map((reaction) => (
                          <HoverCard key={reaction.emoji} openDelay={200}>
                            <HoverCardTrigger asChild>
                              <span className="inline-flex">
                                <button
                                  type="button"
                                  className={cn(
                                    "inline-flex h-7 items-center gap-1 rounded-full border px-2 py-0 transition-colors duration-150",
                                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                                    reaction.hasReacted
                                      ? "border-primary/40 bg-primary/15 text-foreground hover:bg-primary/20"
                                      : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary hover:text-foreground",
                                  )}
                                  onClick={() => void handleEventReaction(reaction.emoji)}
                                >
                                  {reactionEmojiNode(reaction.emoji, 20)}
                                  <span className={cn("text-[11px] leading-none", reaction.hasReacted ? "font-semibold text-foreground" : "font-normal text-muted-foreground")}>
                                    {reaction.count}
                                  </span>
                                </button>
                              </span>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-auto p-1.5" align="start" side="top">
                              {(() => {
                                const names = reaction.users.map((reactorId) => getReactionDisplayName(reactorId));
                                const preview = names.slice(0, 4);
                                const remaining = Math.max(0, names.length - preview.length);
                                return (
                                  <div className="flex items-center gap-1">
                                    <div className="shrink-0">{reactionEmojiNode(reaction.emoji, 32)}</div>
                                    <div className="min-w-0 text-sm leading-tight">
                                      <span className="text-muted-foreground">reacted by</span>{" "}
                                      {preview.map((reactorName, idx) => (
                                        <span key={`${reaction.emoji}-${reactorName}-${idx}`}>
                                          <span className="truncate">{reactorName}</span>
                                          {idx < preview.length - 1 ? ", " : ""}
                                        </span>
                                      ))}
                                      {remaining > 0 && <span className="text-muted-foreground"> and {remaining} others</span>}
                                    </div>
                                  </div>
                                );
                              })()}
                            </HoverCardContent>
                          </HoverCard>
                        ))}

                        {topEmojis.map((emoji) => {
                          if (eventReactions.some((reaction) => reaction.emoji === emoji)) return null;
                          return (
                            <button
                              key={`calendar-event-quick-${emoji}`}
                              type="button"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-secondary/40 transition-colors hover:bg-secondary"
                              onClick={() => void handleEventReaction(emoji)}
                              aria-label={`React with ${emoji}`}
                              title={`React with ${emoji}`}
                            >
                              <FluentEmoji emoji={emoji} size={18} />
                            </button>
                          );
                        })}

                        <EmojiPicker
                          open={eventReactionPickerOpen}
                          onOpenChange={setEventReactionPickerOpen}
                          onEmojiSelect={(emoji) => {
                            void handleEventReaction(emoji);
                            setEventReactionPickerOpen(false);
                          }}
                          serverId={currentServer?.id}
                          customEmojiFormat="inline_token"
                        >
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            aria-label="Add event reaction"
                            title="Add reaction"
                          >
                            <Smile className="h-3.5 w-3.5" />
                            Add reaction
                          </button>
                        </EmojiPicker>
                      </div>
                    </div>
                  </section>
                </main>

                <aside className="space-y-5">
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#f4f5f7]">
                      <Users className="h-4 w-4 text-[#aeb4bf]" />
                      <span>{detail.going_count} going</span>
                    </div>
                    <div className="space-y-2">
                      {attendeePreview.map((attendee) => {
                        const name = attendee.display_name || attendee.username;
                        return (
                          <div key={attendee.id} className="flex items-center gap-2 text-xs font-semibold text-[#d7dbe3]">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={attendee.avatar_url || undefined} />
                              <AvatarFallback style={{ backgroundColor: attendee.banner_color || "#5865f2" }}>
                                {name[0]?.toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{name}</span>
                          </div>
                        );
                      })}
                      {detail.going_count === 0 && <p className="text-xs text-[#aeb4bf]">No one is going yet</p>}
                    </div>
                  </div>
                </aside>

                <section className="lg:col-span-2">
                  <div className="mb-3 flex items-center gap-2 px-1 text-xs font-semibold text-[#d7dbe3]">
                    <MessageSquare className="h-4 w-4 text-[#aeb4bf]" />
                    <span>{eventComments.length} Comments</span>
                  </div>

                  <div className="rounded-[4px] bg-[#2f343d] px-3 py-3">
                    <div className="space-y-1">
                      {eventComments.map((comment) => {
                        const name = comment.user?.display_name || comment.user?.username || "Unknown";
                        return (
                          <div key={comment.id} className="group relative rounded-[3px] px-2 py-2 hover:bg-[#363c47]">
                            <div className="flex gap-3">
                              <Avatar className="mt-0.5 h-8 w-8">
                                <AvatarImage src={comment.user?.avatar_url || undefined} />
                                <AvatarFallback style={{ backgroundColor: comment.user?.banner_color || "#5865f2" }}>
                                  {name[0]?.toUpperCase() || "?"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-sm font-semibold text-[#f4f5f7]">{name}</span>
                                  <span className="text-[11px] text-[#aeb4bf]">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                                </div>
                                <div className="mt-0.5 text-sm text-[#d7dbe3] [&_img[data-cross-emoji]]:!h-5 [&_img[data-cross-emoji]]:!w-5 [&_img[data-cross-emoji-file-path]]:!h-5 [&_img[data-cross-emoji-file-path]]:!w-5">
                                  <MessageContent
                                    content={comment.content}
                                    currentUserId={user?.id}
                                    messageId={comment.id}
                                    messageUser={
                                      comment.user
                                        ? {
                                            id: comment.user.id,
                                            username: comment.user.username,
                                            display_name: comment.user.display_name,
                                          }
                                        : null
                                    }
                                    customEmojiMap={customEmojiMap}
                                    hideEmbeds
                                    hideLinksPreview
                                  />
                                </div>
                              </div>
                            </div>

                            {comment.user_id === user?.id && (
                              <div
                                className={cn(
                                  "absolute right-2 -top-3 z-20 hidden items-center gap-0.5 rounded-md border border-[hsl(var(--menu-border))] bg-[hsl(var(--menu))] p-0.5 text-[hsl(var(--menu-foreground))] shadow-xl shadow-black/30 transition-opacity duration-100 md:flex",
                                  "md:opacity-0 group-hover:md:opacity-100",
                                )}
                              >
                                <button
                                  type="button"
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent text-destructive transition-colors hover:bg-destructive/10"
                                  onClick={() => void handleDeleteEventComment(comment.id)}
                                  aria-label="Delete comment"
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="mt-3 flex items-end gap-2 px-1 pb-4">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatar_url || undefined} />
                      <AvatarFallback>{user?.username?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                    </Avatar>
                    <div className="flex min-w-0 flex-1 items-end gap-2 rounded-[4px] bg-[#2f343d] p-2">
                      <Textarea
                        value={eventReply}
                        onChange={(event) => setEventReply(event.target.value)}
                        placeholder="Post a reply"
                        className="min-h-9 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm text-[#f4f5f7] shadow-none placeholder:text-[#aeb4bf] focus-visible:ring-0"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handlePostEventComment();
                          }
                        }}
                      />
                      <EmojiPicker
                        onEmojiSelect={(emoji) => setEventReply((current) => `${current}${emoji}`)}
                        open={composerEmojiOpen}
                        onOpenChange={setComposerEmojiOpen}
                        serverId={currentServer?.id}
                        customEmojiFormat="inline_token"
                      >
                        <button type="button" className="rounded-md p-2 text-[#aeb4bf] hover:bg-[#3d4350] hover:text-white" aria-label="Add emoji">
                          <Smile className="h-4 w-4" />
                        </button>
                      </EmojiPicker>
                      <Button
                        size="icon-sm"
                        className="h-8 w-8 rounded-[3px]"
                        disabled={!eventReply.trim() || isPostingEventReply}
                        onClick={() => void handlePostEventComment()}
                        aria-label="Send comment"
                      >
                        {isPostingEventReply ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-layout-members">
      {showHeader && <ChannelHeader channel={currentChannel} showMessageActions={false} />}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#313640] text-[#f4f5f7]">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#262b33] px-4 py-3">
          {view === "month" ? (
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-[3px]" onClick={() => setVisibleMonth(subMonths(visibleMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="whitespace-nowrap text-lg font-semibold">{format(visibleMonth, "MMMM yyyy")}</h2>
              <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-[3px]" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <h2 className="text-lg font-semibold">Upcoming events</h2>
          )}

          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase text-[#a7adb8]">{serverTimezoneLabel}</span>
            <div className="flex items-center gap-1 rounded-[3px] border border-border/60 bg-secondary/20 p-1">
              <Button
                type="button"
                variant={view === "month" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 rounded-[3px] px-3 text-xs font-medium",
                  view === "month"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-black"
                    : "bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
                onClick={() => setView("month")}
              >
                Month
              </Button>
              <Button
                type="button"
                variant={view === "upcoming" ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-7 rounded-[3px] px-3 text-xs font-medium",
                  view === "upcoming"
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-black"
                    : "bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
                )}
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
                <div key={day} className="px-3 py-3 text-xs font-medium text-[#d7dbe3]">
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
                      "group relative min-h-[108px] cursor-pointer border-b border-r border-[#2b3039] bg-[#303540] p-2 transition-colors hover:bg-[#3a3f4b]",
                      isOutside && "bg-[#282c34] text-[#6f7580]",
                    )}
                    onClick={() => openCreate(dateKey)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.currentTarget !== event.target) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openCreate(dateKey);
                      }
                    }}
                    aria-label={`Create event on ${dateKey}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn("flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium", isToday && "bg-primary font-semibold text-primary-foreground")}>
                        {day.getDate()}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="h-6 w-6 rounded-[3px] opacity-0 hover:bg-[#4a505d] group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCreate(dateKey);
                        }}
                        aria-label={`Create event on ${dateKey}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2 space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className="truncate rounded-[2px] px-2 py-0.5 text-left text-[11px] font-medium text-white hover:brightness-110"
                          style={{ backgroundColor: event.color || DEFAULT_EVENT_COLOR }}
                          onClick={(clickEvent) => {
                            clickEvent.stopPropagation();
                            openEvent(event.id);
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(keyEvent) => {
                            if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                              keyEvent.preventDefault();
                              keyEvent.stopPropagation();
                              openEvent(event.id);
                            }
                          }}
                          aria-label={`Open event ${event.title}`}
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
                upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="grid cursor-pointer grid-cols-[160px_minmax(0,1fr)_220px] items-center gap-4 px-8 py-7 hover:bg-[#363c47]"
                    onClick={() => openEvent(event.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                        keyEvent.preventDefault();
                        openEvent(event.id);
                      }
                    }}
                    aria-label={`Open event ${event.title}`}
                  >
                    <div>
                      <p className="text-xs font-medium text-[#b8bec8]">{getUpcomingDateLabel(new Date(event.starts_at))}</p>
                      <div className="mt-3 flex items-center gap-2 text-xs text-[#f0f2f5]">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: event.color || DEFAULT_EVENT_COLOR }}
                        />
                        <span>{formatLocalTimeRange(event)}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{event.title}</p>
                      {(event.location || event.url) && (
                        <div className="mt-2 flex min-w-0 items-center gap-3 text-xs text-[#aeb4bf]">
                          {event.location && <span className="inline-flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3 w-3" />{event.location}</span>}
                          {event.url && <span className="inline-flex min-w-0 items-center gap-1 truncate"><Link2 className="h-3 w-3" />{event.url}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-3 text-xs">
                      {event.allow_rsvps && (
                        <>
                          <span className="text-[#d8dce4]">{event.rsvp_count} are going</span>
                          <Button
                            variant="outline"
                            className={cn(
                              "h-7 min-w-[72px] rounded-[3px] border-primary/70 bg-transparent px-2 text-[11px] font-medium text-foreground hover:bg-primary/10",
                              event.viewer_rsvp_status === "going" && "bg-primary text-primary-foreground hover:bg-primary/90",
                            )}
                            onClick={(clickEvent) => {
                              clickEvent.stopPropagation();
                              void handleRsvp(event);
                            }}
                          >
                            Going
                          </Button>
                        </>
                      )}
                      {!event.allow_rsvps && <span className="text-[#d8dce4]">RSVP not enabled</span>}
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
                <TabsTrigger value="basic" className="rounded-[3px] border-b-2 border-transparent bg-transparent px-2 text-sm font-medium text-[#b8bec8] hover:bg-[#3e444f] hover:text-[#f3f4f7] data-[state=active]:border-[#cbd0d8] data-[state=active]:bg-transparent data-[state=active]:text-[#f3f4f7] data-[state=active]:shadow-none">Basic Info</TabsTrigger>
                <TabsTrigger value="advanced" className="rounded-[3px] border-b-2 border-transparent bg-transparent px-2 text-sm font-medium text-[#b8bec8] hover:bg-[#3e444f] hover:text-[#f3f4f7] data-[state=active]:border-[#cbd0d8] data-[state=active]:bg-transparent data-[state=active]:text-[#f3f4f7] data-[state=active]:shadow-none">Advanced</TabsTrigger>
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
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#c4c8d0]">
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
                      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[#c4c8d0]">
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
                    <div className="text-xs font-medium uppercase tracking-wide text-[#c4c8d0]">Occurs</div>
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
                      Server timezone: <span className="font-medium text-[#d7dbe3]">{serverTimezoneLabel}</span>
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
                    variant="plain"
                  />
                  {allowRsvps && (
                    <>
                      <ToggleSetting
                        title="Limit attendance"
                        description="Limit the number of people that can attend this event."
                        checked={limitAttendance}
                        onCheckedChange={setLimitAttendance}
                        variant="plain"
                      />
                      {limitAttendance && (
                        <Input value={attendanceLimit} onChange={(e) => setAttendanceLimit(e.target.value.replace(/\D/g, ""))} className="h-9 w-28 rounded-[3px] border-[#4a4f5a] bg-[#2f343d]" placeholder="20" />
                      )}
                      <ToggleSetting
                        title="Restrict roles"
                        description="Specify the roles that can attend this event."
                        checked={restrictRoles}
                        onCheckedChange={(checked) => {
                          setRestrictRoles(checked);
                          if (!checked) setAllowedRoleIds([]);
                        }}
                        variant="plain"
                      />
                      {restrictRoles && (
                        <div>
                          {restrictableRoles.length > 0 ? (
                            <div className="max-h-44 overflow-y-auto">
                              {restrictableRoles.map((role) => {
                                const selected = allowedRoleIds.includes(role.id);
                                return (
                                  <button
                                    key={role.id}
                                    type="button"
                                    className={cn(
                                      "flex w-full items-center gap-3 rounded-[3px] px-2.5 py-2 text-left text-sm transition-colors hover:bg-[#444a56]",
                                      selected && "bg-[#444a56]",
                                    )}
                                    onClick={() => toggleAllowedRole(role.id)}
                                  >
                                    <Checkbox
                                      checked={selected}
                                      onCheckedChange={() => toggleAllowedRole(role.id)}
                                      onClick={(event) => event.stopPropagation()}
                                      className="border-[#6b7280] data-[state=checked]:border-primary"
                                      aria-label={`Allow ${role.name}`}
                                    />
                                    <span
                                      className="h-3.5 w-3.5 shrink-0 rounded-full border border-white/20"
                                      style={{ background: role.color || "#99a1ad" }}
                                    />
                                    <span className="min-w-0 flex-1 truncate font-medium">{role.name}</span>
                                    {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="px-3 py-2 text-sm text-[#aeb4bf]">No roles available</div>
                          )}
                        </div>
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
