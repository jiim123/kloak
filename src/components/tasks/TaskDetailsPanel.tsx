import { useState, useEffect } from 'react';
import { X, Calendar, Flag, Users, Trash2, MessageSquare, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Task, TaskPriority, TaskStatus, ServerMember } from '@/types';

interface TaskDetailsPanelProps {
  task: Task;
  members: ServerMember[];
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  onClose: () => void;
  onUpdate: (updates: {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    status?: TaskStatus;
    dueDate?: string | null;
  }) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onAssign: (userIds: string[]) => Promise<boolean>;
  onUnassign: (userIds: string[]) => Promise<boolean>;
}

const priorityColors: Record<TaskPriority, string> = {
  high: 'text-red-500',
  medium: 'text-yellow-500',
  low: 'text-blue-500',
};

const statusLabels: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  archived: 'Archived',
};

export const TaskDetailsPanel = ({
  task,
  members,
  canEdit,
  canDelete,
  canAssign,
  onClose,
  onUpdate,
  onDelete,
  onAssign,
  onUnassign,
}: TaskDetailsPanelProps) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [dueDate, setDueDate] = useState<Date | undefined>(
    task.due_date ? new Date(task.due_date) : undefined
  );
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showAssignPopover, setShowAssignPopover] = useState(false);

  // Track if any changes were made
  const hasChanges =
    title !== task.title ||
    description !== (task.description || '') ||
    priority !== task.priority ||
    status !== task.status ||
    (dueDate?.toISOString() || null) !== task.due_date;

  // Auto-save on blur or after a short delay
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (hasChanges && canEdit) {
        await handleSave();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [title, description, priority, status, dueDate]);

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    
    setIsSaving(true);
    try {
      await onUpdate({
        title: title !== task.title ? title : undefined,
        description: description !== (task.description || '') ? (description || null) : undefined,
        priority: priority !== task.priority ? priority : undefined,
        status: status !== task.status ? status : undefined,
        dueDate: (dueDate?.toISOString() || null) !== task.due_date 
          ? (dueDate?.toISOString() || null) 
          : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const success = await onDelete();
    if (success) {
      onClose();
    }
    setIsDeleting(false);
    setShowDeleteDialog(false);
  };

  const handleToggleAssignee = async (userId: string) => {
    const isAssigned = task.assignees?.some(a => a.user_id === userId);
    if (isAssigned) {
      await onUnassign([userId]);
    } else {
      await onAssign([userId]);
    }
  };

  const assignedUserIds = new Set(task.assignees?.map(a => a.user_id) || []);

  return (
    <>
      <div className="w-80 border-l border-border bg-card flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Task Details</h3>
          <div className="flex items-center gap-2">
            {isSaving && (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            )}
            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Title
              </Label>
              {canEdit ? (
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Task title"
                  className="h-9"
                  maxLength={200}
                />
              ) : (
                <p className="text-sm">{task.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Description
              </Label>
              {canEdit ? (
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a description..."
                  className="min-h-[100px] resize-none"
                  maxLength={1000}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {task.description || 'No description'}
                </p>
              )}
              {canEdit && (
                <p className="text-xs text-muted-foreground text-right">
                  {description.length}/1000
                </p>
              )}
            </div>

            <Separator />

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                Status
              </Label>
              {canEdit ? (
                <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm">{statusLabels[task.status]}</p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Flag className="w-3.5 h-3.5" />
                Priority
              </Label>
              {canEdit ? (
                <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        Low
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        High
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className={cn('text-sm capitalize', priorityColors[task.priority])}>
                  {task.priority}
                </p>
              )}
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Due Date
              </Label>
              {canEdit ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start h-9 font-normal">
                      {dueDate ? format(dueDate, 'PPP') : 'No due date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                    {dueDate && (
                      <div className="p-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setDueDate(undefined)}
                        >
                          Clear date
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              ) : (
                <p className="text-sm">
                  {task.due_date ? format(new Date(task.due_date), 'PPP') : 'No due date'}
                </p>
              )}
            </div>

            <Separator />

            {/* Assignees */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Assignees
              </Label>
              <div className="space-y-2">
                {task.assignees && task.assignees.length > 0 ? (
                  task.assignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={assignee.user?.avatar_url || undefined} />
                        <AvatarFallback
                          className="text-xs"
                          style={{ backgroundColor: assignee.user?.banner_color || '#5865F2' }}
                        >
                          {assignee.user?.username?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm flex-1 truncate">
                        {assignee.user?.display_name || assignee.user?.username || 'Unknown'}
                      </span>
                      {canAssign && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6"
                          onClick={() => handleToggleAssignee(assignee.user_id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No assignees</p>
                )}
                
                {canAssign && (
                  <Popover open={showAssignPopover} onOpenChange={setShowAssignPopover}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        Add Assignee
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <ScrollArea className="max-h-[200px]">
                        {members.map((member) => {
                          const isAssigned = assignedUserIds.has(member.user_id);
                          return (
                            <button
                              key={member.user_id}
                              onClick={() => handleToggleAssignee(member.user_id)}
                              className={cn(
                                'w-full flex items-center gap-2 p-2 rounded-lg hover:bg-secondary transition-colors',
                                isAssigned && 'bg-primary/10'
                              )}
                            >
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={member.user?.avatar_url || undefined} />
                                <AvatarFallback
                                  className="text-xs"
                                  style={{ backgroundColor: member.user?.banner_color || '#5865F2' }}
                                >
                                  {member.user?.username?.[0]?.toUpperCase() || '?'}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm flex-1 truncate text-left">
                                {member.nickname || member.user?.display_name || member.user?.username}
                              </span>
                              {isAssigned && (
                                <span className="text-xs text-primary">Assigned</span>
                              )}
                            </button>
                          );
                        })}
                      </ScrollArea>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            <Separator />

            {/* Created info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Created {format(new Date(task.created_at), 'PPP')}</p>
              {task.creator && (
                <p>by {task.creator.display_name || task.creator.username}</p>
              )}
            </div>

            {/* Delete button */}
            {canDelete && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Task
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
