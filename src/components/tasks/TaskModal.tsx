import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, Calendar, Users, Save, Trash2, Loader2 } from "lucide-react";
import { useServerStore } from "@/stores/serverStore";
import { useAuthStore } from "@/stores/authStore";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { TaskCommentSection } from "./TaskCommentSection";
import { supabase } from "@/integrations/supabase/client";
import { handleError, showSuccess } from "@/lib/errorHandler";
import { parseTextContent } from "@/components/chat/MessageContent";
import type { Task, TaskStatus, TaskPriority, User } from "@/types";
import { formatDistanceToNow } from "date-fns";

interface TaskModalProps {
  task: Task | null;
  channelId: string;
  onClose: () => void;
  onSave: () => void;
}

export const TaskModal = ({ task, channelId, onClose, onSave }: TaskModalProps) => {
  const { user } = useAuthStore();
  const { members } = useServerStore();
  const { hasPermission } = useMemberPermissions(channelId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("open");
  const [priority, setPriority] = useState<TaskPriority | "none">("none");
  const [dueDate, setDueDate] = useState("");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [assigneeSelectKey, setAssigneeSelectKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const canEdit = task
    ? task.created_by === user?.id
      ? hasPermission("edit_own_tasks")
      : hasPermission("edit_all_tasks")
    : hasPermission("create_tasks");
  const canDelete = task && (hasPermission("delete_tasks") || hasPermission("manage_messages"));
  const canAssign = hasPermission("assign_tasks");
  const canChangeStatus = hasPermission("change_task_status");
  // Users can change status if they have the permission OR if they're assigned to the task
  const isAssigned = task ? (task.assignees?.some(a => a.user_id === user?.id) ?? false) : false;
  const canChangeStatusForThisTask = canChangeStatus || isAssigned;

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority || "none");
      setDueDate(task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "");
      setAssignees(task.assignees?.map((a) => a.user_id) || []);
    } else {
      setTitle("");
      setDescription("");
      setStatus("open");
      setPriority("none");
      setDueDate("");
      setAssignees([]);
    }
  }, [task]);

  const handleSave = async () => {
    if (!user) {
      handleError(new Error("User not found"));
      return;
    }

    // For new tasks, title is required
    if (!task && !title.trim()) {
      handleError(new Error("Title is required"));
      return;
    }

    // For existing tasks, if only status is being changed and user can't edit but can change status, allow it
    if (task) {
      const isOnlyStatusChange = 
        status !== task.status &&
        title === task.title &&
        description === (task.description || "") &&
        (priority === "none" ? null : priority) === task.priority &&
        dueDate === (task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "");

      if (isOnlyStatusChange && !canEdit && canChangeStatusForThisTask) {
        // Allow status-only update
      } else if (!canEdit && !isOnlyStatusChange) {
        handleError(new Error("You don't have permission to edit this task"));
        return;
      }
    } else if (!canEdit) {
      handleError(new Error("You don't have permission to create tasks"));
      return;
    }

    setIsSaving(true);
    try {
      if (task) {
        // Determine if this is only a status change
        const isOnlyStatusChange = 
          status !== task.status &&
          title === task.title &&
          description === (task.description || "") &&
          (priority === "none" ? null : priority) === task.priority &&
          dueDate === (task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "");

        // If only status change and user doesn't have edit permissions, only send status
        if (isOnlyStatusChange && !canEdit && canChangeStatusForThisTask) {
          const { error } = await supabase.rpc("update_task", {
            _task_id: task.id,
            _user_id: user.id,
            _title: null, // Don't update
            _description: null, // Don't update
            _status: status, // Only update status
            _priority: null, // Don't update
            _due_date: null, // Don't update
          });

          if (error) throw error;
        } else {
          // Update all fields (user has edit permissions)
          const { error } = await supabase.rpc("update_task", {
            _task_id: task.id,
            _user_id: user.id,
            _title: title.trim(),
            _description: description.trim() || null,
            _status: status,
            _priority: priority === "none" ? null : priority,
            _due_date: dueDate ? new Date(dueDate).toISOString() : null,
          });

          if (error) throw error;
        }

        // Update assignees
        const currentAssigneeIds = task.assignees?.map((a) => a.user_id) || [];
        const toAdd = assignees.filter((id) => !currentAssigneeIds.includes(id));
        const toRemove = currentAssigneeIds.filter((id) => !assignees.includes(id));

        if (toAdd.length > 0) {
          const { error: assignError } = await supabase.rpc("assign_task_users", {
            _task_id: task.id,
            _user_id: user.id,
            _assignee_ids: toAdd,
          });
          if (assignError) throw assignError;
        }

        if (toRemove.length > 0) {
          const { error: unassignError } = await supabase.rpc("unassign_task_users", {
            _task_id: task.id,
            _user_id: user.id,
            _assignee_ids: toRemove,
          });
          if (unassignError) throw unassignError;
        }
      } else {
        // Create new task
        const { error } = await supabase.rpc("create_task", {
          _channel_id: channelId,
          _user_id: user.id,
          _title: title.trim(),
          _description: description.trim() || null,
          _priority: priority || null,
          _due_date: dueDate ? new Date(dueDate).toISOString() : null,
          _assignee_ids: assignees,
        });

        if (error) throw error;
      }

      showSuccess(task ? "Task updated" : "Task created");
      onSave();
    } catch (error) {
      handleError(error, task ? "Failed to update task" : "Failed to create task");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!task || !user || !confirm("Are you sure you want to delete this task?")) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_task", {
        _task_id: task.id,
        _user_id: user.id,
      });

      if (error) throw error;

      showSuccess("Task deleted");
      onSave();
    } catch (error) {
      handleError(error, "Failed to delete task");
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleAssignee = (userId: string) => {
    if (!canAssign) return;
    setAssignees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const parsedDescription = description
    ? parseTextContent(description, user?.id, undefined, undefined, undefined)
    : "";

  const availableMembers = members.filter((m) => m.user);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-3xl max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="flex items-center justify-between">
            <span>{task ? "Edit Task" : "Create Task"}</span>
            {task && canDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Title */}
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              disabled={!canEdit}
              className="mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description (Markdown supported)</Label>
            {canEdit ? (
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Task description..."
                className="mt-1 min-h-[120px]"
              />
            ) : (
              <div
                className="mt-1 p-3 rounded-md border bg-muted/50 min-h-[120px] prose prose-sm max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: parsedDescription || "<p class='text-muted-foreground'>No description</p>" }}
              />
            )}
          </div>

          {/* Status and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Status</Label>
              <Select 
                value={status} 
                onValueChange={(v) => setStatus(v as TaskStatus)} 
                disabled={!canChangeStatusForThisTask && !canEdit}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority | "none")}
                disabled={!canEdit}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="No priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No priority</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={!canEdit}
              className="mt-1"
            />
          </div>

          {/* Assignees */}
          <div>
            <Label>Assignees</Label>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap gap-2">
                {assignees.map((userId) => {
                  const member = availableMembers.find((m) => m.user_id === userId);
                  const assigneeUser = member?.user;
                  if (!assigneeUser) return null;
                  return (
                    <Badge
                      key={userId}
                      variant="secondary"
                      className="flex items-center gap-1.5 px-2 py-1"
                    >
                      <Avatar className="w-4 h-4">
                        <AvatarImage src={assigneeUser.avatar_url} />
                        <AvatarFallback
                          style={{ backgroundColor: assigneeUser.banner_color || "#5865F2" }}
                          className="text-[8px]"
                        >
                          {assigneeUser.username?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {assigneeUser.display_name || assigneeUser.username}
                      {canAssign && (
                        <button
                          onClick={() => toggleAssignee(userId)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
              {canAssign && (
                <Select
                  key={assigneeSelectKey}
                  onValueChange={(userId) => {
                    if (userId && !assignees.includes(userId)) {
                      setAssignees([...assignees, userId]);
                      // Reset the select by changing its key
                      setAssigneeSelectKey((prev) => prev + 1);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Add assignee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMembers
                      .filter((m) => !assignees.includes(m.user_id))
                      .map((member) => (
                        <SelectItem key={member.id} value={member.user_id}>
                          {member.user?.display_name || member.user?.username || "Unknown"}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Task Info */}
          {task && (
            <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
              <div>Created {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</div>
              {task.updated_at !== task.created_at && (
                <div>Updated {formatDistanceToNow(new Date(task.updated_at), { addSuffix: true })}</div>
              )}
            </div>
          )}

          {/* Comments Section */}
          {task && <TaskCommentSection taskId={task.id} channelId={channelId} />}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t px-6 py-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isSaving || isDeleting}>
            {task ? "Close" : "Cancel"}
          </Button>
          {(canEdit || canChangeStatusForThisTask) && (
            <Button 
              onClick={handleSave} 
              disabled={isSaving || isDeleting || (!task && !title.trim())}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {task ? "Save Changes" : "Create Task"}
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
