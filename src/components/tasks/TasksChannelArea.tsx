import { useState, useEffect, useCallback } from "react";
import { ChannelHeader } from "@/components/chat/ChannelHeader";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useUIStore } from "@/stores/uiStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useSwipeGestureRef } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRealtimeTasks } from "@/hooks/useRealtimeTasks";
import { Plus, CheckSquare, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SimpleTaskList } from "./SimpleTaskList";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailView } from "./TaskDetailView";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/errorHandler";
import type { Task, TaskStatus } from "@/types";

export const TasksChannelArea = () => {
  const { currentChannel, currentServer, members } = useServerStore();
  const { user } = useAuthStore();
  const { setMobileSidebarOpen, setMemberSidebarOpen, openModal } = useUIStore();
  const isMobile = useIsMobile();
  const { hasPermission } = useMemberPermissions(currentChannel?.id);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const swipeRef = useSwipeGestureRef({
    onSwipeRight: () => setMobileSidebarOpen(true),
    onSwipeLeft: () => setMemberSidebarOpen(true),
    threshold: 50,
    enabled: isMobile,
  });

  const canViewTasks = hasPermission("view_tasks");
  const canCreateTasks = hasPermission("create_tasks");

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!currentChannel?.id || !user?.id || !canViewTasks) return;

    try {
      const { data, error } = await supabase.rpc("get_channel_tasks", {
        _channel_id: currentChannel.id,
        _user_id: user.id,
        _status_filter: null,
        _assignee_filter: null,
        _sort_by: "updated_at",
        _sort_order: "desc",
      });

      if (error) throw error;

      // Fetch user data for assignees and creators
      const taskData = (data || []) as any[];
      const userIds = new Set<string>();
      
      taskData.forEach((task) => {
        userIds.add(task.created_by);
        if (task.assignees) {
          task.assignees.forEach((a: any) => userIds.add(a.user_id));
        }
      });

      if (userIds.size > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("id, username, display_name, avatar_url, banner_color")
          .in("id", Array.from(userIds));

        const userMap = new Map((users || []).map((u) => [u.id, u]));

        const tasksWithUsers: Task[] = taskData.map((task) => ({
          ...task,
          creator: userMap.get(task.created_by),
          assignees: (task.assignees || []).map((a: any) => ({
            ...a,
            user: userMap.get(a.user_id),
          })),
        }));

        setTasks(tasksWithUsers);
      } else {
        setTasks(taskData);
      }
    } catch (error) {
      handleError(error, "Failed to fetch tasks");
    } finally {
      setIsLoading(false);
    }
  }, [currentChannel?.id, user?.id, canViewTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Realtime updates
  useRealtimeTasks({
    channelId: currentChannel?.id || null,
    onTaskChange: (task) => {
      setTasks((prev) => {
        const index = prev.findIndex((t) => t.id === task.id);
        if (index >= 0) {
          return prev.map((t) => (t.id === task.id ? task : t));
        } else {
          return [task, ...prev];
        }
      });
      // Update selected task if it's the one that changed
      if (selectedTask?.id === task.id) {
        setSelectedTask(task);
      }
    },
    onTaskDelete: (taskId) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      // Close detail view if deleted task was selected
      if (selectedTask?.id === taskId) {
        setSelectedTask(null);
      }
    },
    onAssigneeChange: (taskId, assignees) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, assignees: assignees as any } : t
        )
      );
      // Update selected task if it's the one that changed
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) => prev ? { ...prev, assignees: assignees as any } : null);
      }
    },
  });

  // Filter tasks by search query
  const filteredTasks = tasks.filter((task) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      task.title.toLowerCase().includes(query) ||
      (task.description && task.description.toLowerCase().includes(query))
    );
  });

  if (!currentChannel) {
    return null;
  }

  if (!canViewTasks) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4 bg-background">
        <CheckSquare className="w-16 h-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">No Access</h2>
        <p className="text-muted-foreground">
          You don't have permission to view tasks in this channel.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={swipeRef}
      className="h-full flex flex-col min-w-0 bg-background"
    >
      {!selectedTask && <ChannelHeader channel={currentChannel} />}

      {/* Toolbar */}
      {!selectedTask && (
        <div className="flex-shrink-0 border-b border-border/50 px-4 py-3">
          <div className="flex items-center gap-2">
            {canCreateTasks && (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                size="sm"
                className="flex-shrink-0"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Task
              </Button>
            )}

            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      )}

      {/* Task List or Detail View */}
      <div className="flex-1 overflow-y-auto">
        {selectedTask ? (
          <TaskDetailView
            task={selectedTask}
            channelId={currentChannel.id}
            onClose={() => setSelectedTask(null)}
            onUpdate={fetchTasks}
          />
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading tasks...</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <CheckSquare className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tasks found</h3>
            <p className="text-muted-foreground mb-4">
              {canCreateTasks
                ? "Create your first task to get started"
                : "No tasks match your filters"}
            </p>
            {canCreateTasks && (
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            )}
          </div>
        ) : (
          <SimpleTaskList
            tasks={filteredTasks}
            channelId={currentChannel.id}
            onUpdate={fetchTasks}
            onTaskClick={setSelectedTask}
          />
        )}
      </div>

      {/* Create Task Modal */}
      <CreateTaskModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchTasks}
      />
    </div>
  );
};
