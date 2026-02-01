import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { useAuthStore } from "@/stores/authStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { supabase } from "@/integrations/supabase/client";
import { handleError } from "@/lib/errorHandler";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

interface SimpleTaskListProps {
  tasks: Task[];
  channelId: string;
  onUpdate: () => void;
  onTaskClick?: (task: Task) => void;
}

export const SimpleTaskList = ({ tasks, channelId, onUpdate, onTaskClick }: SimpleTaskListProps) => {
  const { user } = useAuthStore();
  const { hasPermission } = useMemberPermissions(channelId);
  const canChangeStatus = hasPermission("change_task_status");

  const handleStatusToggle = async (task: Task) => {
    if (!user) return;

    // Check if user can change status (has permission or is assigned)
    const isAssigned = task.assignees?.some((a) => a.user_id === user.id) ?? false;
    if (!canChangeStatus && !isAssigned) return;

    // Toggle between open and completed
    const newStatus: TaskStatus = task.status === "completed" ? "open" : "completed";

    try {
      const { error } = await supabase.rpc("update_task", {
        _task_id: task.id,
        _user_id: user.id,
        _title: null,
        _description: null,
        _status: newStatus,
        _priority: null,
        _due_date: null,
      });

      if (error) throw error;
      onUpdate();
    } catch (error) {
      handleError(error, "Failed to update task status");
    }
  };

  // Check if user is assigned to task
  const isAssigned = (task: Task) => {
    return task.assignees?.some((a) => a.user_id === user?.id) ?? false;
  };

  // Filter tasks - separate active and completed
  const activeTasks = tasks.filter((t) => t.status !== "archived" && t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  return (
    <div className="p-4 space-y-1">
      {/* Active Tasks */}
      {activeTasks.map((task) => {
        const assigned = isAssigned(task);
        const canToggle = canChangeStatus || assigned;

        return (
          <div
            key={task.id}
            className={cn(
              "flex items-start gap-3 p-3 rounded-lg hover:bg-muted/80 transition-colors",
              task.status === "completed" && "opacity-60",
              onTaskClick && "cursor-pointer"
            )}
            onClick={(e) => {
              // Don't trigger click if clicking on checkbox
              if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
              onTaskClick?.(task);
            }}
          >
            <Checkbox
              checked={task.status === "completed"}
              onCheckedChange={() => canToggle && handleStatusToggle(task)}
              disabled={!canToggle}
              className="mt-0.5"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4
                  className={cn(
                    "font-medium text-sm",
                    task.status === "completed" && "line-through text-muted-foreground"
                  )}
                >
                  {task.title}
                </h4>
              </div>
              {task.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mb-1">
                  {task.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {task.assignees && task.assignees.length > 0 && (
                  <div className="flex items-center gap-1">
                    <div className="flex -space-x-2">
                      {task.assignees.slice(0, 3).map((assignee, index) => (
                        <Avatar 
                          key={assignee.id || assignee.user_id || `assignee-${task.id}-${index}`} 
                          className="w-5 h-5 border-2 border-background"
                        >
                          <AvatarImage src={assignee.user?.avatar_url} />
                          <AvatarFallback
                            style={{ backgroundColor: assignee.user?.banner_color || "#5865F2" }}
                            className="text-[8px]"
                          >
                            {assignee.user?.username?.[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {task.assignees.length > 3 && (
                      <span className="text-[10px]">+{task.assignees.length - 3}</span>
                    )}
                  </div>
                )}
                <span>{formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div className="mt-6 pt-4 border-t">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-1">
            {completedTasks.map((task) => {
              const assigned = isAssigned(task);
              const canToggle = canChangeStatus || assigned;

              return (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg hover:bg-muted/80 transition-colors opacity-60",
                    onTaskClick && "cursor-pointer"
                  )}
                  onClick={(e) => {
                    // Don't trigger click if clicking on checkbox
                    if ((e.target as HTMLElement).closest('[role="checkbox"]')) return;
                    onTaskClick?.(task);
                  }}
                >
                  <Checkbox
                    checked={true}
                    onCheckedChange={() => canToggle && handleStatusToggle(task)}
                    disabled={!canToggle}
                    className="mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm line-through text-muted-foreground">
                      {task.title}
                    </h4>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                        {task.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
