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
const TASK_INDENT_PX = 20;
const TASK_ASSIGNEE_MAX = 3;

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
    parent_task_id: record.parent_task_id ? String(record.parent_task_id) : null,
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

interface FlattenedTask {
  task: Task;
  depth: number;
}

const byPositionThenCreated = (a: Task, b: Task) => a.position - b.position || a.created_at.localeCompare(b.created_at);

const buildTaskTree = (items: Task[]) => {
  const taskById = new Map(items.map((task) => [task.id, task]));
  const childrenByParentId = new Map<string | null, Task[]>();

  const pushChild = (parentId: string | null, task: Task) => {
    const list = childrenByParentId.get(parentId);
    if (list) {
      list.push(task);
      return;
    }
    childrenByParentId.set(parentId, [task]);
  };

  items.forEach((task) => {
    const parentId = task.parent_task_id ?? null;
    if (!parentId || !taskById.has(parentId) || parentId === task.id) {
      pushChild(null, task);
      return;
    }
    pushChild(parentId, task);
  });

  const flatten = (parentId: string | null, depth: number, out: FlattenedTask[]) => {
    const children = (childrenByParentId.get(parentId) ?? []).slice().sort(byPositionThenCreated);
    children.forEach((child) => {
      out.push({ task: child, depth });
      flatten(child.id, depth + 1, out);
    });
  };

  const flattened: FlattenedTask[] = [];
  flatten(null, 0, flattened);
  return flattened;
};
interface TaskRowProps {
  task: Task;
  depth: number;
  canCreateTasks: boolean;
  canAssignTasks: boolean;
  canToggleTaskStatus: boolean;
  canDeleteTasks: boolean;
  onToggleStatus: (task: Task) => void;
  onOpenNotes: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onAddSubTask: (task: Task) => void;
  onAssignTask: (task: Task) => void;
}

