import { useState, useEffect } from "react";
import { ArrowLeft, Calendar, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TaskCommentSection } from "./TaskCommentSection";
import { useAuthStore } from "@/stores/authStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useUIStore } from "@/stores/uiStore";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

interface TaskDetailViewProps {
  task: Task;
  channelId: string;
  onClose: () => void;
  onUpdate: () => void;
}

const statusColors = {
  open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  in_progress: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
  archived: "bg-gray-500/10 text-gray-500 border-gray-500/20",
};

const priorityColors = {
  low: "bg-gray-500/10 text-gray-500",
  medium: "bg-yellow-500/10 text-yellow-500",
  high: "bg-red-500/10 text-red-500",
};

export const TaskDetailView = ({ task, channelId, onClose, onUpdate }: TaskDetailViewProps) => {
  const { user } = useAuthStore();
  const { hasPermission } = useMemberPermissions(channelId);
  const { openModal } = useUIStore();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold truncate">Task Details</h2>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Task Header */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-3">
                  <h1 className="text-2xl font-bold">{task.title}</h1>
                  <Badge
                    variant="outline"
                    className={cn("text-xs", statusColors[task.status])}
                  >
                    {task.status.replace("_", " ")}
                  </Badge>
                  {task.priority && (
                    <Badge variant="outline" className={cn("text-xs", priorityColors[task.priority])}>
                      {task.priority}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            {task.description && (
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="whitespace-pre-wrap text-foreground">{task.description}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {/* Due Date */}
              {task.due_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 mt-1 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Due Date</p>
                    <p className="text-sm font-medium">
                      {new Date(task.due_date).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                      {new Date(task.due_date) < new Date() && task.status !== "completed" && (
                        <span className="ml-2 text-red-500">(Overdue)</span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Assignees */}
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 mt-1 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-2">Assignees</p>
                  {task.assignees && task.assignees.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {task.assignees.map((assignee) => (
                        <div
                          key={assignee.id}
                          onClick={() => {
                            if (assignee.user_id) {
                              openModal("userProfile", { userId: assignee.user_id, user: assignee.user });
                            }
                          }}
                          className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
                        >
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={assignee.user?.avatar_url} />
                            <AvatarFallback
                              style={{ backgroundColor: assignee.user?.banner_color || "#5865F2" }}
                              className="text-xs"
                            >
                              {assignee.user?.username?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {assignee.user?.display_name || assignee.user?.username || "Unknown"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No assignees</p>
                  )}
                </div>
              </div>

              {/* Created By */}
              {task.creator && (
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground mb-1">Created by</p>
                    <div
                      onClick={() => {
                        if (task.created_by) {
                          openModal("userProfile", { userId: task.created_by, user: task.creator });
                        }
                      }}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={task.creator.avatar_url} />
                        <AvatarFallback
                          style={{ backgroundColor: task.creator.banner_color || "#5865F2" }}
                          className="text-xs"
                        >
                          {task.creator.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">
                        {task.creator.display_name || task.creator.username || "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 mt-1 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground mb-1">Last updated</p>
                  <p className="text-sm">
                    {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="pt-6">
            <TaskCommentSection taskId={task.id} channelId={channelId} />
          </div>
        </div>
      </div>
    </div>
  );
};
