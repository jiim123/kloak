import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  FileText,
  MoreHorizontal,
  Plus,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { useServerStore } from "@/stores/serverStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { getOrFetchUser, getUserFromCache } from "@/stores/userCacheStore";
import { cn } from "@/lib/utils";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { Task, TaskPriority, User } from "@/types";

type TaskFilter = "all" | "mine" | "open" | "completed";

interface InlineTaskFormState {
  title: string;
  description: string;
}

const EMPTY_INLINE_TASK_FORM: InlineTaskFormState = {
  title: "",
  description: "",
};

const FILTER_OPTIONS: Array<{ id: TaskFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "mine", label: "Assigned to me" },
  { id: "open", label: "Open" },
  { id: "completed", label: "Completed" },
];

const STATUS_LABELS: Record<string, string> = {
  open: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  archived: "Archived",
};

const TASK_TITLE_MAX_LENGTH = 200;
const TASK_DESCRIPTION_MAX_LENGTH = 4000;

const INLINE_COMPOSER_INPUT_CLASS =
  "h-10 w-full rounded-xl border border-border/60 bg-transparent px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/40";


const normalizeUser = (value: unknown): User | undefined => {
  if (!value || typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;

  return {
    id: String(record.id ?? ""),
    username: String(record.username ?? "unknown"),
    display_name: record.display_name ? String(record.display_name) : null,
    avatar_url: record.avatar_url ? String(record.avatar_url) : null,
    banner_url: null,
    avatar_decoration: null,
    profile_effect: null,
    banner_color: record.banner_color ? String(record.banner_color) : "#5865f2",
    profile_theme_primary: null,
    profile_theme_accent: null,
    bio: null,
    status: "offline",
    custom_status: null,
    created_at: new Date(0).toISOString(),
    last_seen: null,
  };
};

const normalizeTask = (value: unknown): Task => {
  const record = value as Record<string, unknown>;

  return {
    id: String(record.id),
    channel_id: String(record.channel_id),
    server_id: String(record.server_id),
    category_id: record.category_id ? String(record.category_id) : null,
    created_by: String(record.created_by),
    title: String(record.title ?? ""),
    description: record.description ? String(record.description) : null,
    priority: (record.priority ?? "medium") as TaskPriority,
    status: (record.status ?? "open") as Task["status"],
    due_date: record.due_date ? String(record.due_date) : null,
    position: Number(record.position ?? 0),
    completed_by: record.completed_by ? String(record.completed_by) : null,
    completed_at: record.completed_at ? String(record.completed_at) : null,
    created_at: String(record.created_at),
    updated_at: String(record.updated_at),
    creator: normalizeUser(record.creator),
    completer: record.completer ? normalizeUser(record.completer) : null,
    assignees: Array.isArray(record.assignees)
      ? record.assignees.map((assignee: unknown) => {
          const assigneeRecord = assignee as Record<string, unknown>;

          return {
            id: String(assigneeRecord.id),
            task_id: String(assigneeRecord.task_id),
            user_id: String(assigneeRecord.user_id),
            assigned_by: assigneeRecord.assigned_by ? String(assigneeRecord.assigned_by) : null,
            assigned_at: String(assigneeRecord.assigned_at),
            user: normalizeUser(assigneeRecord.user),
          };
        })
      : [],
  };
};

const toDateTimeLocalValue = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

const toIsoValue = (value: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const formatDueDate = (value: string | null) => {
  if (!value) return "No deadline";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No deadline";
  return format(date, "MMM d, yyyy p");
};

const formatRelativeTime = (value: string | null) => {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "less than a minute ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};


const dueDateTone = (value: string | null, status: Task["status"]) => {
  if (!value || status === "completed") return "text-muted-foreground";
  return new Date(value).getTime() < Date.now() ? "text-destructive" : "text-muted-foreground";
};

const memberLabel = (user?: User) => user?.display_name || user?.username || "Unknown user";

type RpcInvoker = (
  fn: string,
  params?: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message?: string } | null }>;

const runRpc: RpcInvoker = (fn, params) =>
  supabase.rpc(fn as never, params as never) as unknown as Promise<{ data: unknown; error: { message?: string } | null }>;

export const TasksChannelArea = () => {
  const currentChannel = useServerStore((s) => s.currentChannel);
  const members = useServerStore((s) => s.members);
  const user = useAuthStore((s) => s.user);
  const { canPerformInChannel } = useMemberPermissions(currentChannel?.id);

  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [inlineCreateOpen, setInlineCreateOpen] = useState(false);
  const [inlineDescriptionOpen, setInlineDescriptionOpen] = useState(false);
  const [inlineTaskForm, setInlineTaskForm] = useState<InlineTaskFormState>(EMPTY_INLINE_TASK_FORM);
  const [submittingInlineTask, setSubmittingInlineTask] = useState(false);
  const [notesTask, setNotesTask] = useState<Task | null>(null);
  const taskIdsRef = useRef<Set<string>>(new Set());
  const initialLoadKeyRef = useRef<string | null>(null);

  const channelId = currentChannel?.id;
  const userId = user?.id ?? null;
  const canViewTasks = !!channelId && canPerformInChannel("view_tasks", channelId);
  const canCreateTasks = !!channelId && canPerformInChannel("create_tasks", channelId);
  const canChangeTaskStatus = !!channelId && canPerformInChannel("change_task_status", channelId);
  const canDeleteTasks = !!channelId && canPerformInChannel("delete_tasks", channelId);

  const loadBoard = useCallback(async () => {
    if (!channelId || !userId) return [] as Task[];

    setLoading(true);
    try {
      const tasksResult = await runRpc("get_channel_tasks", { _channel_id: channelId, _user_id: userId });
      if (tasksResult.error) throw tasksResult.error;

      const loadedTasks = Array.isArray(tasksResult.data) ? tasksResult.data.map(normalizeTask) : [];
      setTasks(loadedTasks);
      return loadedTasks;
    } catch (error) {
      console.error("Failed to load tasks board:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load tasks");
      setTasks([]);
      return [] as Task[];
    } finally {
      setLoading(false);
    }
  }, [channelId, userId]);

  useEffect(() => {
    if (currentChannel?.type !== "tasks" || !channelId || !userId || !canViewTasks) {
      initialLoadKeyRef.current = null;
      setLoading(false);
      setTasks([]);
      return;
    }

    const loadKey = `${channelId}:${userId}`;
    if (initialLoadKeyRef.current === loadKey) return;
    initialLoadKeyRef.current = loadKey;
    void loadBoard();
  }, [currentChannel?.type, channelId, userId, canViewTasks, loadBoard]);

  useEffect(() => {
    const missingMemberIds = members
      .filter((member) => !member.is_banned && !member.user && !getUserFromCache(member.user_id))
      .map((member) => member.user_id);

    if (missingMemberIds.length === 0) return;

    missingMemberIds.forEach((memberId) => {
      void getOrFetchUser(memberId);
    });
  }, [members]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      switch (filter) {
        case "mine":
          return task.assignees.some((assignee) => assignee.user_id === user?.id);
        case "open":
          return task.status !== "completed";
        case "completed":
          return task.status === "completed";
        default:
          return true;
      }
    });
  }, [filter, tasks, user?.id]);

  const sortedTasks = useMemo(
    () => visibleTasks.slice().sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
    [visibleTasks],
  );

  useEffect(() => {
    taskIdsRef.current = new Set(tasks.map((task) => task.id));
  }, [tasks]);

  useEffect(() => {
    if (currentChannel?.type !== "tasks" || !channelId || !canViewTasks) return;

    let stopped = false;
    let refreshTimer = null;

    const scheduleRefresh = () => {
      if (refreshTimer) return;

      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        if (!stopped) {
          void loadBoard();
        }
      }, 120);
    };

    const channel = supabase
      .channel(`tasks-realtime:${channelId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        const record =
          payload.new && typeof payload.new === "object"
            ? payload.new
            : payload.old && typeof payload.old === "object"
              ? payload.old
              : null;

        const eventChannelId = record && typeof record.channel_id === "string" ? record.channel_id : null;
        if (!eventChannelId || eventChannelId === channelId) {
          scheduleRefresh();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "task_assignees" }, (payload) => {
        const record =
          payload.new && typeof payload.new === "object"
            ? payload.new
            : payload.old && typeof payload.old === "object"
              ? payload.old
              : null;

        const taskId = record && typeof record.task_id === "string" ? record.task_id : null;
        if (taskId && taskIdsRef.current.has(taskId)) {
          scheduleRefresh();
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          scheduleRefresh();
        }
      });

    return () => {
      stopped = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
  }, [currentChannel?.type, channelId, canViewTasks, loadBoard]);

  const resetInlineCreate = () => {
    setInlineCreateOpen(false);
    setInlineDescriptionOpen(false);
    setInlineTaskForm(EMPTY_INLINE_TASK_FORM);
    setSubmittingInlineTask(false);
  };

  const startInlineCreate = () => {
    setInlineCreateOpen(true);
    setInlineDescriptionOpen(false);
    setInlineTaskForm(EMPTY_INLINE_TASK_FORM);
  };

  const openNotesDialog = (task: Task) => {
    setNotesTask(task);
  };

  const handleInlineComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleInlineTaskCreate();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      resetInlineCreate();
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    if (!user || !canChangeTaskStatus) return;

    try {
      const { error } = await runRpc("update_task", {
        _task_id: task.id,
        _user_id: user.id,
        _status: task.status === "completed" ? "open" : "completed",
        _clear_category: !task.category_id,
        _category_id: task.category_id,
      });
      if (error) throw error;
      const loadedTasks = await loadBoard();
      if (notesTask?.id === task.id) {
        const refreshedTask = loadedTasks.find((entry) => entry.id === task.id);
        setNotesTask(refreshedTask ?? null);
      }
    } catch (error) {
      console.error("Failed to update task status:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update task status");
    }
  };

  const handleInlineTaskCreate = async () => {
    if (!channelId || !user) return;

    const trimmedTitle = inlineTaskForm.title.trim();
    const trimmedDescription = inlineTaskForm.description.trim();

    if (!trimmedTitle) {
      toast.error("Task title is required");
      return;
    }

    if (trimmedTitle.length > TASK_TITLE_MAX_LENGTH) {
      toast.error(`Task title must be ${TASK_TITLE_MAX_LENGTH} characters or fewer`);
      return;
    }

    if (trimmedDescription.length > TASK_DESCRIPTION_MAX_LENGTH) {
      toast.error(`Task description must be ${TASK_DESCRIPTION_MAX_LENGTH} characters or fewer`);
      return;
    }

    setSubmittingInlineTask(true);

    try {
      const { data, error } = await runRpc("create_task", {
        _channel_id: channelId,
        _user_id: user.id,
        _title: trimmedTitle,
        _description: trimmedDescription || null,
        _due_date: null,
        _assignee_ids: [],
        _category_id: null,
      });
      if (error) throw error;
      await loadBoard();
      resetInlineCreate();
    } catch (error) {
      console.error("Failed to create task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create task");
    } finally {
      setSubmittingInlineTask(false);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc("delete_task", {
        _task_id: task.id,
        _user_id: user.id,
      });

      if (error) throw error;
      if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
        throw new Error(String((data as Record<string, unknown>).error));
      }

      const loadedTasks = await loadBoard();
      if (notesTask?.id === task.id) {
        const refreshedTask = loadedTasks.find((entry) => entry.id === task.id);
        setNotesTask(refreshedTask ?? null);
      }
    } catch (error) {
      console.error("Failed to delete task:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete task");
    }
  };

  if (!currentChannel) return null;

  if (!canViewTasks) {
    return (
      <div className="h-full flex flex-col">
        <ChannelHeader channel={currentChannel} showMessageActions={false} />
        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md text-center space-y-3">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center">
              <ClipboardList className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium">You can open this channel, but not its tasks</h2>
            <p className="text-sm text-muted-foreground">
              Ask a server admin to grant `view_tasks` for this channel if you should be able to see the board.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent">
      <ChannelHeader
        channel={currentChannel}
        showMessageActions={false}
        extraActions={
          canCreateTasks ? (
            <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={startInlineCreate}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Task
            </Button>
          ) : null
        }
      />

      <div className="px-4 py-3 border-b border-border/60 bg-background/40 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs transition-colors border",
                filter === option.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          <div className="p-4">
            {loading ? (
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-12 border-b border-border/60 bg-secondary/20 last:border-b-0 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card/70">
                {sortedTasks.map((task) => (
                  <div key={task.id} className="group flex items-center gap-3 border-b border-border/60 px-4 py-3 last:border-b-0">
                    <button
                      type="button"
                      className="shrink-0"
                      disabled={!canChangeTaskStatus}
                      onClick={() => void toggleTaskStatus(task)}
                    >
                      {task.status === "completed" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn("truncate text-sm font-medium", task.status === "completed" && "line-through text-muted-foreground")}>
                          {task.title}
                        </span>
                        {task.due_date && (
                          <span className={cn("hidden text-xs md:inline", dueDateTone(task.due_date, task.status))}>
                            {formatDueDate(task.due_date)}
                          </span>
                        )}
                      </div>
                      {task.status === "completed" && task.completer && (
                        <p className="mt-1 text-xs text-muted-foreground">Completed by {memberLabel(task.completer)}</p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {task.description && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                          title="Open note"
                          onClick={() => openNotesDialog(task)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Note</span>
                        </button>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <UserPlus className="h-3.5 w-3.5" />
                        {task.assignees.length}
                      </span>
                      {canDeleteTasks && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-60 transition-opacity group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => void handleDeleteTask(task)}>
                              Delete task
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}

                {inlineCreateOpen ? (
                  <div className="border-t border-border/60 bg-secondary/10 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <Plus className="mt-2 h-4 w-4 shrink-0 text-amber-400" />
                      <div className="min-w-0 flex-1 space-y-3">
                        <Input
                          value={inlineTaskForm.title}
                          onChange={(event) => setInlineTaskForm((current) => ({ ...current, title: event.target.value }))}
                          onKeyDown={handleInlineComposerKeyDown}
                          placeholder="Add an item..."
                          className={INLINE_COMPOSER_INPUT_CLASS}
                          maxLength={TASK_TITLE_MAX_LENGTH}
                          autoFocus
                          disabled={submittingInlineTask}
                        />

                        {inlineDescriptionOpen ? (
                          <Textarea
                            value={inlineTaskForm.description}
                            onChange={(event) => setInlineTaskForm((current) => ({ ...current, description: event.target.value }))}
                            placeholder="Add a note..."
                            className="min-h-[96px] resize-none rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm shadow-sm focus-visible:border-primary/50 focus-visible:ring-1 focus-visible:ring-primary/40"
                            maxLength={TASK_DESCRIPTION_MAX_LENGTH}
                            disabled={submittingInlineTask}
                          />
                        ) : (
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
                            onClick={() => setInlineDescriptionOpen(true)}
                            disabled={submittingInlineTask}
                          >
                            <FileText className="h-4 w-4" />
                            Add note
                          </button>
                        )}

                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => void handleInlineTaskCreate()} disabled={submittingInlineTask || !inlineTaskForm.title.trim()}>
                            Add task
                          </Button>
                          <Button size="sm" variant="ghost" onClick={resetInlineCreate} disabled={submittingInlineTask}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : canCreateTasks ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/20 hover:text-foreground"
                    onClick={startInlineCreate}
                  >
                    <Plus className="h-4 w-4 text-amber-400" />
                    <span>Add an item...</span>
                  </button>
                ) : null}

                {!canCreateTasks && sortedTasks.length === 0 && (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No tasks here yet.</div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={!!notesTask} onOpenChange={(open) => (!open ? setNotesTask(null) : undefined)}>
        <DialogContent className="sm:max-w-3xl overflow-hidden border-border/70 bg-card/95 p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle>Notes</DialogTitle>
            <DialogDescription className="sr-only">Task description and note details</DialogDescription>
          </DialogHeader>

          {notesTask && (
            <div className="space-y-4 p-4">
              <div className="rounded-xl border border-border/60 bg-secondary/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="shrink-0"
                    disabled={!canChangeTaskStatus}
                    onClick={() => void toggleTaskStatus(notesTask)}
                  >
                    {notesTask.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", notesTask.status === "completed" && "line-through text-muted-foreground")}>
                      {notesTask.title}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 border-b border-border/60 px-1 pb-3 text-sm text-muted-foreground">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={notesTask.creator?.avatar_url ?? undefined} />
                  <AvatarFallback style={{ backgroundColor: notesTask.creator?.banner_color ?? "#5865f2" }}>
                    {memberLabel(notesTask.creator).slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{memberLabel(notesTask.creator)}</p>
                  <p className="truncate text-xs text-muted-foreground">{formatRelativeTime(notesTask.updated_at || notesTask.created_at)}</p>
                </div>
                <Badge variant="secondary" className="rounded-full text-xs">Note</Badge>
              </div>

              <div className="rounded-xl border border-border/60 bg-background/40 px-4 py-4">
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">
                  {notesTask.description?.trim() || "No note added yet."}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
