const TaskRow = ({
  task,
  depth,
  canCreateTasks,
  canAssignTasks,
  canToggleTaskStatus,
  canDeleteTasks,
  onToggleStatus,
  onOpenNotes,
  onDeleteTask,
  onAddSubTask,
  onAssignTask,
}: TaskRowProps) => {
  const visibleAssignees = task.assignees.slice(0, 3);
  const overflowAssigneeCount = Math.max(0, task.assignees.length - visibleAssignees.length);

  return (
    <div
      className="group flex items-center gap-3 border-b border-border/60 px-4 py-3 transition-colors"
      style={{ marginLeft: depth * TASK_INDENT_PX }}
    >
      <button type="button" className="shrink-0" disabled={!canToggleTaskStatus} onClick={() => onToggleStatus(task)}>
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
            <span className={cn("hidden text-xs md:inline", dueDateTone(task.due_date, task.status))}>{formatDueDate(task.due_date)}</span>
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
            onClick={() => onOpenNotes(task)}
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Note</span>
          </button>
        )}
        <span className="inline-flex items-center gap-1">
          <UserPlus className="h-3.5 w-3.5" />
          {task.assignees.length}
        </span>
        {visibleAssignees.length > 0 ? (
          <div className="flex items-center -space-x-2">
            {visibleAssignees.map((assignee) => (
              <Avatar key={assignee.id} className="h-5 w-5 border border-background" title={memberLabel(assignee.user)}>
                <AvatarImage src={assignee.user?.avatar_url ?? undefined} />
                <AvatarFallback
                  className="text-[10px]"
                  style={{ backgroundColor: assignee.user?.banner_color ?? "#5865f2" }}
                >
                  {memberLabel(assignee.user).slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflowAssigneeCount > 0 ? (
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-background bg-secondary text-[10px] font-medium text-muted-foreground">
                +{overflowAssigneeCount}
              </span>
            ) : null}
          </div>
        ) : null}
        {(canDeleteTasks || canCreateTasks || canAssignTasks) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-60 transition-opacity group-hover:opacity-100">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {canCreateTasks && (
                <DropdownMenuItem onClick={() => onAddSubTask(task)}>
                  Add sub-task
                </DropdownMenuItem>
              )}
              {canAssignTasks && (
                <DropdownMenuItem onClick={() => onAssignTask(task)}>
                  Assign task
                </DropdownMenuItem>
              )}
              {canDeleteTasks && (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDeleteTask(task)}>
                  Delete task
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

interface TasksChannelAreaProps {
  showHeader?: boolean;
}

export const TasksChannelArea = ({ showHeader = true }: TasksChannelAreaProps) => {
  const currentChannel = useServerStore((s) => s.currentChannel);
  const currentServer = useServerStore((s) => s.currentServer);
  const members = useServerStore((s) => s.members);
  const membersServerId = useServerStore((s) => s.membersServerId);
  const membersFetchMode = useServerStore((s) => s.membersFetchMode);
  const fetchMembers = useServerStore((s) => s.fetchMembers);
  const channelMembers = useServerStore((s) => s.channelMembers);
  const fetchChannelMembers = useServerStore((s) => s.fetchChannelMembers);
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
  const [inlineParentTaskId, setInlineParentTaskId] = useState<string | null>(null);
  const [assignTask, setAssignTask] = useState<Task | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [savingAssignees, setSavingAssignees] = useState(false);
  const taskIdsRef = useRef<Set<string>>(new Set());
  const initialLoadKeyRef = useRef<string | null>(null);

  const channelId = currentChannel?.id;
  const userId = user?.id ?? null;
  const canViewTasks = !!channelId && canPerformInChannel("view_tasks", channelId);
  const canCreateTasks = !!channelId && canPerformInChannel("create_tasks", channelId);
  const canAssignTasks = !!channelId && canPerformInChannel("assign_tasks", channelId);
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

  useEffect(() => {
    if (!assignTask) return;

    const serverId = currentServer?.id ?? currentChannel?.server_id ?? null;
    if (!serverId) return;

    const hasFullRoster = membersServerId === serverId && membersFetchMode === "full";
    if (hasFullRoster) return;

    void fetchMembers(serverId, { force: true, full: true });
  }, [assignTask, currentServer?.id, currentChannel?.server_id, membersServerId, membersFetchMode, fetchMembers]);

  useEffect(() => {
    if (!assignTask || !currentChannel?.id || !currentChannel.is_private) return;

    const hasLoadedChannelMembers = channelMembers.some((entry) => entry.channelId === currentChannel.id);
    if (hasLoadedChannelMembers) return;

    void fetchChannelMembers(currentChannel.id);
  }, [assignTask, currentChannel?.id, currentChannel?.is_private, channelMembers, fetchChannelMembers]);

  const currentChannelMemberUserIds = useMemo(() => {
    if (!currentChannel?.id || !currentChannel.is_private) return null;

    const entry = channelMembers.find((item) => item.channelId === currentChannel.id);
    if (!entry) return null;

    return new Set(entry.members.map((member) => member.user_id));
  }, [channelMembers, currentChannel?.id, currentChannel?.is_private]);

  const isPrivateChannelMemberAccessLoading =
    !!assignTask && !!currentChannel?.is_private && currentChannelMemberUserIds === null;

  const taskMatchesFilter = useCallback(
    (task: Task) => {
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
    },
    [filter, user?.id],
  );

  const flattenedTasks = useMemo(() => buildTaskTree(tasks), [tasks]);
  const visibleFlattenedTasks = useMemo(
    () => flattenedTasks.filter((entry) => taskMatchesFilter(entry.task)),
    [flattenedTasks, taskMatchesFilter],
  );
  const inlineParentTask = useMemo(
    () => (inlineParentTaskId ? tasks.find((task) => task.id === inlineParentTaskId) ?? null : null),
    [inlineParentTaskId, tasks],
  );

  const assignableUsers = useMemo(() => {
    if (currentChannel?.is_private && currentChannelMemberUserIds === null) {
      return [] as User[];
    }

    const byId = new Map<string, User>();

    members.forEach((member) => {
      if (member.is_banned) return;
      if (currentChannelMemberUserIds && !currentChannelMemberUserIds.has(member.user_id)) return;

      const resolvedUser = member.user ?? getUserFromCache(member.user_id);
      if (!resolvedUser) return;
      if (!byId.has(resolvedUser.id)) {
        byId.set(resolvedUser.id, resolvedUser);
      }
    });

    return Array.from(byId.values()).sort((a, b) => memberLabel(a).localeCompare(memberLabel(b)));
  }, [members, currentChannel?.is_private, currentChannelMemberUserIds]);

  const selectedAssigneeUsers = useMemo(() => {
    const byId = new Map<string, User>();

    assignTask?.assignees.forEach((assignee) => {
      if (assignee.user) {
        byId.set(assignee.user_id, assignee.user);
      }
    });

    assignableUsers.forEach((entry) => {
      byId.set(entry.id, entry);
    });

    return selectedAssigneeIds
      .map((id) => byId.get(id))
      .filter((entry): entry is User => !!entry);
  }, [assignTask?.assignees, assignableUsers, selectedAssigneeIds]);

  const filteredAssignableUsers = useMemo(() => {
    const needle = assigneeSearch.trim().toLowerCase();
    if (!needle) return [] as User[];

    return assignableUsers.filter((entry) => {
      const label = memberLabel(entry).toLowerCase();
      const username = entry.username.toLowerCase();
      return label.includes(needle) || username.includes(needle);
    });
  }, [assignableUsers, assigneeSearch]);

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

        const eventChannelId = record && typeof (record as Record<string, unknown>).channel_id === "string" ? (record as Record<string, unknown>).channel_id as string : null;
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

        const taskId = record && typeof (record as Record<string, unknown>).task_id === "string" ? (record as Record<string, unknown>).task_id as string : null;
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
    setInlineParentTaskId(null);
    setSubmittingInlineTask(false);
  };

  const startInlineCreate = (parentTaskId: string | null = null) => {
    setInlineCreateOpen(true);
    setInlineDescriptionOpen(false);
    setInlineTaskForm(EMPTY_INLINE_TASK_FORM);
    setInlineParentTaskId(parentTaskId);
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

  const canToggleTaskStatus = useCallback(
    (task: Task) => {
      if (!userId) return false;
      if (canChangeTaskStatus) return true;

      const isAssignedToCurrentUser = task.assignees.some((assignee) => assignee.user_id === userId);
      return isAssignedToCurrentUser && task.status !== "completed";
    },
    [canChangeTaskStatus, userId],
  );

  const toggleTaskStatus = async (task: Task) => {
    if (!user || !canToggleTaskStatus(task)) return;

    try {
      const { error } = await runRpc("update_task", {
        _task_id: task.id,
        _user_id: user.id,
        _status: task.status === "completed" ? "open" : "completed",
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

    const parentTask = inlineParentTaskId ? tasks.find((task) => task.id === inlineParentTaskId) ?? null : null;
    if (inlineParentTaskId && !parentTask) {
      toast.error("Parent task not found");
      return;
    }

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
        _category_id: parentTask?.category_id ?? null,
        _parent_task_id: parentTask?.id ?? null,
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

  const handleAddSubTask = useCallback(
    (task: Task) => {
      if (!canCreateTasks) return;
      startInlineCreate(task.id);
    },
    [canCreateTasks],
  );

  const handleAssignTask = useCallback(
    (task: Task) => {
      if (!canAssignTasks) return;
      setAssignTask(task);
      setAssigneeSearch("");
      setSelectedAssigneeIds(task.assignees.map((assignee) => assignee.user_id));
    },
    [canAssignTasks],
  );

  const toggleAssigneeSelection = (targetUserId: string) => {
    setSelectedAssigneeIds((current) => {
      if (current.includes(targetUserId)) {
        return current.filter((id) => id !== targetUserId);
      }

      if (current.length >= TASK_ASSIGNEE_MAX) {
        toast.error(`You can assign up to ${TASK_ASSIGNEE_MAX} people to a task.`);
        return current;
      }

      return [...current, targetUserId];
    });
  };

  const closeAssignDialog = () => {
    if (savingAssignees) return;
    setAssignTask(null);
    setAssigneeSearch("");
    setSelectedAssigneeIds([]);
  };

  const saveTaskAssignments = async () => {
    if (!assignTask || !user) return;
    if (isPrivateChannelMemberAccessLoading) {
      toast.error("Still loading channel member access. Please wait a moment.");
      return;
    }

    const existingIds = new Set(assignTask.assignees.map((assignee) => assignee.user_id));
    const targetIds = new Set(selectedAssigneeIds);
    const toAssign = selectedAssigneeIds.filter((id) => !existingIds.has(id));
    const toUnassign = Array.from(existingIds).filter((id) => !targetIds.has(id));

    setSavingAssignees(true);

    try {
      const failedAssignments: string[] = [];

      for (const assigneeId of toAssign) {
        const candidateUser =
          assignableUsers.find((entry) => entry.id === assigneeId) ??
          selectedAssigneeUsers.find((entry) => entry.id === assigneeId);

        try {
          const { data, error } = await runRpc("assign_task_users", {
            _task_id: assignTask.id,
            _user_id: user.id,
            _assignee_ids: [assigneeId],
          });

          if (error) throw error;
          if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
            throw new Error(String((data as Record<string, unknown>).error));
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : "Failed to assign user";
          if (message.includes("Cannot assign tasks to users without channel access")) {
            failedAssignments.push(candidateUser ? memberLabel(candidateUser) : "Unknown user");
            continue;
          }
          throw error;
        }
      }

      if (toUnassign.length > 0) {
        const { data, error } = await runRpc("unassign_task_users", {
          _task_id: assignTask.id,
          _user_id: user.id,
          _assignee_ids: toUnassign,
        });

        if (error) throw error;
        if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
          throw new Error(String((data as Record<string, unknown>).error));
        }
      }

      await loadBoard();

      if (failedAssignments.length > 0) {
        toast.warning("Skipped users without channel access: " + failedAssignments.join(", "));
      } else {
        toast.success("Task assignees updated");
      }

      closeAssignDialog();
    } catch (error) {
      console.error("Failed to update task assignees:", error);
      const message = error instanceof Error ? error.message : "Failed to update assignees";
      if (message.includes("Cannot assign tasks to users without channel access")) {
        toast.error("One or more selected members cannot access this channel. Remove them and try again.");
      } else {
        toast.error(message);
      }
    } finally {
      setSavingAssignees(false);
    }
  };

  const renderInlineComposer = (depth = 0) => (
    <div
      className={cn("border-t border-border/60 bg-secondary/10 px-4 py-3", depth > 0 && "bg-secondary/15")}
      style={depth > 0 ? { marginLeft: depth * TASK_INDENT_PX } : undefined}
    >
      <div className="flex items-start gap-3">
        <Plus className="mt-2 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1 space-y-3">
          {inlineParentTask ? (
            <p className="text-xs font-medium text-primary">Adding sub-task under: {inlineParentTask.title}</p>
          ) : null}
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
              {inlineParentTask ? "Add sub-task" : "Add task"}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetInlineCreate} disabled={submittingInlineTask}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!currentChannel) return null;

  if (!canViewTasks) {
    return (
      <div className="h-full flex flex-col">
        {showHeader && <ChannelHeader channel={currentChannel} showMessageActions={false} />}
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
      {showHeader && (
        <ChannelHeader
          channel={currentChannel}
          showMessageActions={false}
          extraActions={
            canCreateTasks ? (
              <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => startInlineCreate(null)}>
                <Plus className="mr-1.5 h-4 w-4" />
                New Task
              </Button>
            ) : null
          }
        />
      )}

      <div className="px-4 py-3 border-b border-border/60 bg-background/40 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
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
          {!showHeader && canCreateTasks && (
            <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => startInlineCreate(null)}>
              <Plus className="mr-1.5 h-4 w-4" />
              New Task
            </Button>
          )}
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
                {visibleFlattenedTasks.length > 0
                  ? visibleFlattenedTasks.map((entry) => (
                      <div key={entry.task.id}>
                        <TaskRow
                          task={entry.task}
                          depth={entry.depth}
                          canCreateTasks={canCreateTasks}
                          canAssignTasks={canAssignTasks}
                          canToggleTaskStatus={canToggleTaskStatus(entry.task)}
                          canDeleteTasks={canDeleteTasks}
                          onToggleStatus={(task) => void toggleTaskStatus(task)}
                          onOpenNotes={openNotesDialog}
                          onDeleteTask={(task) => void handleDeleteTask(task)}
                          onAddSubTask={handleAddSubTask}
                          onAssignTask={handleAssignTask}
                        />
                        {inlineCreateOpen && inlineParentTaskId === entry.task.id ? renderInlineComposer(entry.depth + 1) : null}
                      </div>
                    ))
                  : null}

                {inlineCreateOpen && !inlineParentTaskId ? (
                  renderInlineComposer(0)
                ) : canCreateTasks ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary/20 hover:text-foreground"
                    onClick={() => startInlineCreate(null)}
                  >
                    <Plus className="h-4 w-4 text-amber-400" />
                    <span>Add an item...</span>
                  </button>
                ) : null}

                {!canCreateTasks && visibleFlattenedTasks.length === 0 && (
                  <div className="px-4 py-6 text-sm text-muted-foreground">No tasks here yet.</div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={!!assignTask} onOpenChange={(open) => (!open ? closeAssignDialog() : undefined)}>
        <DialogContent className="sm:max-w-lg overflow-hidden border-border/70 bg-card/95 p-0">
          <DialogHeader className="border-b border-border/60 px-5 py-4">
            <DialogTitle>Assign task</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Pick one to three members for {assignTask ? `"${assignTask.title}"` : "this task"}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Currently assigned</p>
              <div className="h-40 overflow-hidden rounded-xl border border-border/60 bg-background/40">
                <ScrollArea className="h-full">
                  <div className="divide-y divide-border/50">
                    {selectedAssigneeUsers.length > 0 ? (
                      selectedAssigneeUsers.map((entry) => (
                        <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={entry.avatar_url ?? undefined} />
                            <AvatarFallback style={{ backgroundColor: entry.banner_color ?? "#5865f2" }}>
                              {memberLabel(entry).slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{memberLabel(entry)}</p>
                            <p className="truncate text-xs text-muted-foreground">@{entry.username}</p>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => toggleAssigneeSelection(entry.id)}
                            disabled={savingAssignees}
                          >
                            Unassign
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="px-3 py-3 text-xs text-muted-foreground">No assignees yet.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
              <p className="text-xs text-muted-foreground">Selected {selectedAssigneeIds.length}/{TASK_ASSIGNEE_MAX}</p>
            </div>

            <div className="space-y-2">
              <Input
                value={assigneeSearch}
                onChange={(event) => setAssigneeSearch(event.target.value)}
                placeholder="Search members to assign..."
                className="h-10 rounded-xl border-border/60"
                disabled={savingAssignees}
                autoFocus
              />
              <div className="max-h-64 overflow-hidden rounded-xl border border-border/60 bg-background/40">
                <ScrollArea className="max-h-64">
                  <div className="divide-y divide-border/50">
                    {isPrivateChannelMemberAccessLoading ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">Loading channel access list...</p>
                    ) : assigneeSearch.trim().length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground">Type a name to search members.</p>
                    ) : filteredAssignableUsers.length > 0 ? (
                      filteredAssignableUsers.map((entry) => {
                        const selected = selectedAssigneeIds.includes(entry.id);

                        return (
                          <button
                            key={entry.id}
                            type="button"
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                              selected ? "bg-primary/10" : "hover:bg-secondary/25",
                            )}
                            onClick={() => toggleAssigneeSelection(entry.id)}
                            disabled={savingAssignees}
                          >
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={entry.avatar_url ?? undefined} />
                              <AvatarFallback style={{ backgroundColor: entry.banner_color ?? "#5865f2" }}>
                                {memberLabel(entry).slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{memberLabel(entry)}</p>
                              <p className="truncate text-xs text-muted-foreground">@{entry.username}</p>
                            </div>
                            {selected ? <Check className="h-4 w-4 text-primary" /> : null}
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-3 py-3 text-xs text-muted-foreground">No matching members.</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={closeAssignDialog} disabled={savingAssignees}>
                Cancel
              </Button>
              <Button
                onClick={() => void saveTaskAssignments()}
                disabled={savingAssignees || isPrivateChannelMemberAccessLoading || selectedAssigneeIds.length > TASK_ASSIGNEE_MAX}
              >
                {savingAssignees ? "Saving..." : "Save assignees"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                    disabled={!canToggleTaskStatus(notesTask)}
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



















































