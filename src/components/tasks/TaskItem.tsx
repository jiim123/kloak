import { useState, useRef, useEffect, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Check, GripVertical, Calendar, Trash2, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import type { Task, User } from '@/types';
import { format, isPast, isToday, isTomorrow } from 'date-fns';

interface TaskItemProps {
  task: Task;
  canToggleStatus: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAssign: boolean;
  onToggleStatus: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAssign: () => void;
  onSelect: () => void;
  onUpdateTitle: (title: string) => void;
  isDraggable?: boolean;
}

const PriorityDot = ({ priority }: { priority: string }) => {
  const colors: Record<string, string> = {
    high: 'bg-red-500',
    medium: 'bg-yellow-500',
    low: 'bg-blue-500',
  };
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', colors[priority] || 'bg-muted')} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {priority.charAt(0).toUpperCase() + priority.slice(1)} priority
      </TooltipContent>
    </Tooltip>
  );
};

const DueDateBadge = ({ dueDate }: { dueDate: string }) => {
  const date = new Date(dueDate);
  const overdue = isPast(date) && !isToday(date);
  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  
  let label = format(date, 'MMM d');
  if (today) label = 'Today';
  else if (tomorrow) label = 'Tomorrow';
  
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded text-xs',
            overdue && 'bg-destructive/20 text-destructive',
            today && 'bg-amber-500/20 text-amber-600 dark:text-amber-400',
            tomorrow && 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
            !overdue && !today && !tomorrow && 'bg-muted text-muted-foreground'
          )}
        >
          <Calendar className="w-3 h-3" />
          <span>{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Due: {format(date, 'PPP')}
      </TooltipContent>
    </Tooltip>
  );
};

const AssigneeAvatars = ({ assignees }: { assignees?: Task['assignees'] }) => {
  if (!assignees || assignees.length === 0) return null;
  
  const maxVisible = 3;
  const visible = assignees.slice(0, maxVisible);
  const remaining = assignees.length - maxVisible;
  
  return (
    <div className="flex -space-x-1.5">
      {visible.map((assignee) => (
        <Tooltip key={assignee.id}>
          <TooltipTrigger asChild>
            <Avatar className="w-5 h-5 border-2 border-background">
              <AvatarImage src={assignee.user?.avatar_url || undefined} />
              <AvatarFallback
                className="text-[10px]"
                style={{ backgroundColor: assignee.user?.banner_color || '#5865F2' }}
              >
                {assignee.user?.username?.[0]?.toUpperCase() || '?'}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {assignee.user?.display_name || assignee.user?.username || 'Unknown'}
          </TooltipContent>
        </Tooltip>
      ))}
      {remaining > 0 && (
        <div className="w-5 h-5 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground">
          +{remaining}
        </div>
      )}
    </div>
  );
};

export const TaskItem = memo(({
  task,
  canToggleStatus,
  canEdit,
  canDelete,
  canAssign,
  onToggleStatus,
  onEdit,
  onDelete,
  onAssign,
  onSelect,
  onUpdateTitle,
  isDraggable = true,
}: TaskItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled: !isDraggable,
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };
  
  const isCompleted = task.status === 'completed';
  
  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);
  
  const handleDoubleClick = () => {
    if (canEdit) {
      setEditValue(task.title);
      setIsEditing(true);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (editValue.trim() && editValue !== task.title) {
        onUpdateTitle(editValue.trim());
      }
      setIsEditing(false);
    } else if (e.key === 'Escape') {
      setEditValue(task.title);
      setIsEditing(false);
    }
  };
  
  const handleBlur = () => {
    if (editValue.trim() && editValue !== task.title) {
      onUpdateTitle(editValue.trim());
    }
    setIsEditing(false);
  };
  
  const taskContent = (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center gap-2 px-2 py-2 rounded-lg transition-all duration-150',
        'hover:bg-secondary/60',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-primary/30 bg-secondary',
        isCompleted && 'opacity-60'
      )}
    >
      {/* Drag handle */}
      {isDraggable && (
        <div
          {...attributes}
          {...listeners}
          className="p-1 opacity-0 group-hover:opacity-50 hover:!opacity-100 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (canToggleStatus) onToggleStatus();
        }}
        disabled={!canToggleStatus}
        className={cn(
          'w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all',
          isCompleted
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 hover:border-primary',
          !canToggleStatus && 'cursor-not-allowed opacity-50'
        )}
      >
        {isCompleted && <Check className="w-3 h-3" />}
      </button>
      
      {/* Priority indicator */}
      <PriorityDot priority={task.priority} />
      
      {/* Title */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className="flex-1 bg-transparent border-none outline-none text-sm focus:ring-0"
          maxLength={200}
        />
      ) : (
        <span
          onClick={onSelect}
          onDoubleClick={handleDoubleClick}
          className={cn(
            'flex-1 text-sm truncate cursor-pointer',
            isCompleted && 'line-through text-muted-foreground'
          )}
        >
          {task.title}
        </span>
      )}
      
      {/* Due date */}
      {task.due_date && <DueDateBadge dueDate={task.due_date} />}
      
      {/* Assignees */}
      <AssigneeAvatars assignees={task.assignees} />
      
      {/* Hover actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {canAssign && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onAssign();
                }}
              >
                <UserPlus className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Assign</TooltipContent>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Delete</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
  
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {taskContent}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onSelect}>
          View Details
        </ContextMenuItem>
        {canEdit && (
          <ContextMenuItem onClick={onEdit}>
            Edit Task
          </ContextMenuItem>
        )}
        {canAssign && (
          <ContextMenuItem onClick={onAssign}>
            <UserPlus className="w-4 h-4 mr-2" />
            Manage Assignees
          </ContextMenuItem>
        )}
        {canToggleStatus && (
          <ContextMenuItem onClick={onToggleStatus}>
            {isCompleted ? 'Mark as Open' : 'Mark as Complete'}
          </ContextMenuItem>
        )}
        {canDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Task
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
});

TaskItem.displayName = 'TaskItem';
